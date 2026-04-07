<?php

namespace App\Http\Controllers\Api\Registry;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePlacaFrotaRequest;
use App\Http\Requests\UpdatePlacaFrotaRequest;
use App\Models\PlacaFrota;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PlacaFrotaController extends Controller
{
    private const INDEX_CACHE_KEY = 'transport:registry:placas:index';

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $user?->isAdmin() || $user?->isMasterAdmin() || $user?->isUsuario(),
            403,
        );

        return response()->json([
            'data' => Cache::remember(
                self::INDEX_CACHE_KEY,
                now()->addMinutes(10),
                fn () => PlacaFrota::query()
                    ->select(['id', 'placa', 'unidade_id'])
                    ->with('unidade:id,nome')
                    ->orderBy('placa')
                    ->get(),
            ),
        ]);
    }

    public function store(StorePlacaFrotaRequest $request): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('registry.plates-aviaries.manage'), 403);

        $placaFrota = PlacaFrota::query()->create($request->validated());

        Cache::forget(self::INDEX_CACHE_KEY);

        return response()->json([
            'data' => $placaFrota->load('unidade:id,nome'),
        ], 201);
    }

    public function bulkStore(Request $request): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('registry.plates-aviaries.manage'), 403);

        $validated = Validator::make($request->all(), [
            'unidade_id' => ['required', 'integer', 'exists:unidades,id'],
            'placas' => ['required', 'string'],
        ])->validate();

        $rawPlates = preg_split('/[\r\n,;]+/', (string) $validated['placas']) ?: [];

        $normalized = collect($rawPlates)
            ->map(function (string $value): string {
                $plate = strtoupper(trim($value));

                return preg_replace('/[^A-Z0-9]/', '', $plate) ?: '';
            })
            ->filter(fn (string $plate): bool => $plate !== '')
            ->unique()
            ->values();

        if ($normalized->isEmpty()) {
            return response()->json([
                'created_count' => 0,
                'skipped_existing' => [],
            ]);
        }

        $existing = PlacaFrota::query()
            ->whereIn('placa', $normalized->all())
            ->pluck('placa')
            ->all();

        $toCreate = $normalized->reject(fn (string $plate): bool => in_array($plate, $existing, true));

        DB::transaction(function () use ($toCreate, $validated): void {
            foreach ($toCreate as $plate) {
                PlacaFrota::query()->create([
                    'placa' => $plate,
                    'unidade_id' => (int) $validated['unidade_id'],
                ]);
            }
        });

        Cache::forget(self::INDEX_CACHE_KEY);

        return response()->json([
            'created_count' => $toCreate->count(),
            'skipped_existing' => array_values($existing),
        ], 201);
    }

    public function update(UpdatePlacaFrotaRequest $request, PlacaFrota $placaFrota): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('registry.plates-aviaries.manage'), 403);

        $placaFrota->update($request->validated());

        Cache::forget(self::INDEX_CACHE_KEY);

        return response()->json([
            'data' => $placaFrota->refresh()->load('unidade:id,nome'),
        ]);
    }

    public function destroy(Request $request, PlacaFrota $placaFrota): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('registry.plates-aviaries.manage'), 403);

        $placaFrota->delete();

        Cache::forget(self::INDEX_CACHE_KEY);

        return response()->json([], 204);
    }
}
