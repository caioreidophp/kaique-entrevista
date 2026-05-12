<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Colaborador;
use App\Models\DriverInterview;
use App\Models\FeriasLancamento;
use App\Models\FreightEntry;
use App\Models\Multa;
use App\Models\Pagamento;
use App\Models\PlacaFrota;
use App\Models\ProgramacaoEscala;
use App\Models\ProgramacaoViagem;
use App\Models\TipoPagamento;
use App\Models\Unidade;
use App\Support\TransportCache;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

class HomeController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $today = CarbonImmutable::today();
        $isMaster = $user->isMasterAdmin();
        $canViewInterviewsPanel = $user->hasPermission('sidebar.interviews.view');
        $canViewPayrollPanel = $user->hasPermission('sidebar.payroll.dashboard.view');
        $canViewVacationsPanel = $user->hasPermission('sidebar.vacations.dashboard.view');
        $canViewRegistryPanel = $user->hasPermission('sidebar.registry.collaborators.view');
        $canViewFreightPanel = $user->hasPermission('sidebar.freight.dashboard.view');
        $canViewFinesPanel = $user->hasPermission('sidebar.fines.dashboard.view');
        $canViewProgrammingPanel = $user->hasPermission('sidebar.programming.dashboard.view')
            && (bool) config('transport_features.programming_panel', true);
        $canViewOperationsPanel = $user->hasPermission('sidebar.operations-hub.view')
            && (bool) config('transport_features.operations_hub', true);
        $registryUnitScope = $user->allowedUnitIdsFor('registry');
        $payrollUnitScope = $user->allowedUnitIdsFor('payroll');
        $freightUnitScope = $user->allowedUnitIdsFor('freight');
        $vacationUnitScope = $user->allowedUnitIdsFor('vacations');
        $finesUnitScope = $user->allowedUnitIdsFor('fines');
        $programmingUnitScope = $user->allowedUnitIdsFor('programming');

        $periodMode = (string) $request->string('period_mode', '1m');

        if (! in_array($periodMode, ['1m', '3m', 'month'], true)) {
            $periodMode = '1m';
        }

        $requestedMonth = (int) $request->integer('competencia_mes', (int) $today->month);
        $requestedYear = (int) $request->integer('competencia_ano', (int) $today->year);
        $periodRange = $this->resolvePeriodRange($periodMode, $requestedMonth, $requestedYear, $today);
        $monthOptions = $this->buildMonthOptions($today, 14);

        $payrollCompetenciaMes = max(1, min(12, (int) $request->integer('payroll_competencia_mes', (int) $periodRange['competencia_mes'])));
        $payrollCompetenciaAno = max(2020, min(2100, (int) $request->integer('payroll_competencia_ano', (int) $periodRange['competencia_ano'])));

        $cacheFingerprint = [
            'user_id' => (int) $user->id,
            'home_version' => TransportCache::version('home'),
            'permissions_version' => TransportCache::version('permissions'),
            'is_master' => (bool) $isMaster,
            'interviews' => (bool) $canViewInterviewsPanel,
            'payroll' => (bool) $canViewPayrollPanel,
            'vacations' => (bool) $canViewVacationsPanel,
            'registry' => (bool) $canViewRegistryPanel,
            'freight' => (bool) $canViewFreightPanel,
            'fines' => (bool) $canViewFinesPanel,
            'programming' => (bool) $canViewProgrammingPanel,
            'operations' => (bool) $canViewOperationsPanel,
            'month' => $periodRange['competencia_mes'],
            'year' => $periodRange['competencia_ano'],
            'period_mode' => $periodMode,
            'payroll_month' => $payrollCompetenciaMes,
            'payroll_year' => $payrollCompetenciaAno,
            'registry_scope' => $registryUnitScope,
            'payroll_scope' => $payrollUnitScope,
            'freight_scope' => $freightUnitScope,
            'vacation_scope' => $vacationUnitScope,
            'fines_scope' => $finesUnitScope,
            'programming_scope' => $programmingUnitScope,
        ];
        $cacheKey = TransportCache::key('home', $cacheFingerprint);
        $cachedPayload = Cache::get($cacheKey);

        if (is_array($cachedPayload)) {
            return response()->json($cachedPayload);
        }

        $interviewsTotal = 0;

        if ($canViewInterviewsPanel) {
            $interviewsQuery = DriverInterview::query();

            if (! $isMaster) {
                $interviewsQuery->where('author_id', $user->id);
            }

            $interviewsTotal = (clone $interviewsQuery)->count();
        }

        $tablePresence = Cache::remember('transport:home:table-presence:v3', now()->addMinutes(30), function (): array {
            return [
                'colaboradores' => Schema::hasTable('colaboradores'),
                'pagamentos' => Schema::hasTable('pagamentos'),
                'freight_entries' => Schema::hasTable('freight_entries'),
                'multas' => Schema::hasTable('multas'),
                'ferias_lancamentos' => Schema::hasTable('ferias_lancamentos'),
                'placas_frota' => Schema::hasTable('placas_frota'),
                'programacao_viagens' => Schema::hasTable('programacao_viagens'),
                'programacao_escalas' => Schema::hasTable('programacao_escalas'),
            ];
        });

        $hasColaboradores = (bool) ($tablePresence['colaboradores'] ?? false);
        $hasPagamentos = (bool) ($tablePresence['pagamentos'] ?? false);
        $hasFreightEntries = (bool) ($tablePresence['freight_entries'] ?? false);
        $hasMultas = (bool) ($tablePresence['multas'] ?? false);
        $hasFeriasLancamentos = (bool) ($tablePresence['ferias_lancamentos'] ?? false);
        $hasPlacasFrota = (bool) ($tablePresence['placas_frota'] ?? false);
        $hasProgramacaoViagens = (bool) ($tablePresence['programacao_viagens'] ?? false);
        $hasProgramacaoEscalas = (bool) ($tablePresence['programacao_escalas'] ?? false);

        $colaboradoresAtivos = 0;
        $totalPagamentosMes = 0.0;
        $freightEntriesMes = 0;
        $freightTotalMes = 0.0;
        $freightTotalTerceirosMes = 0.0;
        $freightKmMes = 0.0;
        $finesCountMes = 0;
        $finesTotalMes = 0.0;
        $programmingTripsToday = 0;
        $programmingUnassignedToday = 0;
        $programmingAvailableDrivers = 0;
        $programmingAvailableTrucks = 0;
        $feriasVencidas = 0;
        $feriasProximos2Meses = 0;
        $feriasProximos4Meses = 0;
        $taxaFeriasVencidas = 0.0;
        $urgentByUnit = [];

        if (($canViewRegistryPanel || $canViewVacationsPanel || $canViewOperationsPanel) && $hasColaboradores) {
            $colaboradoresAtivos = Colaborador::query()
                ->where('ativo', true)
                ->when(
                    $user->dataScopeFor('registry') === 'units',
                    fn ($query) => $query->whereIn('unidade_id', $registryUnitScope !== [] ? $registryUnitScope : [0]),
                )
                ->count();
        }

        if ($canViewPayrollPanel && $hasPagamentos) {
            $mesAtual = (int) now()->month;
            $anoAtual = (int) now()->year;

            $pagamentosQuery = Pagamento::query()
                ->where('competencia_mes', $mesAtual)
                ->where('competencia_ano', $anoAtual);

            if (! $isMaster) {
                $pagamentosQuery->where('autor_id', $user->id);
            }

            if ($user->dataScopeFor('payroll') === 'units') {
                $pagamentosQuery->whereIn('unidade_id', $payrollUnitScope !== [] ? $payrollUnitScope : [0]);
            }

            $totalPagamentosMes = (float) ((clone $pagamentosQuery)->sum('valor'));
        }

        if ($canViewFreightPanel && $hasFreightEntries) {
            $mesAtual = (int) now()->month;
            $anoAtual = (int) now()->year;

            $freightQuery = FreightEntry::query()
                ->whereYear('data', $anoAtual)
                ->whereMonth('data', $mesAtual);

            if (! $isMaster) {
                $freightQuery->where('autor_id', $user->id);
            }

            if ($user->dataScopeFor('freight') === 'units') {
                $freightQuery->whereIn('unidade_id', $freightUnitScope !== [] ? $freightUnitScope : [0]);
            }

            $freightEntriesMes = (clone $freightQuery)->count();
            $freightTotalMes = (float) ((clone $freightQuery)->sum('frete_total'));
            $freightTotalTerceirosMes = (float) ((clone $freightQuery)->sum('frete_terceiros'));
            $freightKmMes = (float) ((clone $freightQuery)->sum('km_rodado'));
        }

        if ($canViewFinesPanel && $hasMultas) {
            $mesAtual = (int) now()->month;
            $anoAtual = (int) now()->year;

            $finesQuery = Multa::query()
                ->whereYear('data', $anoAtual)
                ->whereMonth('data', $mesAtual);

            if ($user->dataScopeFor('fines') === 'units') {
                $finesQuery->whereIn('unidade_id', $finesUnitScope !== [] ? $finesUnitScope : [0]);
            }

            $finesCountMes = (clone $finesQuery)->count();
            $finesTotalMes = (float) ((clone $finesQuery)->sum('valor'));
        }

        if ($canViewProgrammingPanel && $hasProgramacaoViagens && $hasProgramacaoEscalas) {
            $programmingTripsToday = ProgramacaoViagem::query()
                ->whereDate('data_viagem', $today->toDateString())
                ->when(
                    $user->dataScopeFor('programming') === 'units',
                    fn ($query) => $query->whereIn('unidade_id', $programmingUnitScope !== [] ? $programmingUnitScope : [0]),
                )
                ->count();

            $programmingAssignedToday = ProgramacaoEscala::query()
                ->whereHas('viagem', function ($query) use ($today, $user, $programmingUnitScope) {
                    $query->whereDate('data_viagem', $today->toDateString());

                    if ($user->dataScopeFor('programming') === 'units') {
                        $query->whereIn('unidade_id', $programmingUnitScope !== [] ? $programmingUnitScope : [0]);
                    }
                })
                ->count();

            $programmingUnassignedToday = max(0, $programmingTripsToday - $programmingAssignedToday);

            $assignedDriverIds = ProgramacaoEscala::query()
                ->whereHas('viagem', fn ($query) => $query->whereDate('data_viagem', $today->toDateString()))
                ->pluck('colaborador_id')
                ->filter()
                ->unique()
                ->values()
                ->all();

            if ($hasColaboradores) {
                $programmingAvailableDrivers = Colaborador::query()
                    ->where('ativo', true)
                    ->whereNotNull('cnh')
                    ->when(
                        $user->dataScopeFor('programming') === 'units',
                        fn ($query) => $query->whereIn('unidade_id', $programmingUnitScope !== [] ? $programmingUnitScope : [0]),
                    )
                    ->when(
                        count($assignedDriverIds) > 0,
                        fn ($query) => $query->whereNotIn('id', $assignedDriverIds),
                    )
                    ->count();
            }

            if ($hasPlacasFrota) {
                $assignedTruckIds = ProgramacaoEscala::query()
                    ->whereHas('viagem', function ($query) use ($today, $user, $programmingUnitScope) {
                        $query->whereDate('data_viagem', $today->toDateString());

                        if ($user->dataScopeFor('programming') === 'units') {
                            $query->whereIn('unidade_id', $programmingUnitScope !== [] ? $programmingUnitScope : [0]);
                        }
                    })
                    ->pluck('placa_frota_id')
                    ->filter()
                    ->unique()
                    ->values()
                    ->all();

                $programmingAvailableTrucks = PlacaFrota::query()
                    ->when(
                        $user->dataScopeFor('programming') === 'units',
                        fn ($query) => $query->whereIn('unidade_id', $programmingUnitScope !== [] ? $programmingUnitScope : [0]),
                    )
                    ->when(
                        count($assignedTruckIds) > 0,
                        fn ($query) => $query->whereNotIn('id', $assignedTruckIds),
                    )
                    ->count();
            }
        }

        if (($canViewVacationsPanel || $canViewOperationsPanel) && $hasColaboradores && $hasFeriasLancamentos) {
            $activeCollaborators = Colaborador::query()
                ->where('ativo', true)
                ->whereNotNull('data_admissao')
                ->when(
                    $user->dataScopeFor('vacations') === 'units',
                    fn ($query) => $query->whereIn('unidade_id', $vacationUnitScope !== [] ? $vacationUnitScope : [0]),
                )
                ->select(['id', 'unidade_id', 'data_admissao'])
                ->get();

            if ($activeCollaborators->isNotEmpty()) {
                $latestPeriodEndByCollaborator = FeriasLancamento::query()
                    ->whereIn('colaborador_id', $activeCollaborators->pluck('id')->all())
                    ->selectRaw('colaborador_id, MAX(periodo_aquisitivo_fim) as base_fim')
                    ->groupBy('colaborador_id')
                    ->pluck('base_fim', 'colaborador_id');

                $today = CarbonImmutable::today();
                $plus2Months = $today->addMonths(2);

                foreach ($activeCollaborators as $colaborador) {
                    $admissao = $colaborador->data_admissao?->toDateString();

                    if (! $admissao) {
                        continue;
                    }

                    $baseDate = (string) ($latestPeriodEndByCollaborator->get($colaborador->id) ?? $admissao);
                    $base = CarbonImmutable::parse($baseDate);
                    $direito = $base->addYear();
                    $limite = $direito->addMonths(11);

                    $daysSinceBase = $base->diffInDays($today) + 1;
                    if ($daysSinceBase > 636 && $daysSinceBase <= 699) {
                        $unitId = (int) ($colaborador->unidade_id ?? 0);
                        if ($unitId > 0) {
                            $urgentByUnit[$unitId] = ((int) ($urgentByUnit[$unitId] ?? 0)) + 1;
                        }
                    }

                    if ($limite->lt($today)) {
                        $feriasVencidas++;
                    }

                    if ($limite->betweenIncluded($today, $plus2Months)) {
                        $feriasProximos2Meses++;
                    }

                    if ($limite->betweenIncluded($today, $today->addMonths(4))) {
                        $feriasProximos4Meses++;
                    }
                }

                $taxaFeriasVencidas = $activeCollaborators->count() > 0
                    ? round(($feriasVencidas / $activeCollaborators->count()) * 100, 2)
                    : 0.0;
            }
        }

        $freightCards = [];
        $freightCompanyTotal = 0.0;

        if ($canViewFreightPanel && $hasFreightEntries) {
            $freightQuery = FreightEntry::query()
                ->whereDate('data', '>=', $periodRange['start']->toDateString())
                ->whereDate('data', '<=', $periodRange['end']->toDateString());

            if (! $isMaster) {
                $freightQuery->where('autor_id', $user->id);
            }

            if ($user->dataScopeFor('freight') === 'units') {
                $freightQuery->whereIn('unidade_id', $freightUnitScope !== [] ? $freightUnitScope : [0]);
            }

            $freightCompanyTotal = (float) ((clone $freightQuery)->sum('frete_total'));

            $freightByUnit = (clone $freightQuery)
                ->selectRaw('unidade_id, SUM(frete_total) as total_valor')
                ->groupBy('unidade_id')
                ->pluck('total_valor', 'unidade_id');

            $units = Unidade::query()
                ->orderBy('nome')
                ->get(['id', 'nome']);

            foreach ($units as $unit) {
                $unitTotal = (float) ($freightByUnit[(string) $unit->id] ?? $freightByUnit[$unit->id] ?? 0);

                $freightCards[] = [
                    'unidade_id' => (int) $unit->id,
                    'unidade_nome' => (string) $unit->nome,
                    'total_valor' => round($unitTotal, 2),
                    'percentual_total' => $freightCompanyTotal > 0
                        ? round(($unitTotal / $freightCompanyTotal) * 100, 2)
                        : 0.0,
                ];
            }
        }

        $vacationsByUnit = [];

        if (($canViewVacationsPanel || $canViewRegistryPanel) && $hasFeriasLancamentos) {
            $activeVacations = FeriasLancamento::query()
                ->with([
                    'colaborador:id,nome,unidade_id',
                    'unidade:id,nome',
                ])
                ->whereDate('data_inicio', '<=', $today->toDateString())
                ->whereDate('data_fim', '>=', $today->toDateString())
                ->when(
                    $user->dataScopeFor('vacations') === 'units',
                    fn ($query) => $query->whereIn('unidade_id', $vacationUnitScope !== [] ? $vacationUnitScope : [0]),
                )
                ->orderBy('data_fim')
                ->get();

            $grouped = [];

            foreach ($activeVacations as $vacation) {
                $unitId = (int) ($vacation->unidade_id ?? 0);

                if ($unitId <= 0) {
                    continue;
                }

                if (! isset($grouped[$unitId])) {
                    $grouped[$unitId] = [
                        'unidade_id' => $unitId,
                        'unidade_nome' => (string) ($vacation->unidade?->nome ?? 'Sem unidade'),
                        'urgent_count' => (int) ($urgentByUnit[$unitId] ?? 0),
                        'on_vacation' => [],
                    ];
                }

                $grouped[$unitId]['on_vacation'][] = [
                    'colaborador_id' => (int) ($vacation->colaborador_id ?? 0),
                    'nome' => (string) ($vacation->colaborador?->nome ?? '-'),
                    'data_inicio' => $vacation->data_inicio?->toDateString(),
                    'data_fim' => $vacation->data_fim?->toDateString(),
                ];
            }

            foreach ($urgentByUnit as $unitId => $urgentCount) {
                $normalizedUnitId = (int) $unitId;

                if (isset($grouped[$normalizedUnitId])) {
                    continue;
                }

                $unit = Unidade::query()->find($normalizedUnitId, ['id', 'nome']);

                $grouped[$normalizedUnitId] = [
                    'unidade_id' => $normalizedUnitId,
                    'unidade_nome' => (string) ($unit?->nome ?? 'Sem unidade'),
                    'urgent_count' => (int) $urgentCount,
                    'on_vacation' => [],
                ];
            }

            $vacationsByUnit = Collection::make($grouped)
                ->sortBy('unidade_nome', SORT_NATURAL | SORT_FLAG_CASE)
                ->values()
                ->all();
        }

        $payrollRowsByUnit = [];
        $payrollColumns = [];
        $payrollTotals = [
            'values' => [],
            'total' => 0.0,
        ];

        if ($canViewPayrollPanel && $hasPagamentos) {
            $paymentTypes = TipoPagamento::query()
                ->orderBy('nome')
                ->get(['id', 'nome']);

            $payrollColumns = $paymentTypes
                ->map(fn (TipoPagamento $paymentType): array => [
                    'key' => 'tipo_'.$paymentType->id,
                    'label' => (string) $paymentType->nome,
                    'tipo_pagamento_id' => (int) $paymentType->id,
                ])
                ->values()
                ->all();

            $payrollColumns[] = [
                'key' => 'sem_tipo',
                'label' => 'Sem tipo',
                'tipo_pagamento_id' => null,
            ];

            $defaultPayrollValues = [];

            foreach ($payrollColumns as $column) {
                $defaultPayrollValues[(string) $column['key']] = 0.0;
            }

            $payrollTotals = [
                'values' => $defaultPayrollValues,
                'total' => 0.0,
            ];

            $columnByPaymentTypeId = Collection::make($payrollColumns)
                ->filter(fn (array $column): bool => is_int($column['tipo_pagamento_id']))
                ->mapWithKeys(fn (array $column): array => [
                    (int) $column['tipo_pagamento_id'] => (string) $column['key'],
                ]);

            $payments = Pagamento::query()
                ->with([
                    'unidade:id,nome',
                    'tipoPagamento:id,nome',
                ])
                ->where('competencia_ano', $payrollCompetenciaAno)
                ->where('competencia_mes', $payrollCompetenciaMes)
                ->when(! $isMaster, fn ($query) => $query->where('autor_id', $user->id))
                ->when(
                    $user->dataScopeFor('payroll') === 'units',
                    fn ($query) => $query->whereIn('unidade_id', $payrollUnitScope !== [] ? $payrollUnitScope : [0]),
                )
                ->get();

            $grouped = [];

            foreach ($payments as $payment) {
                $unitId = (int) ($payment->unidade_id ?? 0);

                if ($unitId <= 0) {
                    continue;
                }

                if (! isset($grouped[$unitId])) {
                    $grouped[$unitId] = [
                        'unidade_id' => $unitId,
                        'unidade_nome' => (string) ($payment->unidade?->nome ?? 'Sem unidade'),
                        'values' => $defaultPayrollValues,
                        'total' => 0.0,
                    ];
                }

                $value = (float) $payment->valor;
                $columnKey = $columnByPaymentTypeId->get((int) ($payment->tipo_pagamento_id ?? 0), 'sem_tipo');

                $grouped[$unitId]['values'][$columnKey] += $value;
                $payrollTotals['values'][$columnKey] += $value;

                $grouped[$unitId]['total'] += $value;
                $payrollTotals['total'] += $value;
            }

            $hasUnknownTypeValues = ((float) ($payrollTotals['values']['sem_tipo'] ?? 0.0)) > 0;

            if (! $hasUnknownTypeValues) {
                $payrollColumns = array_values(array_filter(
                    $payrollColumns,
                    fn (array $column): bool => (string) $column['key'] !== 'sem_tipo',
                ));

                unset($payrollTotals['values']['sem_tipo']);

                foreach ($grouped as $groupedUnitId => $groupedRow) {
                    unset($grouped[$groupedUnitId]['values']['sem_tipo']);
                }
            }

            $payrollRowsByUnit = Collection::make($grouped)
                ->map(function (array $row): array {
                    $values = [];

                    foreach ((array) ($row['values'] ?? []) as $key => $value) {
                        $values[(string) $key] = round((float) $value, 2);
                    }

                    return [
                        'unidade_id' => (int) $row['unidade_id'],
                        'unidade_nome' => (string) $row['unidade_nome'],
                        'values' => $values,
                        'total' => round((float) $row['total'], 2),
                    ];
                })
                ->sortBy('unidade_nome', SORT_NATURAL | SORT_FLAG_CASE)
                ->values()
                ->all();

            $roundedTotals = [];

            foreach ((array) ($payrollTotals['values'] ?? []) as $key => $value) {
                $roundedTotals[(string) $key] = round((float) $value, 2);
            }

            $payrollTotals = [
                'values' => $roundedTotals,
                'total' => round((float) $payrollTotals['total'], 2),
            ];
        }

        $interviewsByUnit = [];
        $recentAdmissions = [];
        $recentDismissals = [];

        if ($canViewInterviewsPanel) {
            $interviewsQuery = DriverInterview::query()
                ->with('hiringUnidade:id,nome');

            if (! $isMaster) {
                $interviewsQuery->where('author_id', $user->id);
            }

            $interviews = $interviewsQuery->get(['id', 'hiring_unidade_id']);

            $interviewsByUnit = $interviews
                ->groupBy('hiring_unidade_id')
                ->map(function ($group, $unitId): array {
                    $unit = $group->first()?->hiringUnidade;

                    return [
                        'unidade_id' => (int) $unitId,
                        'unidade_nome' => (string) ($unit?->nome ?? 'Sem unidade'),
                        'total_entrevistas' => $group->count(),
                    ];
                })
                ->sortByDesc('total_entrevistas')
                ->values()
                ->all();

            $recentAdmissions = Colaborador::query()
                ->with(['unidade:id,nome', 'funcao:id,nome'])
                ->whereNotNull('data_admissao')
                ->when(
                    $user->dataScopeFor('registry') === 'units',
                    fn ($query) => $query->whereIn('unidade_id', $registryUnitScope !== [] ? $registryUnitScope : [0]),
                )
                ->orderByDesc('data_admissao')
                ->limit(8)
                ->get(['id', 'nome', 'unidade_id', 'funcao_id', 'data_admissao'])
                ->map(fn (Colaborador $collaborator): array => [
                    'id' => (int) $collaborator->id,
                    'nome' => (string) $collaborator->nome,
                    'unidade_nome' => (string) ($collaborator->unidade?->nome ?? '-'),
                    'funcao_nome' => (string) ($collaborator->funcao?->nome ?? '-'),
                    'data' => $collaborator->data_admissao?->toDateString(),
                ])
                ->values()
                ->all();

            $recentDismissals = Colaborador::query()
                ->with(['unidade:id,nome', 'funcao:id,nome'])
                ->whereNotNull('data_demissao')
                ->when(
                    $user->dataScopeFor('registry') === 'units',
                    fn ($query) => $query->whereIn('unidade_id', $registryUnitScope !== [] ? $registryUnitScope : [0]),
                )
                ->orderByDesc('data_demissao')
                ->limit(8)
                ->get(['id', 'nome', 'unidade_id', 'funcao_id', 'data_demissao'])
                ->map(fn (Colaborador $collaborator): array => [
                    'id' => (int) $collaborator->id,
                    'nome' => (string) $collaborator->nome,
                    'unidade_nome' => (string) ($collaborator->unidade?->nome ?? '-'),
                    'funcao_nome' => (string) ($collaborator->funcao?->nome ?? '-'),
                    'data' => $collaborator->data_demissao?->toDateString(),
                ])
                ->values()
                ->all();
        }

        $modules = [];

        if ($canViewInterviewsPanel) {
            $modules[] = [
                'key' => 'interviews',
                'title' => 'Entrevistas',
                'description' => 'Gestão de entrevistas e próximos passos de candidatos.',
                'href' => '/transport/interviews',
                'icon' => 'list-checks',
                'metrics' => [
                    'total_interviews' => $interviewsTotal,
                ],
            ];
        }

        if ($canViewPayrollPanel) {
            $modules[] = [
                'key' => 'payroll',
                'title' => 'Pagamentos',
                'description' => 'Lançamentos de pagamentos e relatórios por unidade e colaborador.',
                'href' => '/transport/payroll',
                'icon' => 'wallet',
                'metrics' => [
                    'total_current_month' => $totalPagamentosMes,
                ],
            ];
        }

        if ($canViewVacationsPanel) {
            $modules[] = [
                'key' => 'vacations',
                'title' => 'Férias',
                'description' => 'Dashboard, lista e lançamento de férias por período aquisitivo.',
                'href' => '/transport/vacations/dashboard',
                'icon' => 'clipboard-check',
                'metrics' => [
                    'vacations_expired' => $feriasVencidas,
                    'vacations_due_2_months' => $feriasProximos2Meses,
                    'vacations_due_4_months' => $feriasProximos4Meses,
                    'vacations_expired_rate' => $taxaFeriasVencidas,
                ],
            ];
        }

        if ($canViewRegistryPanel) {
            $modules[] = [
                'key' => 'registry',
                'title' => 'Cadastro',
                'description' => 'Cadastro de colaboradores, usuários e funções.',
                'href' => '/transport/registry/collaborators',
                'icon' => 'users',
                'metrics' => [
                    'active_collaborators' => $colaboradoresAtivos,
                ],
            ];
        }

        if ($canViewFreightPanel) {
            $modules[] = [
                'key' => 'freight',
                'title' => 'Gestão de Fretes',
                'description' => 'Lançamentos únicos e análises diárias/mensais de fretes por unidade.',
                'href' => '/transport/freight/dashboard',
                'icon' => 'truck',
                'metrics' => [
                    'freight_entries_current_month' => $freightEntriesMes,
                    'freight_total_current_month' => $freightTotalMes,
                    'freight_avg_km_current_month' => $freightKmMes > 0
                        ? round($freightTotalMes / $freightKmMes, 2)
                        : 0.0,
                    'freight_third_share_current_month' => ($freightTotalMes + $freightTotalTerceirosMes) > 0
                        ? round(($freightTotalTerceirosMes / ($freightTotalMes + $freightTotalTerceirosMes)) * 100, 2)
                        : 0.0,
                ],
            ];
        }

        if ($canViewFinesPanel) {
            $modules[] = [
                'key' => 'fines',
                'title' => 'Gestão de Multas',
                'description' => 'Dashboard, lançamento e lista de multas com filtros operacionais e vínculo com descontos.',
                'href' => '/transport/fines/dashboard',
                'icon' => 'circle-alert',
                'metrics' => [
                    'fines_count_current_month' => $finesCountMes,
                    'fines_total_current_month' => $finesTotalMes,
                ],
            ];
        }

        if ($canViewProgrammingPanel) {
            $modules[] = [
                'key' => 'programming',
                'title' => 'Programação',
                'description' => 'Escalação de viagens com base de importação, disponibilidade e jornada de motoristas.',
                'href' => '/transport/programming/dashboard',
                'icon' => 'calendar-clock',
                'metrics' => [
                    'programming_trips_today' => $programmingTripsToday,
                    'programming_unassigned_today' => $programmingUnassignedToday,
                    'programming_available_drivers' => $programmingAvailableDrivers,
                    'programming_available_trucks' => $programmingAvailableTrucks,
                ],
            ];
        }

        if ($canViewOperationsPanel) {
            $modules[] = [
                'key' => 'operations',
                'title' => 'Pendências',
                'description' => 'Central de pendências críticas para priorização diária.',
                'href' => '/transport/pendencias',
                'icon' => 'clipboard-check',
                'metrics' => [
                    'operations_pending_total' => $feriasVencidas + $feriasProximos2Meses,
                ],
            ];
        }

        $payload = [
            'modules' => $modules,
            'filters' => [
                'period_mode' => $periodMode,
                'competencia_mes' => $periodRange['competencia_mes'],
                'competencia_ano' => $periodRange['competencia_ano'],
                'payroll_competencia_mes' => $payrollCompetenciaMes,
                'payroll_competencia_ano' => $payrollCompetenciaAno,
                'month_options' => $monthOptions,
                'period_start' => $periodRange['start']->toDateString(),
                'period_end' => $periodRange['end']->toDateString(),
            ],
            'super_dashboard' => [
                'freight' => $canViewFreightPanel ? [
                    'cards' => $freightCards,
                    'company' => [
                        'unidade_nome' => 'Kaique',
                        'total_valor' => round($freightCompanyTotal, 2),
                        'percentual_total' => $freightCompanyTotal > 0 ? 100.0 : 0.0,
                    ],
                ] : null,
                'vacations' => $canViewVacationsPanel ? [
                    'by_unit' => $vacationsByUnit,
                ] : null,
                'payroll' => $canViewPayrollPanel ? [
                    'columns' => $payrollColumns,
                    'rows' => $payrollRowsByUnit,
                    'totals' => $payrollTotals,
                ] : null,
                'interviews' => $canViewInterviewsPanel ? [
                    'totals_by_unit' => $interviewsByUnit,
                    'recent_admissions' => $recentAdmissions,
                    'recent_dismissals' => $recentDismissals,
                ] : null,
            ],
        ];

        Cache::put($cacheKey, $payload, now()->addSeconds(45));

        return response()->json($payload);
    }

    /**
     * @return array{start: CarbonImmutable, end: CarbonImmutable, competencia_mes: int, competencia_ano: int}
     */
    private function resolvePeriodRange(
        string $periodMode,
        int $requestedMonth,
        int $requestedYear,
        CarbonImmutable $today,
    ): array {
        if ($periodMode === '3m') {
            return [
                'start' => $today->startOfMonth()->subMonths(2),
                'end' => $today->endOfMonth(),
                'competencia_mes' => (int) $today->month,
                'competencia_ano' => (int) $today->year,
            ];
        }

        if ($periodMode === 'month') {
            $safeMonth = max(1, min(12, $requestedMonth));
            $safeYear = max(2020, min(2100, $requestedYear));
            $monthRef = CarbonImmutable::create($safeYear, $safeMonth, 1);

            return [
                'start' => $monthRef->startOfMonth(),
                'end' => $monthRef->endOfMonth(),
                'competencia_mes' => (int) $safeMonth,
                'competencia_ano' => (int) $safeYear,
            ];
        }

        return [
            'start' => $today->startOfMonth(),
            'end' => $today->endOfMonth(),
            'competencia_mes' => (int) $today->month,
            'competencia_ano' => (int) $today->year,
        ];
    }

    /**
     * @return array<int, array{value:string,label:string,mes:int,ano:int}>
     */
    private function buildMonthOptions(CarbonImmutable $today, int $months): array
    {
        $labels = [
            1 => 'Jan',
            2 => 'Fev',
            3 => 'Mar',
            4 => 'Abr',
            5 => 'Mai',
            6 => 'Jun',
            7 => 'Jul',
            8 => 'Ago',
            9 => 'Set',
            10 => 'Out',
            11 => 'Nov',
            12 => 'Dez',
        ];

        $items = [];

        for ($index = 0; $index < $months; $index++) {
            $monthRef = $today->startOfMonth()->subMonths($index);
            $month = (int) $monthRef->month;
            $year = (int) $monthRef->year;

            $items[] = [
                'value' => sprintf('%04d-%02d', $year, $month),
                'label' => sprintf('%s %02d', $labels[$month] ?? 'Mês', $year % 100),
                'mes' => $month,
                'ano' => $year,
            ];
        }

        return $items;
    }

}
