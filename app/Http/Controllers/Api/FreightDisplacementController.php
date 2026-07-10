<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFreightDisplacementRequest;
use App\Http\Requests\UpdateFreightDisplacementRequest;
use App\Models\FreightDisplacement;
use App\Models\FreightSpotEntry;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FreightDisplacementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('freight.list.view'), 403);

        $validated = $request->validate([
            'tab' => ['nullable', 'in:pending,paid'],
            'status' => ['nullable', 'in:pendente,calculado,aguardando_pagamento,pago'],
            'data' => ['nullable', 'date_format:Y-m-d'],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'unidade_pagadora_id' => ['nullable', 'integer', 'exists:unidades,id'],
            'unidade_veiculos_id' => ['nullable', 'integer', 'exists:unidades,id'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $tab = (string) ($validated['tab'] ?? 'pending');

        $query = $this->queryForUser($request)
            ->with([
                'unidadeVeiculos:id,nome',
                'unidadePagadora:id,nome',
                'spotEntry:id',
                'autor:id,name',
            ]);

        if ($tab === 'paid') {
            $query->where('status', FreightDisplacement::STATUS_PAGO);
        } else {
            $query->where('status', '!=', FreightDisplacement::STATUS_PAGO);
        }

        if (! empty($validated['status'])) {
            $query->where('status', (string) $validated['status']);
        }

        if (! empty($validated['data'])) {
            $query->whereDate('data', (string) $validated['data']);
        }

        if (! empty($validated['start_date']) && ! empty($validated['end_date'])) {
            $query->whereBetween('data', [
                (string) $validated['start_date'],
                (string) $validated['end_date'],
            ]);
        }

        if (! empty($validated['unidade_pagadora_id'])) {
            $query->where('unidade_pagadora_id', (int) $validated['unidade_pagadora_id']);
        }

        if (! empty($validated['unidade_veiculos_id'])) {
            $query->where('unidade_veiculos_id', (int) $validated['unidade_veiculos_id']);
        }

        $rows = $query
            ->orderByDesc('data')
            ->orderByDesc('id')
            ->paginate((int) ($validated['per_page'] ?? 50));

        return response()->json($rows);
    }

    public function store(StoreFreightDisplacementRequest $request): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('freight.launch.create'), 403);

        $displacement = DB::transaction(function () use ($request): FreightDisplacement {
            $displacement = FreightDisplacement::query()->create(
                $request->validated() + ['autor_id' => (int) $request->user()->id],
            );

            $this->syncSpotEntry($displacement, (int) $request->user()->id);

            return $displacement->fresh(['unidadeVeiculos:id,nome', 'unidadePagadora:id,nome', 'spotEntry:id']);
        });

        return response()->json(['data' => $displacement], 201);
    }

    public function update(UpdateFreightDisplacementRequest $request, FreightDisplacement $displacement): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('freight.launch.create'), 403);

        $displacement = DB::transaction(function () use ($request, $displacement): FreightDisplacement {
            $displacement->update($request->validated());
            $this->syncSpotEntry($displacement, (int) $request->user()->id);

            return $displacement->fresh(['unidadeVeiculos:id,nome', 'unidadePagadora:id,nome', 'spotEntry:id']);
        });

        return response()->json(['data' => $displacement]);
    }

    public function destroy(Request $request, FreightDisplacement $displacement): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('freight.launch.create'), 403);

        DB::transaction(function () use ($displacement): void {
            if ($displacement->freight_spot_entry_id) {
                FreightSpotEntry::query()
                    ->whereKey((int) $displacement->freight_spot_entry_id)
                    ->delete();
            }

            $displacement->delete();
        });

        return response()->json(status: 204);
    }

    private function syncSpotEntry(FreightDisplacement $displacement, int $userId): void
    {
        if (! $displacement->isPaid()) {
            if ($displacement->freight_spot_entry_id) {
                FreightSpotEntry::query()
                    ->whereKey((int) $displacement->freight_spot_entry_id)
                    ->delete();

                $displacement->forceFill(['freight_spot_entry_id' => null])->save();
            }

            return;
        }

        $payload = [
            'data' => $displacement->data?->toDateString(),
            'unidade_origem_id' => (int) $displacement->unidade_pagadora_id,
            'autor_id' => $userId,
            'frete_spot' => $displacement->valor_aproximado,
            'cargas' => (int) $displacement->quantidade_caminhoes,
            'aves' => 0,
            'km_rodado' => $displacement->km_aproximado,
            'obs' => $this->spotObservation($displacement),
        ];

        if ($displacement->freight_spot_entry_id) {
            FreightSpotEntry::query()
                ->whereKey((int) $displacement->freight_spot_entry_id)
                ->update($payload);

            return;
        }

        $spotEntry = FreightSpotEntry::query()->create($payload);
        $displacement->forceFill(['freight_spot_entry_id' => $spotEntry->id])->save();
    }

    private function spotObservation(FreightDisplacement $displacement): string
    {
        $parts = [
            'Deslocamento/Pendência #'.$displacement->id,
            $displacement->descricao,
            trim($displacement->origem.' -> '.$displacement->destino),
        ];

        if ($displacement->placas) {
            $parts[] = 'Placas: '.$displacement->placas;
        }

        return implode(' | ', array_filter($parts));
    }

    private function queryForUser(Request $request): Builder
    {
        $query = FreightDisplacement::query();
        $user = $request->user();

        if (! $user?->isMasterAdmin()) {
            $query->where('autor_id', $user->id);
        }

        if ($user?->dataScopeFor('freight') === 'units') {
            $allowedUnitIds = $user->allowedUnitIdsFor('freight') ?: [0];
            $query->where(function (Builder $builder) use ($allowedUnitIds): void {
                $builder
                    ->whereIn('unidade_veiculos_id', $allowedUnitIds)
                    ->orWhereIn('unidade_pagadora_id', $allowedUnitIds);
            });
        }

        return $query;
    }
}
