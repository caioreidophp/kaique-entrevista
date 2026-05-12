<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UnitFleetSize;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FreightFleetSizeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('freight.dashboard.view'), 403);

        $validated = $request->validate([
            'competencia_mes' => ['nullable', 'integer', 'min:1', 'max:12'],
            'competencia_ano' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'unidade_id' => ['nullable', 'integer', 'exists:unidades,id'],
            'include_all_months' => ['nullable', 'boolean'],
        ]);

        $month = (int) ($validated['competencia_mes'] ?? now()->month);
        $year = (int) ($validated['competencia_ano'] ?? now()->year);
        $monthReference = Carbon::create($year, $month, 1)->startOfMonth()->toDateString();
        $unidadeId = isset($validated['unidade_id']) ? (int) $validated['unidade_id'] : null;
        $includeAllMonths = (bool) ($validated['include_all_months'] ?? false);

        if ($unidadeId !== null) {
            abort_unless($request->user()?->canAccessUnit('freight', $unidadeId), 403);
        }

        $query = UnitFleetSize::query()
            ->with('unidade:id,nome')
            ->when(! $includeAllMonths, fn (Builder $builder) => $builder->whereDate('reference_month', $monthReference))
            ->when($unidadeId !== null, fn (Builder $builder) => $builder->where('unidade_id', $unidadeId))
            ->orderByDesc('reference_month')
            ->orderBy('unidade_id');

        if ($request->user()?->dataScopeFor('freight') === 'units') {
            $allowed = $request->user()->allowedUnitIdsFor('freight');
            $query->whereIn('unidade_id', $allowed !== [] ? $allowed : [0]);
        }

        return response()->json([
            'competencia_mes' => $month,
            'competencia_ano' => $year,
            'data' => $query
                ->get()
                ->map(fn (UnitFleetSize $size): array => [
                    'id' => (int) $size->id,
                    'unidade_id' => (int) $size->unidade_id,
                    'unidade_nome' => $size->unidade?->nome,
                    'reference_month' => $size->reference_month?->format('Y-m'),
                    'fleet_size' => (int) $size->fleet_size,
                ])
                ->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('freight.entries.update'), 403);

        $validated = $request->validate([
            'unidade_id' => ['required', 'integer', 'exists:unidades,id'],
            'reference_month' => ['required', 'date_format:Y-m'],
            'fleet_size' => ['required', 'integer', 'min:1'],
        ]);

        $unidadeId = (int) $validated['unidade_id'];
        abort_unless($request->user()?->canAccessUnit('freight', $unidadeId), 403);

        $referenceMonth = Carbon::createFromFormat('Y-m', (string) $validated['reference_month'])
            ->startOfMonth()
            ->toDateString();

        $record = UnitFleetSize::query()->updateOrCreate(
            [
                'unidade_id' => $unidadeId,
                'reference_month' => $referenceMonth,
            ],
            [
                'fleet_size' => (int) $validated['fleet_size'],
            ],
        );

        return response()->json([
            'data' => [
                'id' => (int) $record->id,
                'unidade_id' => (int) $record->unidade_id,
                'unidade_nome' => $record->unidade?->nome,
                'reference_month' => $record->reference_month?->format('Y-m'),
                'fleet_size' => (int) $record->fleet_size,
            ],
        ], 201);
    }

    public function update(Request $request, UnitFleetSize $unitFleetSize): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('freight.entries.update'), 403);
        abort_unless($request->user()?->canAccessUnit('freight', (int) $unitFleetSize->unidade_id), 403);

        $validated = $request->validate([
            'fleet_size' => ['required', 'integer', 'min:1'],
        ]);

        $unitFleetSize->update([
            'fleet_size' => (int) $validated['fleet_size'],
        ]);

        return response()->json([
            'data' => [
                'id' => (int) $unitFleetSize->id,
                'unidade_id' => (int) $unitFleetSize->unidade_id,
                'unidade_nome' => $unitFleetSize->unidade?->nome,
                'reference_month' => $unitFleetSize->reference_month?->format('Y-m'),
                'fleet_size' => (int) $unitFleetSize->fleet_size,
            ],
        ]);
    }

    public function destroy(Request $request, UnitFleetSize $unitFleetSize): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('freight.entries.update'), 403);
        abort_unless($request->user()?->canAccessUnit('freight', (int) $unitFleetSize->unidade_id), 403);

        $unitFleetSize->delete();

        return response()->json([], 204);
    }
}
