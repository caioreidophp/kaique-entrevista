<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFreightEntryRequest;
use App\Http\Requests\UpdateFreightEntryRequest;
use App\Models\FreightEntry;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FreightController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        [$month, $year] = $this->monthAndYear($request);

        $query = $this->queryForUser($request)
            ->whereYear('data', $year)
            ->whereMonth('data', $month);

        $totalLancamentos = (clone $query)->count();
        $totalFrete = (float) ((clone $query)->sum('frete_total'));
        $totalFreteLiquido = (float) ((clone $query)->sum('frete_liquido'));
        $totalKm = (float) ((clone $query)->sum('km_rodado'));
        $totalAves = (int) ((clone $query)->sum('aves'));
        $totalVeiculos = (int) ((clone $query)->sum('veiculos'));
        $diasTrabalhados = (clone $query)->distinct('data')->count('data');

        $fretePorKm = $totalKm > 0 ? $totalFrete / $totalKm : 0.0;
        $freteLiquidoPorKm = $totalKm > 0 ? $totalFreteLiquido / $totalKm : 0.0;
        $fretePorCaminhao = $totalVeiculos > 0 ? $totalFrete / $totalVeiculos : 0.0;
        $fretePorDiaTrabalhado = $diasTrabalhados > 0 ? $totalFrete / $diasTrabalhados : 0.0;

        $porUnidade = (clone $query)
            ->selectRaw('unidade_id, COUNT(*) as total_lancamentos, SUM(frete_total) as total_frete, SUM(frete_liquido) as total_frete_liquido, SUM(km_rodado) as total_km, SUM(veiculos) as total_veiculos, SUM(aves) as total_aves, COUNT(DISTINCT data) as dias_trabalhados')
            ->with('unidade:id,nome')
            ->groupBy('unidade_id')
            ->get()
            ->map(function (FreightEntry $entry): array {
                $totalFrete = (float) ($entry->total_frete ?? 0);
                $totalFreteLiquido = (float) ($entry->total_frete_liquido ?? 0);
                $totalKm = (float) ($entry->total_km ?? 0);
                $totalVeiculos = (int) ($entry->total_veiculos ?? 0);
                $dias = (int) ($entry->dias_trabalhados ?? 0);

                return [
                    'unidade_id' => $entry->unidade_id,
                    'unidade_nome' => $entry->unidade?->nome,
                    'total_lancamentos' => (int) ($entry->total_lancamentos ?? 0),
                    'total_frete' => $totalFrete,
                    'total_frete_liquido' => $totalFreteLiquido,
                    'total_km' => $totalKm,
                    'total_aves' => (int) ($entry->total_aves ?? 0),
                    'dias_trabalhados' => $dias,
                    'frete_por_caminhao' => $totalVeiculos > 0 ? $totalFrete / $totalVeiculos : 0.0,
                    'frete_por_dia_trabalhado' => $dias > 0 ? $totalFrete / $dias : 0.0,
                    'frete_por_km' => $totalKm > 0 ? $totalFrete / $totalKm : 0.0,
                    'frete_liquido_por_km' => $totalKm > 0 ? $totalFreteLiquido / $totalKm : 0.0,
                ];
            })
            ->values();

        $recentes = $this->queryForUser($request)
            ->with(['unidade:id,nome'])
            ->latest('data')
            ->limit(10)
            ->get();

        return response()->json([
            'competencia_mes' => $month,
            'competencia_ano' => $year,
            'kpis' => [
                'total_lancamentos' => $totalLancamentos,
                'total_frete' => $totalFrete,
                'total_frete_liquido' => $totalFreteLiquido,
                'total_km' => $totalKm,
                'total_aves' => $totalAves,
                'dias_trabalhados' => $diasTrabalhados,
                'frete_por_caminhao' => $fretePorCaminhao,
                'frete_por_dia_trabalhado' => $fretePorDiaTrabalhado,
                'media_reais_por_km' => $fretePorKm,
                'media_frete_por_km' => $freteLiquidoPorKm,
            ],
            'por_unidade' => $porUnidade,
            'lancamentos_recentes' => $recentes,
        ]);
    }

    public function monthlyUnitReport(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        [$month, $year] = $this->monthAndYear($request);

        $query = $this->queryForUser($request)
            ->whereYear('data', $year)
            ->whereMonth('data', $month);

        if ($request->filled('unidade_id')) {
            $query->where('unidade_id', (int) $request->integer('unidade_id'));
        }

        $report = (clone $query)
            ->selectRaw('unidade_id, COUNT(*) as total_lancamentos, SUM(frete_total) as total_frete, SUM(frete_liquido) as total_frete_liquido, SUM(km_rodado) as total_km, SUM(veiculos) as total_veiculos, SUM(aves) as total_aves, COUNT(DISTINCT data) as dias_trabalhados')
            ->with('unidade:id,nome')
            ->groupBy('unidade_id')
            ->orderBy('unidade_id')
            ->get()
            ->map(function (FreightEntry $entry): array {
                $totalFrete = (float) ($entry->total_frete ?? 0);
                $totalFreteLiquido = (float) ($entry->total_frete_liquido ?? 0);
                $totalKm = (float) ($entry->total_km ?? 0);
                $totalVeiculos = (int) ($entry->total_veiculos ?? 0);
                $dias = (int) ($entry->dias_trabalhados ?? 0);

                return [
                    'unidade_id' => $entry->unidade_id,
                    'unidade_nome' => $entry->unidade?->nome,
                    'dias_trabalhados' => $dias,
                    'total_frete' => $totalFrete,
                    'total_frete_liquido' => $totalFreteLiquido,
                    'total_km_rodado' => $totalKm,
                    'total_aves_transportadas' => (int) ($entry->total_aves ?? 0),
                    'frete_por_caminhao' => $totalVeiculos > 0 ? $totalFrete / $totalVeiculos : 0.0,
                    'frete_por_dia_trabalhado' => $dias > 0 ? $totalFrete / $dias : 0.0,
                    'media_reais_por_km' => $totalKm > 0 ? $totalFrete / $totalKm : 0.0,
                    'media_frete_por_km' => $totalKm > 0 ? $totalFreteLiquido / $totalKm : 0.0,
                ];
            })
            ->values();

        return response()->json([
            'competencia_mes' => $month,
            'competencia_ano' => $year,
            'data' => $report,
        ]);
    }

    public function timeline(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $startDate = $request->date('start_date')?->toDateString() ?? now()->startOfMonth()->toDateString();
        $endDate = $request->date('end_date')?->toDateString() ?? now()->endOfMonth()->toDateString();

        $query = $this->queryForUser($request)
            ->whereBetween('data', [$startDate, $endDate]);

        $unidadeIds = collect($request->input('unidade_ids', []))
            ->map(fn ($value) => (int) $value)
            ->filter(fn ($value) => $value > 0)
            ->values();

        if ($unidadeIds->isNotEmpty()) {
            $query->whereIn('unidade_id', $unidadeIds->all());
        }

        $series = (clone $query)
            ->with('unidade:id,nome')
            ->orderBy('data')
            ->get()
            ->groupBy('unidade_id')
            ->map(function ($entries): array {
                /** @var FreightEntry $first */
                $first = $entries->first();

                return [
                    'unidade_id' => $first->unidade_id,
                    'unidade_nome' => $first->unidade?->nome,
                    'points' => $entries->map(fn (FreightEntry $entry): array => [
                        'data' => $entry->data?->toDateString(),
                        'frete_total' => (float) $entry->frete_total,
                    ])->values(),
                ];
            })
            ->values();

        return response()->json([
            'start_date' => $startDate,
            'end_date' => $endDate,
            'series' => $series,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $perPage = min(max((int) $request->integer('per_page', 15), 1), 100);

        $query = $this->queryForUser($request)
            ->with(['unidade:id,nome', 'autor:id,name,email'])
            ->latest('data')
            ->latest('id');

        if ($request->filled('unidade_id')) {
            $query->where('unidade_id', (int) $request->integer('unidade_id'));
        }

        if ($request->filled('start_date')) {
            $query->whereDate('data', '>=', (string) $request->string('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->whereDate('data', '<=', (string) $request->string('end_date'));
        }

        return response()->json($query->paginate($perPage)->withQueryString());
    }

    public function store(StoreFreightEntryRequest $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $data = $this->normalizePayload($request->validated());

        $entry = FreightEntry::query()
            ->whereDate('data', (string) $data['data'])
            ->where('unidade_id', (int) $data['unidade_id'])
            ->first();

        if ($entry) {
            $entry->update([
                ...$data,
                'autor_id' => (int) $request->user()->id,
            ]);
        } else {
            $entry = FreightEntry::query()->create([
                ...$data,
                'autor_id' => (int) $request->user()->id,
            ]);
        }

        return response()->json([
            'data' => $entry->load(['unidade:id,nome', 'autor:id,name,email']),
        ], 201);
    }

    public function update(UpdateFreightEntryRequest $request, FreightEntry $freightEntry): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $data = $this->normalizePayload($request->validated());

        $freightEntry->update($data + ['autor_id' => (int) $request->user()->id]);

        return response()->json([
            'data' => $freightEntry->refresh()->load(['unidade:id,nome', 'autor:id,name,email']),
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalizePayload(array $data): array
    {
        $freteTotal = (float) ($data['frete_total'] ?? 0);
        $freteTerceiros = (float) ($data['frete_terceiros'] ?? 0);
        $cargas = (int) ($data['cargas'] ?? 0);
        $viagensTerceiros = (int) ($data['viagens_terceiros'] ?? 0);
        $aves = (int) ($data['aves'] ?? 0);
        $avesTerceiros = (int) ($data['aves_terceiros'] ?? 0);

        return [
            ...$data,
            'cargas' => $cargas,
            'aves' => $aves,
            'veiculos' => (int) ($data['veiculos'] ?? 0),
            'km_rodado' => (float) ($data['km_rodado'] ?? 0),
            'frete_terceiros' => $freteTerceiros,
            'viagens_terceiros' => $viagensTerceiros,
            'aves_terceiros' => $avesTerceiros,
            'frete_liquido' => isset($data['frete_liquido']) ? (float) $data['frete_liquido'] : max(0, $freteTotal - $freteTerceiros),
            'cargas_liq' => isset($data['cargas_liq']) ? (int) $data['cargas_liq'] : max(0, $cargas - $viagensTerceiros),
            'aves_liq' => isset($data['aves_liq']) ? (int) $data['aves_liq'] : max(0, $aves - $avesTerceiros),
            'kaique' => (float) ($data['kaique'] ?? 0),
            'vdm' => (float) ($data['vdm'] ?? 0),
            'frete_programado' => (float) ($data['frete_programado'] ?? 0),
            'cargas_programadas' => (int) ($data['cargas_programadas'] ?? 0),
            'aves_programadas' => (int) ($data['aves_programadas'] ?? 0),
            'cargas_canceladas_escaladas' => (int) ($data['cargas_canceladas_escaladas'] ?? 0),
            'nao_escaladas' => (int) ($data['nao_escaladas'] ?? 0),
            'placas' => isset($data['placas']) ? trim((string) $data['placas']) : null,
            'obs' => isset($data['obs']) ? trim((string) $data['obs']) : null,
        ];
    }

    private function queryForUser(Request $request): Builder
    {
        $query = FreightEntry::query();

        if ($request->user()?->isMasterAdmin()) {
            return $query;
        }

        return $query->where('autor_id', $request->user()->id);
    }

    /**
     * @return array{0:int,1:int}
     */
    private function monthAndYear(Request $request): array
    {
        $month = (int) $request->integer('competencia_mes', (int) now()->month);
        $year = (int) $request->integer('competencia_ano', (int) now()->year);

        $month = max(1, min(12, $month));

        return [$month, $year];
    }
}
