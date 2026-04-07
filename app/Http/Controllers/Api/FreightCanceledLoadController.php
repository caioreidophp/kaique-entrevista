<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FreightCanceledLoad;
use App\Models\FreightCanceledLoadBatch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class FreightCanceledLoadController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $validated = Validator::make($request->all(), [
            'status' => ['nullable', 'in:a_receber,recebida'],
            'placa' => ['nullable', 'string', 'max:20'],
            'mes' => ['nullable', 'string', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'unidade_id' => ['nullable', 'integer', 'exists:unidades,id'],
        ])->validate();

        $status = (string) ($validated['status'] ?? 'a_receber');

        $query = $this->queryForUser($request)
            ->with(['unidade:id,nome', 'batch:id,descricao,data_pagamento,numero_nota_fiscal'])
            ->where('status', $status)
            ->latest('data')
            ->latest('id');

        if (! empty($validated['placa'])) {
            $query->where('placa', 'like', '%'.trim((string) $validated['placa']).'%');
        }

        if (! empty($validated['unidade_id'])) {
            $query->where('unidade_id', (int) $validated['unidade_id']);
        }

        if (! empty($validated['mes'])) {
            [$year, $month] = explode('-', (string) $validated['mes']);
            $query
                ->whereYear('data', (int) $year)
                ->whereMonth('data', (int) $month);
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    public function updateTripNumber(Request $request, FreightCanceledLoad $canceledLoad): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $this->ensureCanAccess($request, $canceledLoad);

        $validated = Validator::make($request->all(), [
            'n_viagem' => ['nullable', 'string', 'max:80'],
        ])->validate();

        $canceledLoad->update([
            'n_viagem' => isset($validated['n_viagem']) ? trim((string) $validated['n_viagem']) : null,
        ]);

        return response()->json([
            'data' => $canceledLoad->refresh()->load('unidade:id,nome'),
        ]);
    }

    public function update(Request $request, FreightCanceledLoad $canceledLoad): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $this->ensureCanAccess($request, $canceledLoad);

        $validated = Validator::make($request->all(), [
            'data' => ['required', 'date'],
            'placa' => ['required', 'string', 'max:20'],
            'aviario' => ['nullable', 'string', 'max:255'],
            'valor' => ['required', 'numeric', 'min:0'],
            'n_viagem' => ['nullable', 'string', 'max:80'],
            'obs' => ['nullable', 'string'],
        ])->validate();

        $canceledLoad->update([
            'data' => (string) $validated['data'],
            'placa' => strtoupper(trim((string) $validated['placa'])),
            'aviario' => isset($validated['aviario'])
                ? trim((string) $validated['aviario'])
                : null,
            'valor' => (float) $validated['valor'],
            'n_viagem' => isset($validated['n_viagem'])
                ? trim((string) $validated['n_viagem'])
                : null,
            'obs' => isset($validated['obs'])
                ? trim((string) $validated['obs'])
                : null,
        ]);

        return response()->json([
            'data' => $canceledLoad->refresh()->load(['unidade:id,nome', 'batch:id,descricao,data_pagamento,numero_nota_fiscal']),
        ]);
    }

    public function bill(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $validated = Validator::make($request->all(), [
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:freight_canceled_loads,id'],
            'descricao' => ['required', 'string', 'max:255'],
            'data_pagamento' => ['required', 'date'],
            'numero_nota_fiscal' => ['required', 'string', 'max:80'],
        ])->validate();

        $ids = collect($validated['ids'])->map(fn ($id) => (int) $id)->values();

        $loads = $this->queryForUser($request)
            ->where('status', 'a_receber')
            ->whereIn('id', $ids->all())
            ->get();

        if ($loads->isEmpty()) {
            return response()->json([
                'updated_count' => 0,
            ]);
        }

        $firstLoad = $loads->first();
        $batch = FreightCanceledLoadBatch::query()->create([
            'unidade_id' => (int) ($firstLoad?->unidade_id ?? 0),
            'autor_id' => (int) $request->user()->id,
            'descricao' => trim((string) $validated['descricao']),
            'data_pagamento' => (string) $validated['data_pagamento'],
            'numero_nota_fiscal' => trim((string) $validated['numero_nota_fiscal']),
        ]);

        $updatedCount = FreightCanceledLoad::query()
            ->whereIn('id', $loads->pluck('id')->all())
            ->update([
                'batch_id' => $batch->id,
                'status' => 'recebida',
                'data_pagamento' => (string) $validated['data_pagamento'],
            ]);

        return response()->json([
            'updated_count' => $updatedCount,
            'batch_id' => $batch->id,
        ]);
    }

    public function destroy(Request $request, FreightCanceledLoad $canceledLoad): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $this->ensureCanAccess($request, $canceledLoad);

        $canceledLoad->delete();

        return response()->json([], 204);
    }

    public function unbillBatch(Request $request, FreightCanceledLoadBatch $batch): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $this->ensureCanAccessBatch($request, $batch);

        FreightCanceledLoad::query()
            ->where('batch_id', $batch->id)
            ->update([
                'batch_id' => null,
                'status' => 'a_receber',
                'data_pagamento' => null,
            ]);

        $batch->delete();

        return response()->json(['ok' => true]);
    }

    public function unbillOne(Request $request, FreightCanceledLoad $canceledLoad): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $this->ensureCanAccess($request, $canceledLoad);

        $batchId = $canceledLoad->batch_id;

        $canceledLoad->update([
            'batch_id' => null,
            'status' => 'a_receber',
            'data_pagamento' => null,
        ]);

        if ($batchId) {
            $remainingInBatch = FreightCanceledLoad::query()
                ->where('batch_id', $batchId)
                ->count();

            if ($remainingInBatch === 0) {
                FreightCanceledLoadBatch::query()->whereKey($batchId)->delete();
            }
        }

        return response()->json(['ok' => true]);
    }

    public function destroyBatch(Request $request, FreightCanceledLoadBatch $batch): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $this->ensureCanAccessBatch($request, $batch);

        FreightCanceledLoad::query()
            ->where('batch_id', $batch->id)
            ->delete();

        $batch->delete();

        return response()->json([], 204);
    }

    private function ensureCanAccess(Request $request, FreightCanceledLoad $canceledLoad): void
    {
        if ($request->user()?->isMasterAdmin()) {
            return;
        }

        abort_if($canceledLoad->autor_id !== $request->user()->id, 403);
    }

    private function ensureCanAccessBatch(Request $request, FreightCanceledLoadBatch $batch): void
    {
        if ($request->user()?->isMasterAdmin()) {
            return;
        }

        abort_if($batch->autor_id !== $request->user()->id, 403);
    }

    private function queryForUser(Request $request): Builder
    {
        $query = FreightCanceledLoad::query();

        if ($request->user()?->isMasterAdmin()) {
            return $query;
        }

        return $query->where('autor_id', $request->user()->id);
    }
}
