<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ImportProgrammingSpreadsheetRequest;
use App\Models\Colaborador;
use App\Models\PlacaFrota;
use App\Models\ProgramacaoEscala;
use App\Models\ProgramacaoViagem;
use App\Models\Unidade;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as SpreadsheetDate;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class ProgrammingController extends Controller
{
    /**
     * @var array<string, array<int, int>>
     */
    private array $tripSequenceCache = [];

    /**
     * @var array<string, array<int, int>>
     */
    private array $tripImportSequenceCache = [];

    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->hasPermission('programming.dashboard.view'), 403);

        $validated = $request->validate([
            'unidade_id' => ['nullable', 'integer', 'min:1'],
            'data' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $selectedDate = (string) ($validated['data'] ?? now()->toDateString());
        $requestedUnitId = (int) ($validated['unidade_id'] ?? 0);
        $allowedUnitIds = $this->allowedProgrammingUnitIds($request);

        $units = Unidade::query()
            ->when(
                $user?->dataScopeFor('programming') === 'units',
                fn ($query) => $query->whereIn('id', $allowedUnitIds !== [] ? $allowedUnitIds : [0]),
            )
            ->orderBy('nome')
            ->get(['id', 'nome']);

        $selectedUnitId = $requestedUnitId;

        if ($selectedUnitId > 0 && ! $units->contains('id', $selectedUnitId)) {
            $selectedUnitId = 0;
        }

        if ($selectedUnitId <= 0 && $units->isNotEmpty()) {
            $selectedUnitId = (int) $units->first()->id;
        }

        $effectiveDate = $selectedDate;

        $hasTripsOnSelectedDate = ProgramacaoViagem::query()
            ->whereDate('data_viagem', $selectedDate)
            ->when($selectedUnitId > 0, fn ($query) => $query->where('unidade_id', $selectedUnitId))
            ->exists();

        if (! $hasTripsOnSelectedDate) {
            $fallbackDate = ProgramacaoViagem::query()
                ->when($selectedUnitId > 0, fn ($query) => $query->where('unidade_id', $selectedUnitId))
                ->orderByDesc('data_viagem')
                ->value('data_viagem');

            if ($fallbackDate !== null && trim((string) $fallbackDate) !== '') {
                $effectiveDate = $this->normalizeDateOnly($fallbackDate) ?? $effectiveDate;
            }
        }

        $driversCollection = Colaborador::query()
            ->with('funcao:id,nome')
            ->where('ativo', true)
            ->whereHas('funcao', function ($query): void {
                $query->whereRaw('LOWER(nome) like ?', ['%motorista%']);
            })
            ->when($selectedUnitId > 0, fn ($query) => $query->where('unidade_id', $selectedUnitId))
            ->orderBy('nome')
            ->get(['id', 'nome', 'funcao_id', 'unidade_id', 'cnh']);

        $trucksCollection = PlacaFrota::query()
            ->when($selectedUnitId > 0, fn ($query) => $query->where('unidade_id', $selectedUnitId))
            ->orderBy('placa')
            ->get(['id', 'placa', 'unidade_id']);

        $assignedDriverIds = ProgramacaoEscala::query()
            ->whereHas('viagem', function ($query) use ($effectiveDate, $selectedUnitId): void {
                $query
                    ->whereDate('data_viagem', $effectiveDate)
                    ->when($selectedUnitId > 0, fn ($subQuery) => $subQuery->where('unidade_id', $selectedUnitId));
            })
            ->pluck('colaborador_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $assignedTruckIds = ProgramacaoEscala::query()
            ->whereHas('viagem', function ($query) use ($effectiveDate, $selectedUnitId): void {
                $query
                    ->whereDate('data_viagem', $effectiveDate)
                    ->when($selectedUnitId > 0, fn ($subQuery) => $subQuery->where('unidade_id', $selectedUnitId));
            })
            ->pluck('placa_frota_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $trips = ProgramacaoViagem::query()
            ->with([
                'unidade:id,nome',
                'escala.colaborador:id,nome',
                'escala.placaFrota:id,placa',
            ])
            ->whereDate('data_viagem', $effectiveDate)
            ->when($selectedUnitId > 0, fn ($query) => $query->where('unidade_id', $selectedUnitId))
            ->orderBy('id')
            ->get();

        $dailyHoursByDriver = ProgramacaoEscala::query()
            ->join('programacao_viagens', 'programacao_viagens.id', '=', 'programacao_escalas.programacao_viagem_id')
            ->selectRaw('programacao_escalas.colaborador_id, SUM(programacao_viagens.jornada_horas_prevista) as total_horas')
            ->whereDate('programacao_viagens.data_viagem', $effectiveDate)
            ->when($selectedUnitId > 0, fn ($query) => $query->where('programacao_viagens.unidade_id', $selectedUnitId))
            ->groupBy('programacao_escalas.colaborador_id')
            ->pluck('total_horas', 'programacao_escalas.colaborador_id');

        $driverAlerts = [];
        $tripRows = [];

        foreach ($trips as $trip) {
            $scale = $trip->escala;
            $interjornadaAlert = null;
            $tripStartTime = $this->normalizeTimeValue($trip->hora_inicio_prevista);
            $tripImportSequence = $this->resolveTripImportSequenceInDay($trip);
            $tripSequence = $this->resolveTripDisplaySequenceInDay($trip);

            if ($tripSequence <= 0) {
                $tripSequence = count($tripRows) + 1;
            }

            if ($tripImportSequence <= 0) {
                $tripImportSequence = $tripSequence;
            }

            $startsOnPreviousDay = $this->shouldDepartureUsePreviousDay($tripImportSequence, $tripStartTime);
            $operationalDepartureDate = $this->resolveOperationalDepartureDate(
                $trip->data_viagem?->toDateString(),
                $tripImportSequence,
                $tripStartTime,
            );

            if ($scale) {
                $interjornadaAlert = $this->resolveInterjornadaAlert(
                    $trip,
                    (int) $scale->colaborador_id,
                    (int) $scale->id,
                );

                if (($interjornadaAlert['is_violated'] ?? false) === true) {
                    $driverAlerts[(int) $scale->colaborador_id] = true;
                }
            }

            $tripRows[] = [
                'id' => (int) $trip->id,
                'ordem_no_dia' => $tripSequence,
                'data_viagem' => $trip->data_viagem?->toDateString(),
                'data_saida_operacional' => $operationalDepartureDate,
                'saida_dia_anterior' => $startsOnPreviousDay,
                'unidade_id' => (int) $trip->unidade_id,
                'unidade_nome' => (string) ($trip->unidade?->nome ?? '-'),
                'codigo_viagem' => $trip->codigo_viagem !== null && $trip->codigo_viagem !== ''
                    ? (string) $trip->codigo_viagem
                    : null,
                'origem' => $trip->origem !== null && $trip->origem !== ''
                    ? (string) $trip->origem
                    : null,
                'destino' => $trip->destino !== null && $trip->destino !== ''
                    ? (string) $trip->destino
                    : null,
                'aviario' => $trip->aviario !== null && $trip->aviario !== ''
                    ? (string) $trip->aviario
                    : null,
                'cidade' => $trip->cidade !== null && $trip->cidade !== ''
                    ? (string) $trip->cidade
                    : null,
                'distancia_km' => round((float) ($trip->distancia_km ?? 0), 2),
                'equipe' => $trip->equipe !== null && $trip->equipe !== ''
                    ? (string) $trip->equipe
                    : null,
                'aves' => (int) ($trip->aves ?? 0),
                'numero_carga' => $trip->numero_carga !== null && $trip->numero_carga !== ''
                    ? (string) $trip->numero_carga
                    : null,
                'hora_inicio_prevista' => $this->normalizeTimeValue($trip->hora_inicio_prevista),
                'hora_carregamento_prevista' => $this->normalizeTimeValue($trip->hora_carregamento_prevista),
                'hora_fim_prevista' => $this->normalizeTimeValue($trip->hora_fim_prevista),
                'jornada_horas_prevista' => round((float) $trip->jornada_horas_prevista, 2),
                'observacoes' => $trip->observacoes !== null && $trip->observacoes !== ''
                    ? (string) $trip->observacoes
                    : null,
                'interjornada_alert' => $interjornadaAlert,
                'escala' => $scale
                    ? [
                        'id' => (int) $scale->id,
                        'colaborador_id' => (int) $scale->colaborador_id,
                        'colaborador_nome' => (string) ($scale->colaborador?->nome ?? '-'),
                        'placa_frota_id' => (int) $scale->placa_frota_id,
                        'placa' => (string) ($scale->placaFrota?->placa ?? '-'),
                        'observacoes' => $scale->observacoes !== null && $scale->observacoes !== ''
                            ? (string) $scale->observacoes
                            : null,
                    ]
                    : null,
            ];
        }

        usort($tripRows, static function (array $left, array $right): int {
            $leftOrder = (int) ($left['ordem_no_dia'] ?? 0);
            $rightOrder = (int) ($right['ordem_no_dia'] ?? 0);

            if ($leftOrder === $rightOrder) {
                return ((int) ($left['id'] ?? 0)) <=> ((int) ($right['id'] ?? 0));
            }

            return $leftOrder <=> $rightOrder;
        });

        $drivers = $driversCollection
            ->map(function (Colaborador $driver) use ($assignedDriverIds, $dailyHoursByDriver, $driverAlerts): array {
                $driverId = (int) $driver->id;
                $isAssigned = in_array($driverId, $assignedDriverIds, true);
                $dailyHours = round((float) ($dailyHoursByDriver->get($driverId) ?? 0), 2);

                return [
                    'id' => $driverId,
                    'nome' => (string) $driver->nome,
                    'funcao_nome' => (string) ($driver->funcao?->nome ?? '-'),
                    'unidade_id' => (int) ($driver->unidade_id ?? 0),
                    'cnh' => (string) ($driver->cnh ?? ''),
                    'is_habilitado' => trim((string) $driver->cnh) !== '',
                    'is_assigned_today' => $isAssigned,
                    'is_available_today' => ! $isAssigned,
                    'horas_trabalhadas_dia' => $dailyHours,
                    'horas_extra_dia' => round(max(0, $dailyHours - 8), 2),
                    'tem_alerta_interjornada' => isset($driverAlerts[$driverId]),
                ];
            })
            ->values()
            ->all();

        $trucks = $trucksCollection
            ->map(function (PlacaFrota $truck) use ($assignedTruckIds): array {
                $truckId = (int) $truck->id;
                $isAssigned = in_array($truckId, $assignedTruckIds, true);

                return [
                    'id' => $truckId,
                    'placa' => (string) $truck->placa,
                    'unidade_id' => (int) ($truck->unidade_id ?? 0),
                    'is_assigned_today' => $isAssigned,
                    'is_available_today' => ! $isAssigned,
                ];
            })
            ->values()
            ->all();

        $jornadaRows = $driversCollection
            ->map(function (Colaborador $driver) use ($dailyHoursByDriver): array {
                $driverId = (int) $driver->id;
                $hours = round((float) ($dailyHoursByDriver->get($driverId) ?? 0), 2);

                return [
                    'colaborador_id' => $driverId,
                    'nome' => (string) $driver->nome,
                    'horas_trabalhadas_dia' => $hours,
                    'horas_extra_dia' => round(max(0, $hours - 8), 2),
                    'ocupacao_percentual' => round(min(100, ($hours / 8) * 100), 2),
                ];
            })
            ->values()
            ->all();

        $tripsAssigned = collect($tripRows)->whereNotNull('escala')->count();
        $driversStarted = collect($drivers)->where('is_assigned_today', true)->count();
        $trucksStarted = collect($trucks)->where('is_assigned_today', true)->count();
        $overloadedDrivers = collect($drivers)
            ->filter(fn (array $driver): bool => ((float) ($driver['horas_trabalhadas_dia'] ?? 0)) >= 8 || ((bool) ($driver['tem_alerta_interjornada'] ?? false)))
            ->sortByDesc(fn (array $driver): float => ((float) ($driver['horas_trabalhadas_dia'] ?? 0)) + (((bool) ($driver['tem_alerta_interjornada'] ?? false)) ? 100.0 : 0.0))
            ->take(8)
            ->values();
        $previousDayDepartures = collect($tripRows)->filter(fn (array $trip): bool => (bool) ($trip['saida_dia_anterior'] ?? false))->count();
        $assignmentRate = count($tripRows) > 0
            ? round(($tripsAssigned / count($tripRows)) * 100, 2)
            : 0.0;
        $operationAlerts = [];

        if ($assignmentRate < 100 && count($tripRows) > 0) {
            $operationAlerts[] = [
                'level' => 'warning',
                'title' => 'Escalas incompletas',
                'detail' => sprintf('%d viagem(ns) ainda sem escala completa.', max(count($tripRows) - $tripsAssigned, 0)),
            ];
        }

        if ($previousDayDepartures > 0) {
            $operationAlerts[] = [
                'level' => 'info',
                'title' => 'Saidas operacionais no dia anterior',
                'detail' => sprintf('%d viagem(ns) iniciam operacionalmente antes da virada do dia.', $previousDayDepartures),
            ];
        }

        if ($overloadedDrivers->count() > 0) {
            $operationAlerts[] = [
                'level' => 'warning',
                'title' => 'Motoristas com carga elevada',
                'detail' => sprintf('%d motorista(s) demandam revisao de jornada.', $overloadedDrivers->count()),
            ];
        }

        return response()->json([
            'unidades' => $units
                ->map(fn (Unidade $unit): array => [
                    'id' => (int) $unit->id,
                    'nome' => (string) $unit->nome,
                ])
                ->values()
                ->all(),
            'filters' => [
                'unidade_id' => $selectedUnitId > 0 ? $selectedUnitId : null,
                'data' => $effectiveDate,
            ],
            'drivers' => $drivers,
            'trucks' => $trucks,
            'trips' => $tripRows,
            'jornada' => $jornadaRows,
            'summary' => [
                'trips_total' => count($tripRows),
                'trips_assigned' => $tripsAssigned,
                'trips_unassigned' => collect($tripRows)->whereNull('escala')->count(),
                'assignment_rate' => $assignmentRate,
                'drivers_available' => collect($drivers)->where('is_available_today', true)->count(),
                'drivers_started' => $driversStarted,
                'trucks_available' => collect($trucks)->where('is_available_today', true)->count(),
                'trucks_started' => $trucksStarted,
                'interjornada_alerts' => collect($tripRows)
                    ->whereNotNull('interjornada_alert')
                    ->filter(fn (array $trip): bool => (bool) ($trip['interjornada_alert']['is_violated'] ?? false))
                    ->count(),
                'trips_previous_day_start' => $previousDayDepartures,
                'overloaded_drivers_count' => $overloadedDrivers->count(),
            ],
            'driver_overload' => $overloadedDrivers,
            'operation_alerts' => $operationAlerts,
        ]);
    }

    public function previewImport(ImportProgrammingSpreadsheetRequest $request): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('programming.import'), 403);

        $unitId = (int) $request->integer('unidade_id');
        abort_unless($request->user()?->canAccessUnit('programming', $unitId), 403);
        $unit = Unidade::query()->find($unitId);

        if (! $unit) {
            return response()->json(['message' => 'Unidade de importação inválida.'], 422);
        }

        $uploaded = $request->file('file');

        if (! $uploaded) {
            return response()->json(['message' => 'Arquivo nao encontrado.'], 422);
        }

        $path = $uploaded->getRealPath() ?: '';

        if ($path === '' || ! is_file($path)) {
            return response()->json(['message' => 'Arquivo de importacao invalido.'], 422);
        }

        try {
            $sheet = IOFactory::load($path)->getActiveSheet();
        } catch (\Throwable) {
            return response()->json(['message' => 'Nao foi possivel ler o arquivo XLSX.'], 422);
        }

        $parsed = $this->parseSpreadsheetRows($sheet, $unit);

        return response()->json([
            'total_lidas' => $parsed['total_lidas'],
            'total_validas' => count($parsed['rows']),
            'total_erros' => count($parsed['errors']),
            'total_ignoradas' => $parsed['total_ignoradas'] ?? 0,
            'ignoradas' => $parsed['ignored'] ?? [],
            'preview' => array_slice($parsed['rows'], 0, 25),
            'erros' => $parsed['errors'],
        ]);
    }

    public function importBase(ImportProgrammingSpreadsheetRequest $request): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('programming.import'), 403);

        $unitId = (int) $request->integer('unidade_id');
        abort_unless($request->user()?->canAccessUnit('programming', $unitId), 403);
        $unit = Unidade::query()->find($unitId);

        if (! $unit) {
            return response()->json(['message' => 'Unidade de importação inválida.'], 422);
        }

        $uploaded = $request->file('file');

        if (! $uploaded) {
            return response()->json(['message' => 'Arquivo nao encontrado.'], 422);
        }

        $path = $uploaded->getRealPath() ?: '';

        if ($path === '' || ! is_file($path)) {
            return response()->json(['message' => 'Arquivo de importacao invalido.'], 422);
        }

        try {
            $sheet = IOFactory::load($path)->getActiveSheet();
        } catch (\Throwable) {
            return response()->json(['message' => 'Nao foi possivel ler o arquivo XLSX.'], 422);
        }

        $parsed = $this->parseSpreadsheetRows($sheet, $unit);

        if (count($parsed['rows']) === 0) {
            return response()->json([
                'message' => 'Nenhuma linha valida foi encontrada para importar.',
                'total_lidas' => $parsed['total_lidas'],
                'total_validas' => 0,
                'total_erros' => count($parsed['errors']),
                'total_ignoradas' => $parsed['total_ignoradas'] ?? 0,
                'ignoradas' => $parsed['ignored'] ?? [],
                'erros' => $parsed['errors'],
            ], 422);
        }

        $importBatch = 'prog_'.now()->format('YmdHis').'_'.Str::lower(Str::random(6));
        $created = 0;
        $updated = 0;
        $authorId = (int) $request->user()->id;
        $importedDates = collect($parsed['rows'])
            ->pluck('data_viagem')
            ->map(fn ($value): ?string => $this->normalizeDateOnly($value))
            ->filter(fn ($value): bool => is_string($value) && trim($value) !== '')
            ->values();

        $dateByFrequency = $importedDates
            ->countBy()
            ->sortDesc();

        $suggestedDate = $dateByFrequency->keys()->first();

        DB::transaction(function () use ($parsed, $importBatch, $authorId, &$created, &$updated): void {
            foreach ($parsed['rows'] as $row) {
                $query = ProgramacaoViagem::query()
                    ->whereDate('data_viagem', (string) $row['data_viagem'])
                    ->where('unidade_id', (int) $row['unidade_id']);

                $numberCarga = trim((string) ($row['numero_carga'] ?? ''));

                if ($numberCarga !== '') {
                    $query->where('numero_carga', $numberCarga);
                } else {
                    $query
                        ->where('aviario', trim((string) ($row['aviario'] ?? '')))
                        ->where('cidade', trim((string) ($row['cidade'] ?? '')))
                        ->where('hora_inicio_prevista', $this->normalizeTimeValue($row['hora_inicio_prevista'] ?? null));
                }

                $payload = [
                    'data_viagem' => (string) $row['data_viagem'],
                    'unidade_id' => (int) $row['unidade_id'],
                    'ordem_importacao' => max(0, (int) ($row['ordem_importacao'] ?? 0)),
                    'codigo_viagem' => trim((string) ($row['codigo_viagem'] ?? '')) !== ''
                        ? trim((string) ($row['codigo_viagem'] ?? ''))
                        : null,
                    'origem' => trim((string) ($row['aviario'] ?? '')) !== '' ? trim((string) ($row['aviario'] ?? '')) : null,
                    'destino' => trim((string) ($row['cidade'] ?? '')) !== '' ? trim((string) ($row['cidade'] ?? '')) : null,
                    'aviario' => trim((string) ($row['aviario'] ?? '')) !== '' ? trim((string) ($row['aviario'] ?? '')) : null,
                    'cidade' => trim((string) ($row['cidade'] ?? '')) !== '' ? trim((string) ($row['cidade'] ?? '')) : null,
                    'distancia_km' => round(max(0, (float) ($row['distancia_km'] ?? 0)), 2),
                    'equipe' => trim((string) ($row['equipe'] ?? '')) !== '' ? trim((string) ($row['equipe'] ?? '')) : null,
                    'aves' => max(0, (int) ($row['aves'] ?? 0)),
                    'numero_carga' => $numberCarga !== '' ? $numberCarga : null,
                    'hora_inicio_prevista' => $this->normalizeTimeValue($row['hora_inicio_prevista'] ?? null),
                    'hora_carregamento_prevista' => $this->normalizeTimeValue($row['hora_carregamento_prevista'] ?? null),
                    'hora_fim_prevista' => $this->normalizeTimeValue($row['hora_fim_prevista'] ?? null),
                    'jornada_horas_prevista' => round((float) ($row['jornada_horas_prevista'] ?? 0), 2),
                    'observacoes' => trim((string) ($row['observacoes'] ?? '')) !== '' ? trim((string) ($row['observacoes'] ?? '')) : null,
                    'import_lote' => $importBatch,
                    'autor_id' => $authorId,
                ];

                $existing = $query->first();

                if ($existing) {
                    $existing->update($payload);
                    $updated++;
                    continue;
                }

                ProgramacaoViagem::query()->create($payload);
                $created++;
            }
        });

        return response()->json([
            'message' => 'Base de programacao importada com sucesso.',
            'lote' => $importBatch,
            'total_lidas' => $parsed['total_lidas'],
            'total_validas' => count($parsed['rows']),
            'total_erros' => count($parsed['errors']),
            'total_ignoradas' => $parsed['total_ignoradas'] ?? 0,
            'total_criadas' => $created,
            'total_atualizadas' => $updated,
            'datas_importadas' => $importedDates->unique()->sort()->values()->all(),
            'data_sugerida' => is_string($suggestedDate) ? $suggestedDate : null,
            'ignoradas' => $parsed['ignored'] ?? [],
            'erros' => $parsed['errors'],
        ]);
    }

    public function clearDayTable(Request $request): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('programming.import'), 403);

        $validated = $request->validate([
            'unidade_id' => ['required', 'integer', 'exists:unidades,id'],
            'data' => ['required', 'date_format:Y-m-d'],
        ]);

        $unitId = (int) $validated['unidade_id'];
        $date = (string) $validated['data'];
        abort_unless($request->user()?->canAccessUnit('programming', $unitId), 403);

        $query = ProgramacaoViagem::query()
            ->where('unidade_id', $unitId)
            ->whereDate('data_viagem', $date);

        $totalTrips = (int) (clone $query)->count();

        if ($totalTrips <= 0) {
            return response()->json([
                'message' => 'Nao existem viagens para remover nesta unidade e data.',
                'total_removidas' => 0,
                'data' => $date,
                'unidade_id' => $unitId,
            ]);
        }

        DB::transaction(function () use ($query): void {
            $query->delete();
        });

        return response()->json([
            'message' => 'Tabela do dia removida com sucesso.',
            'total_removidas' => $totalTrips,
            'data' => $date,
            'unidade_id' => $unitId,
        ]);
    }

    public function assign(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->hasPermission('programming.assign'), 403);

        $validated = $request->validate([
            'programacao_viagem_id' => ['required', 'integer', 'exists:programacao_viagens,id'],
            'colaborador_id' => ['required', 'integer', 'exists:colaboradores,id'],
            'placa_frota_id' => ['required', 'integer', 'exists:placas_frota,id'],
            'hora_inicio_prevista' => ['nullable', 'date_format:H:i'],
            'hora_carregamento_prevista' => ['nullable', 'date_format:H:i'],
            'hora_fim_prevista' => ['nullable', 'date_format:H:i'],
            'observacoes' => ['nullable', 'string', 'max:1000'],
        ]);

        $trip = ProgramacaoViagem::query()->findOrFail((int) $validated['programacao_viagem_id']);
        $collaborator = Colaborador::query()->findOrFail((int) $validated['colaborador_id']);
        $truck = PlacaFrota::query()->findOrFail((int) $validated['placa_frota_id']);
        abort_unless($user?->canAccessUnit('programming', (int) $trip->unidade_id), 403);

        if (! $collaborator->ativo) {
            return response()->json([
                'message' => 'O colaborador selecionado precisa estar ativo para escala.',
            ], 422);
        }

        if ((int) ($collaborator->unidade_id ?? 0) !== (int) $trip->unidade_id) {
            return response()->json([
                'message' => 'O motorista precisa pertencer a mesma unidade da viagem.',
            ], 422);
        }

        if ((int) ($truck->unidade_id ?? 0) !== (int) $trip->unidade_id) {
            return response()->json([
                'message' => 'O caminhao precisa pertencer a mesma unidade da viagem.',
            ], 422);
        }

        $existing = ProgramacaoEscala::query()
            ->where('programacao_viagem_id', (int) $trip->id)
            ->first();

        $existingId = (int) ($existing?->id ?? 0);

        if (array_key_exists('hora_inicio_prevista', $validated)) {
            $trip->hora_inicio_prevista = $this->normalizeTimeValue($validated['hora_inicio_prevista'] ?? null);
        }

        if (array_key_exists('hora_carregamento_prevista', $validated)) {
            $trip->hora_carregamento_prevista = $this->normalizeTimeValue($validated['hora_carregamento_prevista'] ?? null);
        }

        if (array_key_exists('hora_fim_prevista', $validated)) {
            $trip->hora_fim_prevista = $this->normalizeTimeValue($validated['hora_fim_prevista'] ?? null);
        }

        $currentTripStart = $this->resolveTripStartDateTime($trip);
        $currentTripEnd = $this->resolveTripEndDateTime($trip);

        if (! $currentTripStart || ! $currentTripEnd) {
            return response()->json([
                'message' => 'Defina horários válidos de saída/chegada para validar conflitos de escala.',
            ], 422);
        }

        $driverScales = ProgramacaoEscala::query()
            ->where('id', '!=', $existingId)
            ->where('colaborador_id', (int) $validated['colaborador_id'])
            ->with('viagem:id,data_viagem,unidade_id,hora_inicio_prevista,hora_fim_prevista,jornada_horas_prevista')
            ->get(['id', 'programacao_viagem_id']);

        foreach ($driverScales as $driverScale) {
            $otherTrip = $driverScale->viagem;

            if (! $otherTrip || (int) $otherTrip->id === (int) $trip->id) {
                continue;
            }

            $otherStart = $this->resolveTripStartDateTime($otherTrip);
            $otherEnd = $this->resolveTripEndDateTime($otherTrip);

            if (! $this->hasScheduleOverlap($currentTripStart, $currentTripEnd, $otherStart, $otherEnd)) {
                continue;
            }

            return response()->json([
                'message' => sprintf(
                    'Conflito de motorista: já existe viagem escalada no período (%s até %s).',
                    $otherStart?->format('d/m H:i') ?? '-',
                    $otherEnd?->format('d/m H:i') ?? '-',
                ),
            ], 422);
        }

        $truckScales = ProgramacaoEscala::query()
            ->where('id', '!=', $existingId)
            ->where('placa_frota_id', (int) $validated['placa_frota_id'])
            ->with('viagem:id,data_viagem,unidade_id,hora_inicio_prevista,hora_fim_prevista,jornada_horas_prevista')
            ->get(['id', 'programacao_viagem_id']);

        foreach ($truckScales as $truckScale) {
            $otherTrip = $truckScale->viagem;

            if (! $otherTrip || (int) $otherTrip->id === (int) $trip->id) {
                continue;
            }

            $otherStart = $this->resolveTripStartDateTime($otherTrip);
            $otherEnd = $this->resolveTripEndDateTime($otherTrip);

            if (! $this->hasScheduleOverlap($currentTripStart, $currentTripEnd, $otherStart, $otherEnd)) {
                continue;
            }

            return response()->json([
                'message' => sprintf(
                    'Conflito de caminhão: já existe viagem escalada no período (%s até %s).',
                    $otherStart?->format('d/m H:i') ?? '-',
                    $otherEnd?->format('d/m H:i') ?? '-',
                ),
            ], 422);
        }

        $interjornadaAlert = $this->resolveInterjornadaAlert(
            $trip,
            (int) $validated['colaborador_id'],
            $existingId,
        );

        if (($interjornadaAlert['is_violated'] ?? false) === true) {
            return response()->json([
                'message' => (string) ($interjornadaAlert['mensagem'] ?? 'Interjornada insuficiente para escalar este motorista.'),
                'interjornada_alert' => $interjornadaAlert,
            ], 422);
        }

        $scale = $existing ?? new ProgramacaoEscala([
            'programacao_viagem_id' => (int) $trip->id,
        ]);

        $isNew = ! $scale->exists;

        DB::transaction(function () use ($trip, $scale, $validated, $request): void {
            $trip->save();

            $scale->colaborador_id = (int) $validated['colaborador_id'];
            $scale->placa_frota_id = (int) $validated['placa_frota_id'];
            $scale->autor_id = (int) $request->user()->id;
            $scale->observacoes = trim((string) ($validated['observacoes'] ?? '')) !== ''
                ? trim((string) ($validated['observacoes'] ?? ''))
                : null;
            $scale->save();
        });

        $scale->load(['colaborador:id,nome', 'placaFrota:id,placa']);

        return response()->json([
            'message' => 'Escala salva com sucesso.',
            'data' => [
                'id' => (int) $scale->id,
                'programacao_viagem_id' => (int) $scale->programacao_viagem_id,
                'colaborador_id' => (int) $scale->colaborador_id,
                'colaborador_nome' => (string) ($scale->colaborador?->nome ?? '-'),
                'placa_frota_id' => (int) $scale->placa_frota_id,
                'placa' => (string) ($scale->placaFrota?->placa ?? '-'),
                'hora_inicio_prevista' => $this->normalizeTimeValue($trip->hora_inicio_prevista),
                'hora_carregamento_prevista' => $this->normalizeTimeValue($trip->hora_carregamento_prevista),
                'hora_fim_prevista' => $this->normalizeTimeValue($trip->hora_fim_prevista),
                'observacoes' => $scale->observacoes,
            ],
            'interjornada_alert' => $interjornadaAlert,
        ], $isNew ? 201 : 200);
    }

    /**
    * @return array{rows: array<int, array<string, mixed>>, errors: array<int, array<string, mixed>>, ignored: array<int, array<string, mixed>>, total_lidas: int, total_ignoradas: int}
     */
    private function parseSpreadsheetRows(Worksheet $sheet, Unidade $unit): array
    {
        $highestRow = (int) $sheet->getHighestDataRow();
        $headerA1 = Str::of((string) $sheet->getCell('A1')->getFormattedValue())->lower()->ascii()->value();
        $rowStart = str_contains($headerA1, 'data') ? 2 : 1;

        $rows = [];
        $errors = [];
        $ignored = [];
        $totalRead = 0;
        $validRowOrder = 0;

        for ($row = $rowStart; $row <= $highestRow; $row++) {
            $aRaw = $sheet->getCell('A'.$row)->getValue();
            $aFormatted = trim((string) $sheet->getCell('A'.$row)->getFormattedValue());
            $bRaw = $sheet->getCell('B'.$row)->getValue();
            $bFormatted = trim((string) $sheet->getCell('B'.$row)->getFormattedValue());
            $cRaw = $sheet->getCell('C'.$row)->getValue();
            $cFormatted = trim((string) $sheet->getCell('C'.$row)->getFormattedValue());
            $dRaw = $sheet->getCell('D'.$row)->getValue();
            $dFormatted = trim((string) $sheet->getCell('D'.$row)->getFormattedValue());
            $eRaw = $sheet->getCell('E'.$row)->getValue();
            $eFormatted = trim((string) $sheet->getCell('E'.$row)->getFormattedValue());
            $fRaw = $sheet->getCell('F'.$row)->getValue();
            $fFormatted = trim((string) $sheet->getCell('F'.$row)->getFormattedValue());
            $gRaw = $sheet->getCell('G'.$row)->getValue();
            $gFormatted = trim((string) $sheet->getCell('G'.$row)->getFormattedValue());
            $hRaw = $sheet->getCell('H'.$row)->getValue();
            $hFormatted = trim((string) $sheet->getCell('H'.$row)->getFormattedValue());
            $iRaw = $sheet->getCell('I'.$row)->getValue();
            $iFormatted = trim((string) $sheet->getCell('I'.$row)->getFormattedValue());
            $jRaw = $sheet->getCell('J'.$row)->getValue();
            $jFormatted = trim((string) $sheet->getCell('J'.$row)->getFormattedValue());

            $isLineBlank = trim((string) ($aFormatted !== '' ? $aFormatted : $aRaw)) === ''
                && $bFormatted === ''
                && $cFormatted === ''
                && $dFormatted === ''
                && $eFormatted === ''
                && $fFormatted === ''
                && $gFormatted === ''
                && $hFormatted === ''
                && $iFormatted === ''
                && $jFormatted === '';

            if ($isLineBlank) {
                continue;
            }

            $totalRead++;

            $dateText = trim((string) ($aFormatted !== '' ? $aFormatted : $aRaw));
            $aviaryText = trim((string) ($bFormatted !== '' ? $bFormatted : $bRaw));

            if ($dateText === '' || $aviaryText === '') {
                $ignored[] = [
                    'linha' => $row,
                    'motivo' => 'Linha ignorada por data/aviário vazio.',
                ];
                continue;
            }

            $avesSource = $fFormatted !== '' ? $fFormatted : $fRaw;
            $aves = (int) round($this->parseSpreadsheetNumber($avesSource));

            if ($aves <= 0) {
                $ignored[] = [
                    'linha' => $row,
                    'motivo' => 'Linha ignorada por aves <= 0.',
                ];
                continue;
            }

            $date = $this->parseSpreadsheetDate($aRaw, $dateText);

            if (! $date) {
                $errors[] = [
                    'linha' => $row,
                    'erro' => 'Data da viagem inválida na coluna A.',
                ];
                continue;
            }

            $aviario = $aviaryText;
            $cidade = trim((string) ($cFormatted !== '' ? $cFormatted : $cRaw));
            $distanceSource = $dFormatted !== '' ? $dFormatted : $dRaw;
            $distanciaKm = max(0, round($this->parseSpreadsheetNumber($distanceSource), 2));
            $equipe = trim((string) ($eFormatted !== '' ? $eFormatted : $eRaw));
            $numeroCarga = trim((string) ($gFormatted !== '' ? $gFormatted : $gRaw));

            $horaSaidaPrevista = $this->parseSpreadsheetTime($hRaw, $hFormatted);
            $horaCarregamento = $this->parseSpreadsheetTime($iRaw, $iFormatted);
            $horaChegadaPrevista = $this->parseSpreadsheetTime($jRaw, $jFormatted);
            $jornada = $this->resolveJornadaHoras($date, $horaSaidaPrevista, $horaChegadaPrevista);

            $rows[] = [
                'linha' => $row,
                'ordem_importacao' => ++$validRowOrder,
                'data_viagem' => $date,
                'unidade_id' => (int) $unit->id,
                'unidade_nome' => (string) $unit->nome,
                'codigo_viagem' => $numeroCarga !== '' ? 'Carga '.$numeroCarga : null,
                'origem' => $aviario !== '' ? $aviario : null,
                'destino' => $cidade !== '' ? $cidade : null,
                'aviario' => $aviario !== '' ? $aviario : null,
                'cidade' => $cidade !== '' ? $cidade : null,
                'distancia_km' => $distanciaKm,
                'equipe' => $equipe !== '' ? $equipe : null,
                'aves' => $aves,
                'numero_carga' => $numeroCarga !== '' ? $numeroCarga : null,
                'hora_inicio_prevista' => $horaSaidaPrevista,
                'hora_carregamento_prevista' => $horaCarregamento,
                'hora_fim_prevista' => $horaChegadaPrevista,
                'jornada_horas_prevista' => $jornada,
                'observacoes' => null,
            ];
        }

        return [
            'rows' => $rows,
            'errors' => $errors,
            'ignored' => $ignored,
            'total_lidas' => $totalRead,
            'total_ignoradas' => count($ignored),
        ];
    }

    private function resolveJornadaHoras(string $date, ?string $start, ?string $end): float
    {
        if (! $start || ! $end) {
            return 0.0;
        }

        try {
            $startDateTime = Carbon::createFromFormat('Y-m-d H:i', $date.' '.$start);
            $endDateTime = Carbon::createFromFormat('Y-m-d H:i', $date.' '.$end);

            if ($endDateTime->lessThanOrEqualTo($startDateTime)) {
                $endDateTime->addDay();
            }

            return round($startDateTime->diffInMinutes($endDateTime) / 60, 2);
        } catch (\Throwable) {
            return 0.0;
        }
    }

    private function parseSpreadsheetDate(mixed $rawValue, string $formatted): ?string
    {
        if (is_numeric($rawValue)) {
            try {
                return Carbon::instance(SpreadsheetDate::excelToDateTimeObject((float) $rawValue))->toDateString();
            } catch (\Throwable) {
                // Continua para parse textual.
            }
        }

        $candidates = array_filter([
            trim((string) $formatted),
            trim((string) $rawValue),
        ]);

        foreach ($candidates as $candidate) {
            $normalized = str_replace('\\', '/', (string) $candidate);

            foreach (['Y-m-d', 'd/m/Y', 'd/m/y', 'd-m-Y', 'd-m-y', 'd.m.Y', 'd.m.y', 'Y/m/d', 'm/d/Y', 'm/d/y'] as $format) {
                try {
                    $parsed = Carbon::createFromFormat($format, $normalized);

                    if ($parsed !== false) {
                        return $parsed->toDateString();
                    }
                } catch (\Throwable) {
                    // Tenta o próximo formato.
                }
            }

            try {
                return Carbon::parse($normalized)->toDateString();
            } catch (\Throwable) {
                // Tenta o proximo candidato.
            }
        }

        return null;
    }

    private function parseSpreadsheetTime(mixed $rawValue, string $formatted): ?string
    {
        if (is_numeric($rawValue)) {
            try {
                return Carbon::instance(SpreadsheetDate::excelToDateTimeObject((float) $rawValue))->format('H:i');
            } catch (\Throwable) {
                // Continua para parse textual.
            }
        }

        $candidates = array_filter([
            trim((string) $formatted),
            trim((string) $rawValue),
        ]);

        foreach ($candidates as $candidateRaw) {
            $candidate = Str::of((string) $candidateRaw)
                ->replace('h', ':')
                ->replace('.', ':')
                ->replace(' ', '')
                ->value();

            if (preg_match('/^\d{1,2}$/', $candidate) === 1) {
                $candidate = sprintf('%02d:00', (int) $candidate);
            }

            if (preg_match('/^\d{3,4}$/', $candidate) === 1) {
                $candidate = str_pad($candidate, 4, '0', STR_PAD_LEFT);
                $candidate = substr($candidate, 0, 2).':'.substr($candidate, 2, 2);
            }

            foreach (['H:i', 'H:i:s'] as $format) {
                try {
                    $parsed = Carbon::createFromFormat($format, $candidate);

                    if ($parsed !== false) {
                        return $parsed->format('H:i');
                    }
                } catch (\Throwable) {
                    // Tenta o próximo formato.
                }
            }

            try {
                return Carbon::parse($candidate)->format('H:i');
            } catch (\Throwable) {
                // Continua para o próximo candidato.
            }
        }

        return null;
    }

    private function parseSpreadsheetNumber(mixed $value): float
    {
        if ($value === null) {
            return 0.0;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        $text = trim((string) $value);

        if ($text === '') {
            return 0.0;
        }

        $text = str_replace(["\u{00A0}", ' '], '', $text);
        $text = preg_replace('/[^0-9,\.\-]/', '', $text) ?? $text;

        if ($text === '' || $text === '-' || $text === '.' || $text === ',') {
            return 0.0;
        }

        if (str_contains($text, ',') && str_contains($text, '.')) {
            $lastComma = strrpos($text, ',');
            $lastDot = strrpos($text, '.');

            if ($lastComma !== false && $lastDot !== false && $lastComma > $lastDot) {
                $text = str_replace('.', '', $text);
                $text = str_replace(',', '.', $text);
            } else {
                $text = str_replace(',', '', $text);
            }
        } elseif (str_contains($text, ',')) {
            $text = str_replace('.', '', $text);
            $text = str_replace(',', '.', $text);
        } elseif (preg_match('/^\d{1,3}(\.\d{3})+$/', $text) === 1) {
            $text = str_replace('.', '', $text);
        }

        return is_numeric($text) ? (float) $text : 0.0;
    }

    private function normalizeTimeValue(mixed $value): ?string
    {
        $raw = trim((string) ($value ?? ''));

        if ($raw === '') {
            return null;
        }

        return $this->parseSpreadsheetTime($raw, $raw);
    }

    private function normalizeDateOnly(mixed $value): ?string
    {
        $raw = trim((string) ($value ?? ''));

        if ($raw === '') {
            return null;
        }

        try {
            return Carbon::parse($raw)->toDateString();
        } catch (\Throwable) {
            $slice = substr($raw, 0, 10);

            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $slice) === 1) {
                return $slice;
            }

            return null;
        }
    }

    /**
     * @return array{is_violated: bool, descanso_horas: float|null, mensagem: string|null, ultimo_fim: string|null}
     */
    private function resolveInterjornadaAlert(
        ProgramacaoViagem $trip,
        int $colaboradorId,
        int $excludeEscalaId = 0,
    ): array {
        $tripStart = $this->resolveTripStartDateTime($trip);

        if (! $tripStart) {
            return [
                'is_violated' => false,
                'descanso_horas' => null,
                'mensagem' => null,
                'ultimo_fim' => null,
            ];
        }

        $scales = ProgramacaoEscala::query()
            ->with([
                'viagem:id,data_viagem,hora_inicio_prevista,hora_fim_prevista,jornada_horas_prevista',
            ])
            ->where('colaborador_id', $colaboradorId)
            ->when($excludeEscalaId > 0, fn ($query) => $query->where('id', '!=', $excludeEscalaId))
            ->get(['id', 'programacao_viagem_id', 'colaborador_id']);

        $latestEnd = null;

        foreach ($scales as $scale) {
            $scaleTrip = $scale->viagem;

            if (! $scaleTrip || (int) $scaleTrip->id === (int) $trip->id) {
                continue;
            }

            $tripEnd = $this->resolveTripEndDateTime($scaleTrip);

            if (! $tripEnd || $tripEnd->greaterThanOrEqualTo($tripStart)) {
                continue;
            }

            // Viagens do mesmo dia operacional podem ser encadeadas sem regra de 11h.
            if ($tripEnd->toDateString() === $tripStart->toDateString()) {
                continue;
            }

            if (! $latestEnd || $tripEnd->greaterThan($latestEnd)) {
                $latestEnd = $tripEnd;
            }
        }

        if (! $latestEnd) {
            return [
                'is_violated' => false,
                'descanso_horas' => null,
                'mensagem' => null,
                'ultimo_fim' => null,
            ];
        }

        $restHours = round($latestEnd->diffInMinutes($tripStart) / 60, 2);
        $isViolated = $restHours < 11;

        return [
            'is_violated' => $isViolated,
            'descanso_horas' => $restHours,
            'mensagem' => $isViolated
                ? sprintf(
                    'Interjornada insuficiente: %.2f h de descanso (mínimo 11 h). Último término em %s.',
                    $restHours,
                    $latestEnd->format('d/m/Y H:i'),
                )
                : null,
            'ultimo_fim' => $latestEnd->toIso8601String(),
        ];
    }

    /**
     * @return array<int, int>
     */
    private function allowedProgrammingUnitIds(Request $request): array
    {
        return $request->user()?->allowedUnitIdsFor('programming') ?? [];
    }

    private function resolveTripStartDateTime(ProgramacaoViagem $trip): ?Carbon
    {
        $date = $trip->data_viagem?->toDateString();
        $start = $this->normalizeTimeValue($trip->hora_inicio_prevista);

        if (! $date || ! $start) {
            return null;
        }

        $sequence = $this->resolveTripImportSequenceInDay($trip);
        $operationalDate = $this->resolveOperationalDepartureDate($date, $sequence, $start) ?? $date;

        try {
            return Carbon::createFromFormat('Y-m-d H:i', $operationalDate.' '.$start);
        } catch (\Throwable) {
            return null;
        }
    }

    private function resolveTripEndDateTime(ProgramacaoViagem $trip): ?Carbon
    {
        $date = $trip->data_viagem?->toDateString();

        if (! $date) {
            return null;
        }

        $start = $this->resolveTripStartDateTime($trip);
        $end = $this->normalizeTimeValue($trip->hora_fim_prevista);
        $sequence = $this->resolveTripImportSequenceInDay($trip);
        $operationalDate = $this->resolveOperationalDepartureDate(
            $date,
            $sequence,
            $this->normalizeTimeValue($trip->hora_inicio_prevista),
        ) ?? $date;

        if ($end !== null) {
            try {
                $endDateTime = Carbon::createFromFormat('Y-m-d H:i', $operationalDate.' '.$end);

                if ($start && $endDateTime->lessThanOrEqualTo($start)) {
                    $endDateTime->addDay();
                }

                return $endDateTime;
            } catch (\Throwable) {
                // Continua para cálculo por jornada.
            }
        }

        if ($start) {
            $durationInMinutes = (int) round(max(0, (float) $trip->jornada_horas_prevista) * 60);

            if ($durationInMinutes > 0) {
                return $start->copy()->addMinutes($durationInMinutes);
            }
        }

        return null;
    }

    private function resolveTripImportSequenceInDay(ProgramacaoViagem $trip): int
    {
        $tripDate = $trip->data_viagem?->toDateString();
        $unitId = (int) ($trip->unidade_id ?? 0);
        $tripId = (int) ($trip->id ?? 0);

        if (! $tripDate || $unitId <= 0 || $tripId <= 0) {
            return 0;
        }

        $cacheKey = $unitId.'|'.$tripDate;

        if (! isset($this->tripImportSequenceCache[$cacheKey])) {
            $ids = ProgramacaoViagem::query()
                ->where('unidade_id', $unitId)
                ->whereDate('data_viagem', $tripDate)
                ->orderByRaw('CASE WHEN ordem_importacao > 0 THEN 0 ELSE 1 END')
                ->orderBy('ordem_importacao')
                ->orderBy('id')
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values()
                ->all();

            $sequenceById = [];

            foreach ($ids as $index => $id) {
                $sequenceById[(int) $id] = $index + 1;
            }

            $this->tripImportSequenceCache[$cacheKey] = $sequenceById;
        }

        return (int) ($this->tripImportSequenceCache[$cacheKey][$tripId] ?? 0);
    }

    private function resolveTripDisplaySequenceInDay(ProgramacaoViagem $trip): int
    {
        $tripDate = $trip->data_viagem?->toDateString();
        $unitId = (int) ($trip->unidade_id ?? 0);
        $tripId = (int) ($trip->id ?? 0);

        if (! $tripDate || $unitId <= 0 || $tripId <= 0) {
            return 0;
        }

        $cacheKey = $unitId.'|'.$tripDate;

        if (! isset($this->tripSequenceCache[$cacheKey])) {
            $tripCandidates = ProgramacaoViagem::query()
                ->where('unidade_id', $unitId)
                ->whereDate('data_viagem', $tripDate)
                ->orderBy('id')
                ->get(['id', 'data_viagem', 'unidade_id', 'hora_inicio_prevista']);

            $orderedIds = $tripCandidates
                ->map(function (ProgramacaoViagem $candidate): array {
                    $candidateId = (int) $candidate->id;
                    $candidateDate = $candidate->data_viagem?->toDateString();
                    $startTime = $this->normalizeTimeValue($candidate->hora_inicio_prevista);
                    $importSequence = $this->resolveTripImportSequenceInDay($candidate);
                    $operationalDate = $this->resolveOperationalDepartureDate($candidateDate, $importSequence, $startTime);

                    $timestamp = null;

                    if ($operationalDate && $startTime) {
                        try {
                            $timestamp = Carbon::createFromFormat('Y-m-d H:i', $operationalDate.' '.$startTime)->timestamp;
                        } catch (\Throwable) {
                            $timestamp = null;
                        }
                    }

                    return [
                        'id' => $candidateId,
                        'timestamp' => $timestamp,
                    ];
                })
                ->sort(function (array $left, array $right): int {
                    $leftTimestamp = $left['timestamp'];
                    $rightTimestamp = $right['timestamp'];

                    if ($leftTimestamp === null && $rightTimestamp === null) {
                        return ((int) $left['id']) <=> ((int) $right['id']);
                    }

                    if ($leftTimestamp === null) {
                        return 1;
                    }

                    if ($rightTimestamp === null) {
                        return -1;
                    }

                    if ($leftTimestamp === $rightTimestamp) {
                        return ((int) $left['id']) <=> ((int) $right['id']);
                    }

                    return $leftTimestamp <=> $rightTimestamp;
                })
                ->values()
                ->pluck('id')
                ->all();

            $sequenceById = [];

            foreach ($orderedIds as $index => $id) {
                $sequenceById[(int) $id] = $index + 1;
            }

            $this->tripSequenceCache[$cacheKey] = $sequenceById;
        }

        return (int) ($this->tripSequenceCache[$cacheKey][$tripId] ?? 0);
    }

    private function shouldDepartureUsePreviousDay(int $sequence, ?string $startTime): bool
    {
        if ($sequence <= 0 || $sequence > 20 || ! $startTime) {
            return false;
        }

        $minutes = $this->timeToMinutes($startTime);

        if ($minutes === null) {
            return false;
        }

        return $minutes >= ((20 * 60) + 30);
    }

    private function resolveOperationalDepartureDate(
        ?string $tripDate,
        int $sequence,
        ?string $startTime,
    ): ?string {
        if (! $tripDate) {
            return null;
        }

        if (! $this->shouldDepartureUsePreviousDay($sequence, $startTime)) {
            return $tripDate;
        }

        try {
            return Carbon::createFromFormat('Y-m-d', $tripDate)
                ->subDay()
                ->toDateString();
        } catch (\Throwable) {
            return $tripDate;
        }
    }

    private function hasScheduleOverlap(
        ?Carbon $leftStart,
        ?Carbon $leftEnd,
        ?Carbon $rightStart,
        ?Carbon $rightEnd,
    ): bool {
        if (! $leftStart || ! $leftEnd || ! $rightStart || ! $rightEnd) {
            return false;
        }

        return $leftStart->lt($rightEnd) && $rightStart->lt($leftEnd);
    }

    private function timeToMinutes(?string $value): ?int
    {
        $time = $this->normalizeTimeValue($value);

        if (! $time) {
            return null;
        }

        [$hoursRaw, $minutesRaw] = explode(':', $time);

        $hours = (int) $hoursRaw;
        $minutes = (int) $minutesRaw;

        if ($hours < 0 || $hours > 23 || $minutes < 0 || $minutes > 59) {
            return null;
        }

        return ($hours * 60) + $minutes;
    }
}
