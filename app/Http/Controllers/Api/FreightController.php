<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ImportFreightSpreadsheetRequest;
use App\Http\Requests\StoreFreightEntryRequest;
use App\Http\Requests\StoreFreightSpotEntryRequest;
use App\Http\Requests\UpdateFreightEntryRequest;
use App\Models\FreightCanceledLoad;
use App\Models\FreightEntry;
use App\Models\FreightSpotEntry;
use App\Models\Unidade;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as SpreadsheetDate;

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
        $totalKmTerceiros = (float) ((clone $query)->sum('km_terceiros'));
        $totalFreteTerceiros = (float) ((clone $query)->sum('frete_terceiros'));
        $totalViagensTerceiros = (int) ((clone $query)->sum('viagens_terceiros'));
        $totalAves = (int) ((clone $query)->sum('aves'));
        $totalCargas = (int) ((clone $query)->sum('cargas'));
        $totalVeiculos = (int) ((clone $query)->sum('veiculos'));
        $diasTrabalhados = (clone $query)->distinct('data')->count('data');

        $fretePorKm = $totalKm > 0 ? $totalFrete / $totalKm : 0.0;
        $freteLiquidoPorKm = $totalKm > 0 ? $totalFreteLiquido / $totalKm : 0.0;
        $fretePorCaminhao = $totalVeiculos > 0 ? $totalFrete / $totalVeiculos : 0.0;
        $fretePorDiaTrabalhado = $diasTrabalhados > 0 ? $totalFrete / $diasTrabalhados : 0.0;
        $avesPorCarga = $totalCargas > 0 ? $totalAves / $totalCargas : 0.0;
        $freteMedio = $totalCargas > 0 ? $totalFrete / $totalCargas : 0.0;
        $participacaoTerceiros = $totalFrete > 0 ? ($totalFreteTerceiros / $totalFrete) * 100 : 0.0;

        $kmMuitoAltoCount = (clone $query)
            ->where('km_rodado', '>', 10000)
            ->count();

        $kmMuitoBaixoCount = (clone $query)
            ->where('km_rodado', '<', 1000)
            ->count();

        $freteMuitoBaixoCount = (clone $query)
            ->where('cargas', '>', 0)
            ->whereRaw('(frete_total / cargas) < 120')
            ->count();

        $cargaVaziaCount = (clone $query)
            ->where('cargas', '<=', 0)
            ->where('frete_total', '>', 0)
            ->count();

        $alerts = [];

        if ($kmMuitoAltoCount > 0) {
            $alerts[] = [
                'level' => 'warning',
                'key' => 'km_muito_alto',
                'message' => "{$kmMuitoAltoCount} lançamento(s) com KM muito alto no período (>10000).",
            ];
        }

        if ($kmMuitoBaixoCount > 0) {
            $alerts[] = [
                'level' => 'warning',
                'key' => 'km_muito_baixo',
                'message' => "{$kmMuitoBaixoCount} lançamento(s) com KM muito baixo no período (<1000).",
            ];
        }

        if ($freteMuitoBaixoCount > 0) {
            $alerts[] = [
                'level' => 'warning',
                'key' => 'frete_muito_baixo',
                'message' => "{$freteMuitoBaixoCount} lançamento(s) com frete por carga abaixo do padrão.",
            ];
        }

        if ($cargaVaziaCount > 0) {
            $alerts[] = [
                'level' => 'info',
                'key' => 'carga_vazia',
                'message' => "{$cargaVaziaCount} lançamento(s) com carga vazia e frete informado.",
            ];
        }

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
                'total_km_terceiros' => $totalKmTerceiros,
                'total_frete_terceiros' => $totalFreteTerceiros,
                'total_viagens_terceiros' => $totalViagensTerceiros,
                'total_aves' => $totalAves,
                'dias_trabalhados' => $diasTrabalhados,
                'frete_por_caminhao' => $fretePorCaminhao,
                'frete_por_dia_trabalhado' => $fretePorDiaTrabalhado,
                'media_reais_por_km' => $fretePorKm,
                'media_frete_por_km' => $freteLiquidoPorKm,
                'frete_por_km' => $fretePorKm,
                'aves_por_carga' => $avesPorCarga,
                'frete_medio' => $freteMedio,
                'participacao_terceiros' => $participacaoTerceiros,
            ],
            'alerts' => $alerts,
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

        $validated = $request->validate([
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'unidade_ids' => ['nullable', 'array', 'max:100'],
            'unidade_ids.*' => ['integer', 'min:1'],
        ]);

        $startDate = Carbon::createFromFormat(
            'Y-m-d',
            (string) ($validated['start_date'] ?? now()->startOfMonth()->toDateString()),
        )->startOfDay();
        $endDate = Carbon::createFromFormat(
            'Y-m-d',
            (string) ($validated['end_date'] ?? now()->endOfMonth()->toDateString()),
        )->endOfDay();

        if ($startDate->diffInDays($endDate) > 366) {
            return response()->json([
                'message' => 'Intervalo máximo permitido para a timeline é de 366 dias.',
            ], 422);
        }

        $query = $this->queryForUser($request)
            ->whereBetween('data', [$startDate->toDateString(), $endDate->toDateString()]);

        $unidadeIds = collect((array) ($validated['unidade_ids'] ?? []))
            ->map(fn ($value) => (int) $value)
            ->filter(fn ($value) => $value > 0)
            ->values();

        if ($unidadeIds->isNotEmpty()) {
            $query->whereIn('unidade_id', $unidadeIds->all());
        }

        $rows = (clone $query)
            ->selectRaw('unidade_id, data, SUM(frete_total) as total_frete_total')
            ->groupBy('unidade_id', 'data')
            ->orderBy('unidade_id')
            ->orderBy('data')
            ->get();

        $unitNames = Unidade::query()
            ->whereIn('id', $rows->pluck('unidade_id')->unique()->values()->all())
            ->pluck('nome', 'id');

        $series = $rows
            ->groupBy('unidade_id')
            ->map(function ($entries) use ($unitNames): array {
                /** @var FreightEntry $first */
                $first = $entries->first();

                return [
                    'unidade_id' => $first->unidade_id,
                    'unidade_nome' => $unitNames->get((int) $first->unidade_id),
                    'points' => $entries->map(fn (FreightEntry $entry): array => [
                        'data' => $entry->data?->toDateString(),
                        'frete_total' => (float) ($entry->total_frete_total ?? 0),
                    ])->values(),
                ];
            })
            ->values();

        return response()->json([
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'series' => $series,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:500'],
            'unidade_id' => ['nullable', 'integer', 'min:1'],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 15);

        $query = $this->queryForUser($request)
            ->with(['unidade:id,nome', 'autor:id,name,email'])
            ->latest('data')
            ->latest('id');

        if (isset($validated['unidade_id'])) {
            $query->where('unidade_id', (int) $validated['unidade_id']);
        }

        if (isset($validated['start_date'])) {
            $query->whereDate('data', '>=', (string) $validated['start_date']);
        }

        if (isset($validated['end_date'])) {
            $query->whereDate('data', '<=', (string) $validated['end_date']);
        }

        return response()->json($query->paginate($perPage)->withQueryString());
    }

    public function spotIndex(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:500'],
            'unidade_origem_id' => ['nullable', 'integer', 'min:1'],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 15);

        $query = $this->spotQueryForUser($request)
            ->with(['unidadeOrigem:id,nome', 'autor:id,name,email'])
            ->latest('data')
            ->latest('id');

        if (isset($validated['unidade_origem_id'])) {
            $query->where('unidade_origem_id', (int) $validated['unidade_origem_id']);
        }

        if (isset($validated['start_date'])) {
            $query->whereDate('data', '>=', (string) $validated['start_date']);
        }

        if (isset($validated['end_date'])) {
            $query->whereDate('data', '<=', (string) $validated['end_date']);
        }

        return response()->json($query->paginate($perPage)->withQueryString());
    }

    public function storeSpot(StoreFreightSpotEntryRequest $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $validated = $request->validated();

        $entry = FreightSpotEntry::query()->create([
            'data' => (string) $validated['data'],
            'unidade_origem_id' => (int) $validated['unidade_origem_id'],
            'autor_id' => (int) $request->user()->id,
            'frete_spot' => (float) ($validated['frete_spot'] ?? 0),
            'cargas' => (int) ($validated['cargas'] ?? 0),
            'aves' => (int) ($validated['aves'] ?? 0),
            'km_rodado' => (float) ($validated['km_rodado'] ?? 0),
            'obs' => isset($validated['obs']) ? trim((string) $validated['obs']) : null,
        ]);

        return response()->json([
            'data' => $entry->load(['unidadeOrigem:id,nome', 'autor:id,name,email']),
        ], 201);
    }

    public function operationalReport(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        [$month, $year] = $this->monthAndYear($request);

        $baseQuery = $this->queryForUser($request)
            ->whereYear('data', $year)
            ->whereMonth('data', $month);

        $spotQuery = $this->spotQueryForUser($request)
            ->whereYear('data', $year)
            ->whereMonth('data', $month);

        $baseRows = (clone $baseQuery)
            ->selectRaw('unidade_id, SUM(frete_liquido) as frete_liquido_total, SUM(frete_terceiros) as frete_terceiros_total')
            ->with('unidade:id,nome')
            ->groupBy('unidade_id')
            ->get();

        $spotRows = (clone $spotQuery)
            ->selectRaw('unidade_origem_id, SUM(frete_spot) as frete_spot_total')
            ->with('unidadeOrigem:id,nome')
            ->groupBy('unidade_origem_id')
            ->get();

        $abatedouro = $baseRows
            ->map(function (FreightEntry $entry): array {
                $freteLiquido = (float) ($entry->frete_liquido_total ?? 0);
                $freteTerceiros = (float) ($entry->frete_terceiros_total ?? 0);

                return [
                    'unidade_id' => $entry->unidade_id,
                    'unidade_nome' => $entry->unidade?->nome,
                    'frota_no_abatedouro' => $freteLiquido,
                    'terceiros_no_abatedouro' => $freteTerceiros,
                    'total_abatedouro' => $freteLiquido + $freteTerceiros,
                ];
            })
            ->values();

        $frotaMap = [];

        foreach ($baseRows as $entry) {
            $unitId = (int) $entry->unidade_id;
            $frotaMap[$unitId] = [
                'unidade_id' => $unitId,
                'unidade_nome' => $entry->unidade?->nome,
                'dentro' => (float) ($entry->frete_liquido_total ?? 0),
                'fora' => 0.0,
            ];
        }

        foreach ($spotRows as $spot) {
            $unitId = (int) $spot->unidade_origem_id;

            if (! array_key_exists($unitId, $frotaMap)) {
                $frotaMap[$unitId] = [
                    'unidade_id' => $unitId,
                    'unidade_nome' => $spot->unidadeOrigem?->nome,
                    'dentro' => 0.0,
                    'fora' => 0.0,
                ];
            }

            $frotaMap[$unitId]['fora'] += (float) ($spot->frete_spot_total ?? 0);
        }

        $frota = collect($frotaMap)
            ->map(function (array $item): array {
                $dentro = (float) ($item['dentro'] ?? 0);
                $fora = (float) ($item['fora'] ?? 0);

                return [
                    ...$item,
                    'total_frota' => $dentro + $fora,
                ];
            })
            ->sortBy('unidade_nome')
            ->values();

        $totalAbatedouro = $abatedouro->sum('total_abatedouro');
        $totalFrotaDentro = $frota->sum('dentro');
        $totalFrotaFora = $frota->sum('fora');
        $totalFrota = $frota->sum('total_frota');

        return response()->json([
            'competencia_mes' => $month,
            'competencia_ano' => $year,
            'abatedouro' => $abatedouro,
            'frota' => $frota,
            'geral_kaique' => [
                'total_abatedouro' => (float) $totalAbatedouro,
                'frota_dentro' => (float) $totalFrotaDentro,
                'frota_fora' => (float) $totalFrotaFora,
                'total_frota' => (float) $totalFrota,
            ],
        ]);
    }

    public function importSpreadsheet(ImportFreightSpreadsheetRequest $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $uploaded = $request->file('file');

        if (! $uploaded) {
            return response()->json(['message' => 'Arquivo não encontrado.'], 422);
        }

        $path = $uploaded->getRealPath() ?: '';

        if ($path === '' || ! is_file($path)) {
            return response()->json(['message' => 'Arquivo de importação inválido.'], 422);
        }

        try {
            $sheet = IOFactory::load($path)->getActiveSheet();
        } catch (\Throwable) {
            return response()->json(['message' => 'Não foi possível ler o arquivo XLSX.'], 422);
        }

        // Detecta o formato: Kaique (sem cabeçalhos) ou padrão (com cabeçalhos)
        $firstCellValue = trim((string) $sheet->getCell('A1')->getFormattedValue());
        $isKaiqueFormat = strtoupper($firstCellValue) === 'DATA' || 
                         strtoupper($firstCellValue) === 'DATA ENTRADA' ||
                         strtoupper($firstCellValue) === 'DATA LANÇAMENTO';

        if ($isKaiqueFormat) {
            return $this->importKaiqueFormatSpreadsheet($sheet, $request);
        }

        // Continua com o formato padrão
        return $this->importStandardFormatSpreadsheet($sheet, $request);
    }

    public function previewSpreadsheet(ImportFreightSpreadsheetRequest $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $uploaded = $request->file('file');

        if (! $uploaded) {
            return response()->json(['message' => 'Arquivo não encontrado.'], 422);
        }

        $path = $uploaded->getRealPath() ?: '';

        if ($path === '' || ! is_file($path)) {
            return response()->json(['message' => 'Arquivo de importação inválido.'], 422);
        }

        try {
            $sheet = IOFactory::load($path)->getActiveSheet();
        } catch (\Throwable) {
            return response()->json(['message' => 'Não foi possível ler o arquivo XLSX.'], 422);
        }

        $firstCellValue = trim((string) $sheet->getCell('A1')->getFormattedValue());
        $isKaiqueFormat = strtoupper($firstCellValue) === 'DATA' ||
            strtoupper($firstCellValue) === 'DATA ENTRADA' ||
            strtoupper($firstCellValue) === 'DATA LANÇAMENTO';

        if ($isKaiqueFormat) {
            return $this->previewKaiqueFormatSpreadsheet($sheet);
        }

        return $this->previewStandardFormatSpreadsheet($sheet);
    }

    private function importKaiqueFormatSpreadsheet($sheet, ImportFreightSpreadsheetRequest $request): JsonResponse
    {
        // Mapping do formato Kaique: rótulo em coluna A, valor em coluna B
        $cellMap = [
            'B1' => 'data',
            'B2' => 'unidade_id',
            'B3' => 'veiculos',
            'B4' => 'programado_frete',
            'B5' => 'programado_viagens',
            'B6' => 'programado_aves',
            'B7' => 'programado_km',
            'B8' => 'canceladas_sem_escalar_frete',
            'B9' => 'canceladas_sem_escalar_viagens',
            'B10' => 'canceladas_sem_escalar_aves',
            'B11' => 'canceladas_sem_escalar_km',
            'B12' => 'canceladas_escaladas_frete',
            'B13' => 'canceladas_escaladas_viagens',
            'B14' => 'canceladas_escaladas_aves',
            'B15' => 'canceladas_escaladas_km',
            'B16' => 'terceiros_frete',
            'B17' => 'terceiros_viagens',
            'B18' => 'terceiros_aves',
            'B19' => 'km_terceiros',
            'B20' => 'kaique_geral_frete',
            'B21' => 'kaique_geral_viagens',
            'B22' => 'kaique_geral_aves',
            'B23' => 'kaique_geral_km',
            'B24' => 'abatedouro_frete',
            'B25' => 'abatedouro_viagens',
            'B26' => 'abatedouro_aves',
            'B27' => 'abatedouro_km',
        ];

        $unitsByName = Unidade::query()->get()->keyBy(function (Unidade $unidade): string {
            return Str::of((string) $unidade->nome)
                ->lower()
                ->ascii()
                ->replaceMatches('/[^a-z0-9]+/', '')
                ->value();
        });

        $errors = [];
        $imported = 0;
        $skipped = 0;

        // Extrai dados das células
        $data = [];
        foreach ($cellMap as $cellRef => $fieldName) {
            $rawValue = $sheet->getCell($cellRef)->getValue();
            $formatted = $sheet->getCell($cellRef)->getFormattedValue();
            
            if ($fieldName === 'data') {
                $data[$fieldName] = $this->parseSpreadsheetDate($rawValue, (string) $formatted);
            } elseif ($fieldName === 'unidade_id') {
                $unitRaw = trim((string) $formatted);
                $unitKey = Str::of($unitRaw)->lower()->ascii()->replaceMatches('/[^a-z0-9]+/', '')->value();
                $unidade = $unitsByName->get($unitKey);
                
                if (! $unidade) {
                    $errors[] = [
                        'linha' => 2,
                        'erro' => 'Unidade não encontrada no sistema.',
                        'unidade' => $unitRaw,
                    ];
                    $skipped++;
                    return response()->json([
                        'total_lidos' => 1,
                        'total_importados' => $imported,
                        'total_ignorados' => $skipped,
                        'erros' => $errors,
                    ]);
                }
                
                $data[$fieldName] = (int) $unidade->id;
            } elseif (in_array($fieldName, [
                'veiculos',
                'programado_viagens',
                'programado_aves',
                'kaique_geral_viagens',
                'kaique_geral_aves',
                'terceiros_viagens',
                'terceiros_aves',
                'abatedouro_viagens',
                'abatedouro_aves',
                'canceladas_sem_escalar_viagens',
                'canceladas_sem_escalar_aves',
                'canceladas_escaladas_viagens',
                'canceladas_escaladas_aves',
            ], true)) {
                $data[$fieldName] = $this->parseSpreadsheetInteger($rawValue);
            } else {
                $data[$fieldName] = $this->parseSpreadsheetNumber($rawValue);
            }
        }

        if (! $data['data']) {
            $errors[] = ['linha' => 1, 'erro' => 'Data inválida na célula B1.'];
            $skipped++;
            return response()->json([
                'total_lidos' => 1,
                'total_importados' => $imported,
                'total_ignorados' => $skipped,
                'erros' => $errors,
            ]);
        }

        // Normaliza o payload
        $payload = $this->normalizePayload([
            'data' => $data['data'],
            'unidade_id' => $data['unidade_id'],
            'veiculos' => $data['veiculos'] ?? 0,
            'programado_frete' => $data['programado_frete'] ?? 0,
            'programado_viagens' => $data['programado_viagens'] ?? 0,
            'programado_aves' => $data['programado_aves'] ?? 0,
            'programado_km' => $data['programado_km'] ?? 0,
            'canceladas_sem_escalar_frete' => $data['canceladas_sem_escalar_frete'] ?? 0,
            'canceladas_sem_escalar_viagens' => $data['canceladas_sem_escalar_viagens'] ?? 0,
            'canceladas_sem_escalar_aves' => $data['canceladas_sem_escalar_aves'] ?? 0,
            'canceladas_sem_escalar_km' => $data['canceladas_sem_escalar_km'] ?? 0,
            'canceladas_escaladas_frete' => $data['canceladas_escaladas_frete'] ?? 0,
            'canceladas_escaladas_viagens' => $data['canceladas_escaladas_viagens'] ?? 0,
            'canceladas_escaladas_aves' => $data['canceladas_escaladas_aves'] ?? 0,
            'canceladas_escaladas_km' => $data['canceladas_escaladas_km'] ?? 0,
            'terceiros_frete' => $data['terceiros_frete'] ?? 0,
            'terceiros_viagens' => $data['terceiros_viagens'] ?? 0,
            'terceiros_aves' => $data['terceiros_aves'] ?? 0,
            'km_terceiros' => $data['km_terceiros'] ?? 0,
            'kaique_geral_frete' => $data['kaique_geral_frete'] ?? 0,
            'kaique_geral_viagens' => $data['kaique_geral_viagens'] ?? 0,
            'kaique_geral_aves' => $data['kaique_geral_aves'] ?? 0,
            'kaique_geral_km' => $data['kaique_geral_km'] ?? 0,
            'abatedouro_frete' => $data['abatedouro_frete'] ?? 0,
            'abatedouro_viagens' => $data['abatedouro_viagens'] ?? 0,
            'abatedouro_aves' => $data['abatedouro_aves'] ?? 0,
            'abatedouro_km' => $data['abatedouro_km'] ?? 0,
            'obs' => null,
            'kaique' => 0,
            'vdm' => 0,
            'placas' => null,
        ]);

        // Verifica se já existe entrada para essa data/unidade
        $entry = FreightEntry::query()
            ->whereDate('data', $payload['data'])
            ->where('unidade_id', (int) $payload['unidade_id'])
            ->first();

        if ($entry) {
            $entry->update($payload + ['autor_id' => (int) $request->user()->id]);
        } else {
            $entry = FreightEntry::query()->create($payload + ['autor_id' => (int) $request->user()->id]);
        }

        $imported++;

        // Processa cargas canceladas escaladas (linhas 30+)
        $canceledCount = (int) ($data['canceladas_escaladas_viagens'] ?? 0);
        $canceledLoads = [];
        
        for ($row = 30; $row < 30 + $canceledCount; $row++) {
            $aviarioCell = trim((string) $sheet->getCell('A' . $row)->getFormattedValue());
            $placaCell = trim((string) $sheet->getCell('C' . $row)->getFormattedValue());
            $freteCell = $sheet->getCell('D' . $row)->getValue();
            
            if ($aviarioCell !== '' || $placaCell !== '' || $freteCell !== null) {
                $canceledLoads[] = [
                    'aviario' => $aviarioCell,
                    'placa' => $placaCell,
                    'valor' => $this->parseSpreadsheetNumber($freteCell),
                ];
            }
        }

        $this->syncCanceledLoads($entry, $canceledLoads, (int) $request->user()->id);

        return response()->json([
            'total_lidos' => 1,
            'total_importados' => $imported,
            'total_ignorados' => $skipped,
            'erros' => $errors,
        ]);
    }

    private function importStandardFormatSpreadsheet($sheet, ImportFreightSpreadsheetRequest $request): JsonResponse
    {
        $highestDataRow = (int) $sheet->getHighestDataRow();
        $highestColumn = $sheet->getHighestDataColumn();
        $highestColumnIndex = (int) \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($highestColumn);

        if ($highestDataRow < 2) {
            return response()->json(['message' => 'A planilha não possui dados para importar.'], 422);
        }

        $headerMap = [];

        for ($column = 1; $column <= $highestColumnIndex; $column++) {
            $header = (string) $sheet->getCellByColumnAndRow($column, 1)->getFormattedValue();
            $normalized = $this->normalizeSpreadsheetHeader($header);

            if ($normalized !== '') {
                $headerMap[$normalized] = $column;
            }
        }

        if (! isset($headerMap['data']) || ! isset($headerMap['unidade']) || ! isset($headerMap['frete_total'])) {
            return response()->json([
                'message' => 'Cabeçalhos obrigatórios ausentes. Use pelo menos: data, unidade, frete_total.',
            ], 422);
        }

        $unitsByName = Unidade::query()->get()->keyBy(function (Unidade $unidade): string {
            return Str::of((string) $unidade->nome)
                ->lower()
                ->ascii()
                ->replaceMatches('/[^a-z0-9]+/', '')
                ->value();
        });

        $imported = 0;
        $skipped = 0;
        $totalRead = 0;
        $errors = [];

        for ($line = 2; $line <= $highestDataRow; $line++) {
            $rowValues = [];

            for ($column = 1; $column <= $highestColumnIndex; $column++) {
                $rowValues[] = trim((string) $sheet->getCellByColumnAndRow($column, $line)->getFormattedValue());
            }

            if ($this->isSpreadsheetRowEmpty($rowValues)) {
                continue;
            }

            $totalRead++;

            $unitRaw = trim((string) $sheet->getCellByColumnAndRow($headerMap['unidade'], $line)->getFormattedValue());
            $unitKey = Str::of($unitRaw)->lower()->ascii()->replaceMatches('/[^a-z0-9]+/', '')->value();
            $unidade = $unitsByName->get($unitKey);

            if (! $unidade) {
                $skipped++;
                $errors[] = [
                    'linha' => $line,
                    'erro' => 'Unidade não encontrada no sistema.',
                    'unidade' => $unitRaw,
                ];
                continue;
            }

            $dateCell = $sheet->getCellByColumnAndRow($headerMap['data'], $line);
            $date = $this->parseSpreadsheetDate($dateCell->getValue(), (string) $dateCell->getFormattedValue());

            if (! $date) {
                $skipped++;
                $errors[] = [
                    'linha' => $line,
                    'erro' => 'Data inválida.',
                ];
                continue;
            }

            $raw = fn (string $header): mixed => isset($headerMap[$header])
                ? $sheet->getCellByColumnAndRow($headerMap[$header], $line)->getValue()
                : null;

            $payload = $this->normalizePayload([
                'data' => $date,
                'unidade_id' => (int) $unidade->id,
                'frete_total' => $this->parseSpreadsheetNumber($raw('frete_total')),
                'cargas' => $this->parseSpreadsheetInteger($raw('cargas')),
                'aves' => $this->parseSpreadsheetInteger($raw('aves')),
                'veiculos' => $this->parseSpreadsheetInteger($raw('veiculos')),
                'km_rodado' => $this->parseSpreadsheetNumber($raw('km_rodado')),
                'km_terceiros' => $this->parseSpreadsheetNumber($raw('km_terceiros')),
                'frete_terceiros' => $this->parseSpreadsheetNumber($raw('frete_terceiros')),
                'viagens_terceiros' => $this->parseSpreadsheetInteger($raw('viagens_terceiros')),
                'aves_terceiros' => $this->parseSpreadsheetInteger($raw('aves_terceiros')),
                'frete_programado' => $this->parseSpreadsheetNumber($raw('frete_programado')),
                'km_programado' => $this->parseSpreadsheetNumber($raw('km_programado')),
                'cargas_programadas' => $this->parseSpreadsheetInteger($raw('cargas_programadas')),
                'aves_programadas' => $this->parseSpreadsheetInteger($raw('aves_programadas')),
                'cargas_canceladas_escaladas' => $this->parseSpreadsheetInteger($raw('cargas_canceladas_escaladas')),
                'nao_escaladas' => $this->parseSpreadsheetInteger($raw('nao_escaladas')),
                'obs' => is_string($raw('obs')) ? trim((string) $raw('obs')) : null,
                'kaique' => 0,
                'vdm' => 0,
                'placas' => null,
            ]);

            $entry = FreightEntry::query()
                ->whereDate('data', $date)
                ->where('unidade_id', (int) $unidade->id)
                ->first();

            if ($entry) {
                $entry->update($payload + ['autor_id' => (int) $request->user()->id]);
            } else {
                FreightEntry::query()->create($payload + ['autor_id' => (int) $request->user()->id]);
            }

            $imported++;
        }

        return response()->json([
            'total_lidos' => $totalRead,
            'total_importados' => $imported,
            'total_ignorados' => $skipped,
            'erros' => $errors,
        ]);
    }

    private function previewKaiqueFormatSpreadsheet($sheet): JsonResponse
    {
        $cellMap = [
            'B1' => 'data',
            'B2' => 'unidade_id',
            'B3' => 'veiculos',
            'B4' => 'programado_frete',
            'B5' => 'programado_viagens',
            'B6' => 'programado_aves',
            'B7' => 'programado_km',
            'B8' => 'canceladas_sem_escalar_frete',
            'B9' => 'canceladas_sem_escalar_viagens',
            'B10' => 'canceladas_sem_escalar_aves',
            'B11' => 'canceladas_sem_escalar_km',
            'B12' => 'canceladas_escaladas_frete',
            'B13' => 'canceladas_escaladas_viagens',
            'B14' => 'canceladas_escaladas_aves',
            'B15' => 'canceladas_escaladas_km',
            'B16' => 'terceiros_frete',
            'B17' => 'terceiros_viagens',
            'B18' => 'terceiros_aves',
            'B19' => 'km_terceiros',
            'B20' => 'kaique_geral_frete',
            'B21' => 'kaique_geral_viagens',
            'B22' => 'kaique_geral_aves',
            'B23' => 'kaique_geral_km',
            'B24' => 'abatedouro_frete',
            'B25' => 'abatedouro_viagens',
            'B26' => 'abatedouro_aves',
            'B27' => 'abatedouro_km',
        ];

        $unitsByName = Unidade::query()->get()->keyBy(function (Unidade $unidade): string {
            return Str::of((string) $unidade->nome)
                ->lower()
                ->ascii()
                ->replaceMatches('/[^a-z0-9]+/', '')
                ->value();
        });

        $data = [];

        foreach ($cellMap as $cellRef => $fieldName) {
            $rawValue = $sheet->getCell($cellRef)->getValue();
            $formatted = $sheet->getCell($cellRef)->getFormattedValue();

            if ($fieldName === 'data') {
                $data[$fieldName] = $this->parseSpreadsheetDate($rawValue, (string) $formatted);
                continue;
            }

            if ($fieldName === 'unidade_id') {
                $unitRaw = trim((string) $formatted);
                $unitKey = Str::of($unitRaw)->lower()->ascii()->replaceMatches('/[^a-z0-9]+/', '')->value();
                $unidade = $unitsByName->get($unitKey);

                if (! $unidade) {
                    return response()->json([
                        'message' => 'Unidade da planilha não encontrada no sistema.',
                    ], 422);
                }

                $data[$fieldName] = (int) $unidade->id;
                continue;
            }

            if (in_array($fieldName, [
                'veiculos',
                'programado_viagens',
                'programado_aves',
                'kaique_geral_viagens',
                'kaique_geral_aves',
                'terceiros_viagens',
                'terceiros_aves',
                'abatedouro_viagens',
                'abatedouro_aves',
                'canceladas_sem_escalar_viagens',
                'canceladas_sem_escalar_aves',
                'canceladas_escaladas_viagens',
                'canceladas_escaladas_aves',
            ], true)) {
                $data[$fieldName] = $this->parseSpreadsheetInteger($rawValue);
                continue;
            }

            $data[$fieldName] = $this->parseSpreadsheetNumber($rawValue);
        }

        if (! ($data['data'] ?? null)) {
            return response()->json([
                'message' => 'Data inválida na célula B1.',
            ], 422);
        }

        $payload = $this->normalizePayload([
            'data' => $data['data'],
            'unidade_id' => $data['unidade_id'],
            'veiculos' => $data['veiculos'] ?? 0,
            'programado_frete' => $data['programado_frete'] ?? 0,
            'programado_viagens' => $data['programado_viagens'] ?? 0,
            'programado_aves' => $data['programado_aves'] ?? 0,
            'programado_km' => $data['programado_km'] ?? 0,
            'canceladas_sem_escalar_frete' => $data['canceladas_sem_escalar_frete'] ?? 0,
            'canceladas_sem_escalar_viagens' => $data['canceladas_sem_escalar_viagens'] ?? 0,
            'canceladas_sem_escalar_aves' => $data['canceladas_sem_escalar_aves'] ?? 0,
            'canceladas_sem_escalar_km' => $data['canceladas_sem_escalar_km'] ?? 0,
            'canceladas_escaladas_frete' => $data['canceladas_escaladas_frete'] ?? 0,
            'canceladas_escaladas_viagens' => $data['canceladas_escaladas_viagens'] ?? 0,
            'canceladas_escaladas_aves' => $data['canceladas_escaladas_aves'] ?? 0,
            'canceladas_escaladas_km' => $data['canceladas_escaladas_km'] ?? 0,
            'terceiros_frete' => $data['terceiros_frete'] ?? 0,
            'terceiros_viagens' => $data['terceiros_viagens'] ?? 0,
            'terceiros_aves' => $data['terceiros_aves'] ?? 0,
            'km_terceiros' => $data['km_terceiros'] ?? 0,
            'kaique_geral_frete' => $data['kaique_geral_frete'] ?? 0,
            'kaique_geral_viagens' => $data['kaique_geral_viagens'] ?? 0,
            'kaique_geral_aves' => $data['kaique_geral_aves'] ?? 0,
            'kaique_geral_km' => $data['kaique_geral_km'] ?? 0,
            'abatedouro_frete' => $data['abatedouro_frete'] ?? 0,
            'abatedouro_viagens' => $data['abatedouro_viagens'] ?? 0,
            'abatedouro_aves' => $data['abatedouro_aves'] ?? 0,
            'abatedouro_km' => $data['abatedouro_km'] ?? 0,
            'obs' => null,
            'kaique' => 0,
            'vdm' => 0,
            'placas' => null,
        ]);

        $canceledCount = (int) ($data['canceladas_escaladas_viagens'] ?? 0);
        $canceledLoads = [];

        for ($row = 30; $row < 30 + $canceledCount; $row++) {
            $aviarioCell = trim((string) $sheet->getCell('A'.$row)->getFormattedValue());
            $placaCell = trim((string) $sheet->getCell('C'.$row)->getFormattedValue());
            $freteCell = $sheet->getCell('D'.$row)->getValue();

            if ($aviarioCell !== '' || $placaCell !== '' || $freteCell !== null) {
                $canceledLoads[] = [
                    'aviario' => $aviarioCell,
                    'placa' => strtoupper($placaCell),
                    'valor' => $this->parseSpreadsheetNumber($freteCell),
                    'obs' => null,
                ];
            }
        }

        return response()->json([
            'message' => 'Planilha lida com sucesso. Campos preenchidos para conferência.',
            'source_format' => 'kaique',
            'prefill' => $payload,
            'cargas_canceladas_detalhes' => $canceledLoads,
            'warnings' => [],
        ]);
    }

    private function previewStandardFormatSpreadsheet($sheet): JsonResponse
    {
        $highestDataRow = (int) $sheet->getHighestDataRow();
        $highestColumn = $sheet->getHighestDataColumn();
        $highestColumnIndex = (int) \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($highestColumn);

        if ($highestDataRow < 2) {
            return response()->json(['message' => 'A planilha não possui dados para importar.'], 422);
        }

        $headerMap = [];

        for ($column = 1; $column <= $highestColumnIndex; $column++) {
            $header = (string) $sheet->getCellByColumnAndRow($column, 1)->getFormattedValue();
            $normalized = $this->normalizeSpreadsheetHeader($header);

            if ($normalized !== '') {
                $headerMap[$normalized] = $column;
            }
        }

        if (! isset($headerMap['data']) || ! isset($headerMap['unidade']) || ! isset($headerMap['frete_total'])) {
            return response()->json([
                'message' => 'Cabeçalhos obrigatórios ausentes. Use pelo menos: data, unidade, frete_total.',
            ], 422);
        }

        $unitsByName = Unidade::query()->get()->keyBy(function (Unidade $unidade): string {
            return Str::of((string) $unidade->nome)
                ->lower()
                ->ascii()
                ->replaceMatches('/[^a-z0-9]+/', '')
                ->value();
        });

        $targetLine = null;

        for ($line = 2; $line <= $highestDataRow; $line++) {
            $rowValues = [];

            for ($column = 1; $column <= $highestColumnIndex; $column++) {
                $rowValues[] = trim((string) $sheet->getCellByColumnAndRow($column, $line)->getFormattedValue());
            }

            if (! $this->isSpreadsheetRowEmpty($rowValues)) {
                $targetLine = $line;
                break;
            }
        }

        if (! $targetLine) {
            return response()->json(['message' => 'A planilha não possui linhas válidas para pré-preenchimento.'], 422);
        }

        $unitRaw = trim((string) $sheet->getCellByColumnAndRow($headerMap['unidade'], $targetLine)->getFormattedValue());
        $unitKey = Str::of($unitRaw)->lower()->ascii()->replaceMatches('/[^a-z0-9]+/', '')->value();
        $unidade = $unitsByName->get($unitKey);

        if (! $unidade) {
            return response()->json([
                'message' => 'Unidade da planilha não encontrada no sistema.',
            ], 422);
        }

        $dateCell = $sheet->getCellByColumnAndRow($headerMap['data'], $targetLine);
        $date = $this->parseSpreadsheetDate($dateCell->getValue(), (string) $dateCell->getFormattedValue());

        if (! $date) {
            return response()->json([
                'message' => 'Data inválida na linha selecionada da planilha.',
            ], 422);
        }

        $raw = fn (string $header): mixed => isset($headerMap[$header])
            ? $sheet->getCellByColumnAndRow($headerMap[$header], $targetLine)->getValue()
            : null;

        $payload = $this->normalizePayload([
            'data' => $date,
            'unidade_id' => (int) $unidade->id,
            'frete_total' => $this->parseSpreadsheetNumber($raw('frete_total')),
            'cargas' => $this->parseSpreadsheetInteger($raw('cargas')),
            'aves' => $this->parseSpreadsheetInteger($raw('aves')),
            'veiculos' => $this->parseSpreadsheetInteger($raw('veiculos')),
            'km_rodado' => $this->parseSpreadsheetNumber($raw('km_rodado')),
            'km_terceiros' => $this->parseSpreadsheetNumber($raw('km_terceiros')),
            'frete_terceiros' => $this->parseSpreadsheetNumber($raw('frete_terceiros')),
            'viagens_terceiros' => $this->parseSpreadsheetInteger($raw('viagens_terceiros')),
            'aves_terceiros' => $this->parseSpreadsheetInteger($raw('aves_terceiros')),
            'frete_programado' => $this->parseSpreadsheetNumber($raw('frete_programado')),
            'km_programado' => $this->parseSpreadsheetNumber($raw('km_programado')),
            'cargas_programadas' => $this->parseSpreadsheetInteger($raw('cargas_programadas')),
            'aves_programadas' => $this->parseSpreadsheetInteger($raw('aves_programadas')),
            'cargas_canceladas_escaladas' => $this->parseSpreadsheetInteger($raw('cargas_canceladas_escaladas')),
            'nao_escaladas' => $this->parseSpreadsheetInteger($raw('nao_escaladas')),
            'obs' => is_string($raw('obs')) ? trim((string) $raw('obs')) : null,
            'kaique' => 0,
            'vdm' => 0,
            'placas' => null,
        ]);

        return response()->json([
            'message' => 'Planilha lida com sucesso. Campos preenchidos para conferência.',
            'source_format' => 'standard',
            'prefill' => $payload,
            'cargas_canceladas_detalhes' => [],
            'warnings' => [
                'No formato padrão, foi usada apenas a primeira linha válida para preencher o formulário.',
            ],
        ]);
    }

    public function store(StoreFreightEntryRequest $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $validated = $request->validated();
        $canceledDetails = (array) ($validated['cargas_canceladas_detalhes'] ?? []);
        $data = $this->normalizePayload($validated);

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

        $this->syncCanceledLoads($entry, $canceledDetails, (int) $request->user()->id);

        return response()->json([
            'data' => $entry->load(['unidade:id,nome', 'autor:id,name,email']),
        ], 201);
    }

    public function update(UpdateFreightEntryRequest $request, FreightEntry $freightEntry): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $validated = $request->validated();
        $canceledDetails = (array) ($validated['cargas_canceladas_detalhes'] ?? []);
        $data = $this->normalizePayload($validated);

        $freightEntry->update($data + ['autor_id' => (int) $request->user()->id]);

        $this->syncCanceledLoads($freightEntry, $canceledDetails, (int) $request->user()->id);

        return response()->json([
            'data' => $freightEntry->refresh()->load(['unidade:id,nome', 'autor:id,name,email']),
        ]);
    }

    public function destroy(Request $request, FreightEntry $freightEntry): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $freightEntry->delete();

        return response()->json([], 204);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalizePayload(array $data): array
    {
        $programadoFrete = $this->pickFloat($data, ['programado_frete', 'frete_programado']);
        $programadoViagens = $this->pickInt($data, ['programado_viagens', 'cargas_programadas']);
        $programadoAves = $this->pickInt($data, ['programado_aves', 'aves_programadas']);
        $programadoKm = $this->pickFloat($data, ['programado_km', 'km_programado']);

        $kaiqueFrete = $this->pickFloat($data, ['kaique_geral_frete', 'frete_total']);
        $kaiqueViagens = $this->pickInt($data, ['kaique_geral_viagens', 'cargas']);
        $kaiqueAves = $this->pickInt($data, ['kaique_geral_aves', 'aves']);
        $kaiqueKm = $this->pickFloat($data, ['kaique_geral_km', 'km_rodado']);

        $terceirosFrete = $this->pickFloat($data, ['terceiros_frete', 'frete_terceiros']);
        $terceirosViagens = $this->pickInt($data, ['terceiros_viagens', 'viagens_terceiros']);
        $terceirosAves = $this->pickInt($data, ['terceiros_aves', 'aves_terceiros']);
        $terceirosKm = $this->pickFloat($data, ['terceiros_km', 'km_terceiros']);

        $abatedouroFreteFromInput = $this->pickFloat($data, ['abatedouro_frete', 'frete_liquido']);
        $abatedouroViagensFromInput = $this->pickInt($data, ['abatedouro_viagens', 'cargas_liq']);
        $abatedouroAvesFromInput = $this->pickInt($data, ['abatedouro_aves', 'aves_liq']);
        $abatedouroKm = $this->pickFloat($data, ['abatedouro_km']);

        $canceladasSemEscalarFrete = $this->pickFloat($data, ['canceladas_sem_escalar_frete']);
        $canceladasSemEscalarViagens = $this->pickInt($data, ['canceladas_sem_escalar_viagens', 'nao_escaladas']);
        $canceladasSemEscalarAves = $this->pickInt($data, ['canceladas_sem_escalar_aves']);
        $canceladasSemEscalarKm = $this->pickFloat($data, ['canceladas_sem_escalar_km']);

        $canceladasEscaladasFrete = $this->pickFloat($data, ['canceladas_escaladas_frete']);
        $canceladasEscaladasViagens = $this->pickInt($data, ['canceladas_escaladas_viagens', 'cargas_canceladas_escaladas']);
        $canceladasEscaladasAves = $this->pickInt($data, ['canceladas_escaladas_aves']);
        $canceladasEscaladasKm = $this->pickFloat($data, ['canceladas_escaladas_km']);

        $abatedouroFrete = $this->hasAnyValue($data, ['abatedouro_frete', 'frete_liquido'])
            ? $abatedouroFreteFromInput
            : max(0, $kaiqueFrete - $terceirosFrete);

        $abatedouroViagens = $this->hasAnyValue($data, ['abatedouro_viagens', 'cargas_liq'])
            ? $abatedouroViagensFromInput
            : max(0, $kaiqueViagens - $terceirosViagens);

        $abatedouroAves = $this->hasAnyValue($data, ['abatedouro_aves', 'aves_liq'])
            ? $abatedouroAvesFromInput
            : max(0, $kaiqueAves - $terceirosAves);

        $resolvedProgramadoKm = $programadoKm > 0 ? $programadoKm : $kaiqueKm;

        return [
            ...$data,
            'frete_total' => $kaiqueFrete,
            'cargas' => $kaiqueViagens,
            'aves' => $kaiqueAves,
            'veiculos' => (int) ($data['veiculos'] ?? 0),
            'km_rodado' => $kaiqueKm,
            'km_terceiros' => $terceirosKm,
            'frete_terceiros' => $terceirosFrete,
            'viagens_terceiros' => $terceirosViagens,
            'aves_terceiros' => $terceirosAves,
            'frete_liquido' => $abatedouroFrete,
            'cargas_liq' => $abatedouroViagens,
            'aves_liq' => $abatedouroAves,
            'kaique' => (float) ($data['kaique'] ?? 0),
            'vdm' => (float) ($data['vdm'] ?? 0),
            'frete_programado' => $programadoFrete,
            'km_programado' => $resolvedProgramadoKm,
            'cargas_programadas' => $programadoViagens,
            'aves_programadas' => $programadoAves,
            'cargas_canceladas_escaladas' => $canceladasEscaladasViagens,
            'nao_escaladas' => $canceladasSemEscalarViagens,

            'programado_frete' => $programadoFrete,
            'programado_viagens' => $programadoViagens,
            'programado_aves' => $programadoAves,
            'programado_km' => $resolvedProgramadoKm,

            'kaique_geral_frete' => $kaiqueFrete,
            'kaique_geral_viagens' => $kaiqueViagens,
            'kaique_geral_aves' => $kaiqueAves,
            'kaique_geral_km' => $kaiqueKm,

            'terceiros_frete' => $terceirosFrete,
            'terceiros_viagens' => $terceirosViagens,
            'terceiros_aves' => $terceirosAves,
            'terceiros_km' => $terceirosKm,

            'abatedouro_frete' => $abatedouroFrete,
            'abatedouro_viagens' => $abatedouroViagens,
            'abatedouro_aves' => $abatedouroAves,
            'abatedouro_km' => $abatedouroKm,

            'canceladas_sem_escalar_frete' => $canceladasSemEscalarFrete,
            'canceladas_sem_escalar_viagens' => $canceladasSemEscalarViagens,
            'canceladas_sem_escalar_aves' => $canceladasSemEscalarAves,
            'canceladas_sem_escalar_km' => $canceladasSemEscalarKm,

            'canceladas_escaladas_frete' => $canceladasEscaladasFrete,
            'canceladas_escaladas_viagens' => $canceladasEscaladasViagens,
            'canceladas_escaladas_aves' => $canceladasEscaladasAves,
            'canceladas_escaladas_km' => $canceladasEscaladasKm,

            'placas' => isset($data['placas']) ? trim((string) $data['placas']) : null,
            'obs' => isset($data['obs']) ? trim(strip_tags((string) $data['obs'])) : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<int, string>  $keys
     */
    private function pickFloat(array $data, array $keys, float $default = 0.0): float
    {
        foreach ($keys as $key) {
            if ($this->hasValue($data, $key)) {
                return (float) $data[$key];
            }
        }

        return $default;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<int, string>  $keys
     */
    private function pickInt(array $data, array $keys, int $default = 0): int
    {
        foreach ($keys as $key) {
            if ($this->hasValue($data, $key)) {
                return (int) $data[$key];
            }
        }

        return $default;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<int, string>  $keys
     */
    private function hasAnyValue(array $data, array $keys): bool
    {
        foreach ($keys as $key) {
            if ($this->hasValue($data, $key)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function hasValue(array $data, string $key): bool
    {
        return array_key_exists($key, $data) && $data[$key] !== null && $data[$key] !== '';
    }

    /**
     * @param  array<int, array<string, mixed>>  $details
     */
    private function syncCanceledLoads(FreightEntry $entry, array $details, int $autorId): void
    {
        $entry->canceledLoads()
            ->where('status', 'a_receber')
            ->delete();

        collect($details)
            ->map(fn (array $item): array => [
                'placa' => strtoupper(trim(strip_tags((string) ($item['placa'] ?? '')))),
                'aviario' => trim(strip_tags((string) ($item['aviario'] ?? ''))),
                'valor' => (float) ($item['valor'] ?? 0),
                'obs' => trim(strip_tags((string) ($item['obs'] ?? ''))),
            ])
            ->filter(fn (array $item): bool => $item['placa'] !== '' || $item['aviario'] !== '' || $item['valor'] > 0 || $item['obs'] !== '')
            ->values()
            ->each(function (array $item) use ($entry, $autorId): void {
                FreightCanceledLoad::query()->create([
                    'freight_entry_id' => $entry->id,
                    'unidade_id' => $entry->unidade_id,
                    'autor_id' => $autorId,
                    'data' => $entry->data,
                    'placa' => $item['placa'] !== '' ? $item['placa'] : '-',
                    'aviario' => $item['aviario'] !== '' ? $item['aviario'] : null,
                    'valor' => $item['valor'],
                    'obs' => $item['obs'] !== '' ? $item['obs'] : null,
                    'status' => 'a_receber',
                ]);
            });
    }

    private function queryForUser(Request $request): Builder
    {
        $query = FreightEntry::query();

        if ($request->user()?->isMasterAdmin()) {
            return $query;
        }

        return $query->where('autor_id', $request->user()->id);
    }

    private function spotQueryForUser(Request $request): Builder
    {
        $query = FreightSpotEntry::query();

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

    private function normalizeSpreadsheetHeader(string $header): string
    {
        $normalized = Str::of($header)
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_')
            ->value();

        $aliases = [
            'unidade_nome' => 'unidade',
            'valor_frete' => 'frete_total',
            'frete' => 'frete_total',
            'km' => 'km_rodado',
            'km_rodados' => 'km_rodado',
        ];

        return $aliases[$normalized] ?? $normalized;
    }

    private function parseSpreadsheetDate(mixed $rawValue, string $formatted): ?string
    {
        if ($rawValue !== null && $rawValue !== '' && is_numeric($rawValue)) {
            try {
                return Carbon::instance(SpreadsheetDate::excelToDateTimeObject((float) $rawValue))->toDateString();
            } catch (\Throwable) {
                // noop
            }
        }

        $formattedValue = trim($formatted);

        if ($formattedValue === '') {
            return null;
        }

        $supported = ['d/m/Y', 'd-m-Y', 'Y-m-d', 'd/m/y'];

        foreach ($supported as $pattern) {
            try {
                return Carbon::createFromFormat($pattern, $formattedValue)->toDateString();
            } catch (\Throwable) {
                // noop
            }
        }

        try {
            return Carbon::parse($formattedValue)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    private function parseSpreadsheetNumber(mixed $value): float
    {
        if ($value === null || $value === '') {
            return 0.0;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        $normalized = str_replace(['.', ','], ['', '.'], (string) $value);

        return is_numeric($normalized) ? (float) $normalized : 0.0;
    }

    private function parseSpreadsheetInteger(mixed $value): int
    {
        return (int) round($this->parseSpreadsheetNumber($value));
    }

    /**
     * @param  array<int, string>  $values
     */
    private function isSpreadsheetRowEmpty(array $values): bool
    {
        foreach ($values as $value) {
            if (trim($value) !== '') {
                return false;
            }
        }

        return true;
    }
}
