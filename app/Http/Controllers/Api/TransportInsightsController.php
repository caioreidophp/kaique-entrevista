<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Colaborador;
use App\Models\DriverInterview;
use App\Models\FeriasLancamento;
use App\Models\FreightCanceledLoad;
use App\Models\FreightEntry;
use App\Models\FreightSpotEntry;
use App\Models\Multa;
use App\Models\Onboarding;
use App\Models\Pagamento;
use App\Models\ProgramacaoViagem;
use App\Models\Unidade;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransportInsightsController extends Controller
{
    public function pending(Request $request): JsonResponse
    {
        abort_unless($this->canAccessInsights($request), 403);

        $user = $request->user();
        $isMaster = $user->isMasterAdmin();

        $baseInterviews = DriverInterview::query();

        if (! $isMaster) {
            $baseInterviews->where('author_id', $user->id);
        }

        $waitingVacancy = (clone $baseInterviews)
            ->where('hr_status', 'aguardando_vaga')
            ->count();

        $practicalTest = (clone $baseInterviews)
            ->where('hr_status', 'teste_pratico')
            ->count();

        $guepToDo = (clone $baseInterviews)
            ->where('hr_status', 'guep')
            ->whereIn('guep_status', ['aguardando', 'a_fazer'])
            ->count();

        $today = CarbonImmutable::today();
        $plus2Months = $today->addMonths(2);

        $activeCollaborators = Colaborador::query()
            ->when(! $isMaster && $this->hasRestrictedUnitScope($request, 'registry'), function (Builder $query) use ($request): void {
                $query->whereIn('unidade_id', $request->user()->allowedUnitIdsFor('registry'));
            })
            ->where('ativo', true)
            ->whereNotNull('data_admissao')
            ->select(['id', 'data_admissao'])
            ->get();

        $latestPeriodEndByCollaborator = FeriasLancamento::query()
            ->whereIn('colaborador_id', $activeCollaborators->pluck('id')->all())
            ->selectRaw('colaborador_id, MAX(periodo_aquisitivo_fim) as base_fim')
            ->groupBy('colaborador_id')
            ->pluck('base_fim', 'colaborador_id');

        $vacationsExpired = 0;
        $vacationsDue2Months = 0;

        foreach ($activeCollaborators as $colaborador) {
            $admissao = $colaborador->data_admissao?->toDateString();

            if (! $admissao) {
                continue;
            }

            $baseDate = (string) ($latestPeriodEndByCollaborator->get($colaborador->id) ?? $admissao);
            $limite = CarbonImmutable::parse($baseDate)->addYear()->addMonths(11);

            if ($limite->lt($today)) {
                $vacationsExpired++;
            }

            if ($limite->betweenIncluded($today, $plus2Months)) {
                $vacationsDue2Months++;
            }
        }

        $canceledLoadsToReceive = FreightCanceledLoad::query()
            ->when(! $isMaster, fn ($query) => $query->where('autor_id', $user->id))
            ->when($this->hasRestrictedUnitScope($request, 'freight'), fn ($query) => $query->whereIn('unidade_id', $user->allowedUnitIdsFor('freight')))
            ->where('status', 'a_receber')
            ->count();

        $month = now()->month;
        $year = now()->year;

        $launchedPayrollCollaborators = Pagamento::query()
            ->when(! $isMaster, fn ($query) => $query->where('autor_id', $user->id))
            ->when($this->hasRestrictedUnitScope($request, 'payroll'), fn ($query) => $query->whereIn('unidade_id', $user->allowedUnitIdsFor('payroll')))
            ->where('competencia_mes', $month)
            ->where('competencia_ano', $year)
            ->distinct('colaborador_id')
            ->count('colaborador_id');

        $activeCollaboratorsCount = Colaborador::query()
            ->when($this->hasRestrictedUnitScope($request, 'registry'), fn ($query) => $query->whereIn('unidade_id', $user->allowedUnitIdsFor('registry')))
            ->where('ativo', true)
            ->count();
        $payrollPendingCollaborators = max($activeCollaboratorsCount - $launchedPayrollCollaborators, 0);

        return response()->json([
            'data' => [
                'interviews' => [
                    'waiting_vacancy' => $waitingVacancy,
                    'practical_test' => $practicalTest,
                    'guep_to_do' => $guepToDo,
                    'total' => $waitingVacancy + $practicalTest + $guepToDo,
                ],
                'vacations' => [
                    'expired' => $vacationsExpired,
                    'due_2_months' => $vacationsDue2Months,
                ],
                'freight' => [
                    'canceled_to_receive' => $canceledLoadsToReceive,
                ],
                'payroll' => [
                    'pending_collaborators' => $payrollPendingCollaborators,
                ],
            ],
        ]);
    }

    public function executive(Request $request): JsonResponse
    {
        abort_unless($this->canAccessInsights($request), 403);

        $user = $request->user();
        $isMaster = $user->isMasterAdmin();

        $month = now()->month;
        $year = now()->year;

        $interviewsBase = DriverInterview::query();
        $payrollBase = Pagamento::query()
            ->where('competencia_mes', $month)
            ->where('competencia_ano', $year);
        $freightBase = FreightEntry::query()
            ->whereYear('data', $year)
            ->whereMonth('data', $month);
        $spotBase = FreightSpotEntry::query()
            ->whereYear('data', $year)
            ->whereMonth('data', $month);

        if (! $isMaster) {
            $interviewsBase->where('author_id', $user->id);
            $payrollBase->where('autor_id', $user->id);
            $freightBase->where('autor_id', $user->id);
            $spotBase->where('autor_id', $user->id);
        }

        if ($this->hasRestrictedUnitScope($request, 'payroll')) {
            $payrollBase->whereIn('unidade_id', $user->allowedUnitIdsFor('payroll'));
        }

        if ($this->hasRestrictedUnitScope($request, 'freight')) {
            $allowedUnits = $user->allowedUnitIdsFor('freight');
            $freightBase->whereIn('unidade_id', $allowedUnits);
            $spotBase->whereIn('unidade_origem_id', $allowedUnits);
        }

        $totalInterviews = (clone $interviewsBase)->count();
        $approvedInterviews = (clone $interviewsBase)
            ->where('hr_status', 'aprovado')
            ->count();
        $approvalRate = $totalInterviews > 0
            ? round(($approvedInterviews / $totalInterviews) * 100, 2)
            : 0.0;

        $totalPayroll = (float) (clone $payrollBase)->sum('valor');
        $totalPayrollLaunches = (clone $payrollBase)->count();
        $activeCollaborators = Colaborador::query()
            ->when($this->hasRestrictedUnitScope($request, 'registry'), fn ($query) => $query->whereIn('unidade_id', $user->allowedUnitIdsFor('registry')))
            ->where('ativo', true)
            ->count();
        $coverageRate = $activeCollaborators > 0
            ? round((($totalPayrollLaunches / $activeCollaborators) * 100), 2)
            : 0.0;

        $freightTotal = (float) (clone $freightBase)->sum('frete_total');
        $freightEntries = (clone $freightBase)->count();
        $freightSpotTotal = (float) (clone $spotBase)->sum('frete_spot');
        $freightSpotShare = ($freightTotal + $freightSpotTotal) > 0
            ? round(($freightSpotTotal / ($freightTotal + $freightSpotTotal)) * 100, 2)
            : 0.0;

        $alerts = [];

        if ($coverageRate < 95) {
            $alerts[] = [
                'level' => 'warning',
                'title' => 'Cobertura da folha abaixo da meta',
                'detail' => "Cobertura atual {$coverageRate}% (meta 95%).",
            ];
        }

        if ($freightSpotShare > 35) {
            $alerts[] = [
                'level' => 'warning',
                'title' => 'Dependência alta de frete spot',
                'detail' => "Participação spot em {$freightSpotShare}% no mês.",
            ];
        }

        if ($approvalRate < 40 && $totalInterviews >= 10) {
            $alerts[] = [
                'level' => 'info',
                'title' => 'Taxa de aprovação baixa',
                'detail' => "Aprovação em entrevistas está em {$approvalRate}%.",
            ];
        }

        return response()->json([
            'data' => [
                'competencia_mes' => $month,
                'competencia_ano' => $year,
                'interviews' => [
                    'total' => $totalInterviews,
                    'approved' => $approvedInterviews,
                    'approval_rate' => $approvalRate,
                ],
                'payroll' => [
                    'total' => $totalPayroll,
                    'launches' => $totalPayrollLaunches,
                    'coverage_rate' => $coverageRate,
                ],
                'freight' => [
                    'entries' => $freightEntries,
                    'total' => $freightTotal,
                    'spot_total' => $freightSpotTotal,
                    'spot_share' => $freightSpotShare,
                ],
                'alerts' => $alerts,
            ],
        ]);
    }

    public function pendingByUnit(Request $request): JsonResponse
    {
        abort_unless($this->canAccessInsights($request), 403);

        $user = $request->user();
        $allowedUnitIds = $this->visibleUnitIds($request, 'registry');
        $today = now()->toDateString();
        $month = now()->month;
        $year = now()->year;

        $units = Unidade::query()
            ->when($allowedUnitIds !== null, fn ($query) => $query->whereIn('id', $allowedUnitIds))
            ->orderBy('nome')
            ->get(['id', 'nome']);

        $activeByUnit = Colaborador::query()
            ->selectRaw('unidade_id, COUNT(*) as total')
            ->where('ativo', true)
            ->when($allowedUnitIds !== null, fn ($query) => $query->whereIn('unidade_id', $allowedUnitIds))
            ->groupBy('unidade_id')
            ->pluck('total', 'unidade_id');

        $payrollLaunchedByUnit = Pagamento::query()
            ->selectRaw('unidade_id, COUNT(DISTINCT colaborador_id) as total')
            ->where('competencia_mes', $month)
            ->where('competencia_ano', $year)
            ->when(! $user->isMasterAdmin(), fn ($query) => $query->where('autor_id', $user->id))
            ->when($this->visibleUnitIds($request, 'payroll') !== null, fn ($query) => $query->whereIn('unidade_id', $this->visibleUnitIds($request, 'payroll')))
            ->groupBy('unidade_id')
            ->pluck('total', 'unidade_id');

        $freightPendingByUnit = FreightCanceledLoad::query()
            ->selectRaw('unidade_id, COUNT(*) as total')
            ->where('status', 'a_receber')
            ->when(! $user->isMasterAdmin(), fn ($query) => $query->where('autor_id', $user->id))
            ->when($this->visibleUnitIds($request, 'freight') !== null, fn ($query) => $query->whereIn('unidade_id', $this->visibleUnitIds($request, 'freight')))
            ->groupBy('unidade_id')
            ->pluck('total', 'unidade_id');

        $onboardingOpenByUnit = Onboarding::query()
            ->selectRaw('colaboradores.unidade_id, COUNT(DISTINCT onboardings.id) as total')
            ->join('colaboradores', 'colaboradores.id', '=', 'onboardings.colaborador_id')
            ->whereIn('onboardings.status', ['em_andamento', 'bloqueado'])
            ->when($allowedUnitIds !== null, fn ($query) => $query->whereIn('colaboradores.unidade_id', $allowedUnitIds))
            ->groupBy('colaboradores.unidade_id')
            ->pluck('total', 'colaboradores.unidade_id');

        $onboardingOverdueByUnit = Onboarding::query()
            ->selectRaw('colaboradores.unidade_id, COUNT(DISTINCT onboardings.id) as total')
            ->join('colaboradores', 'colaboradores.id', '=', 'onboardings.colaborador_id')
            ->join('onboarding_items', 'onboarding_items.onboarding_id', '=', 'onboardings.id')
            ->where('onboarding_items.required', true)
            ->where('onboarding_items.status', '!=', 'aprovado')
            ->whereDate('onboarding_items.due_date', '<', $today)
            ->when($allowedUnitIds !== null, fn ($query) => $query->whereIn('colaboradores.unidade_id', $allowedUnitIds))
            ->groupBy('colaboradores.unidade_id')
            ->pluck('total', 'colaboradores.unidade_id');

        return response()->json([
            'generated_at' => now()->toISOString(),
            'data' => $units->map(function (Unidade $unit) use ($activeByUnit, $payrollLaunchedByUnit, $freightPendingByUnit, $onboardingOpenByUnit, $onboardingOverdueByUnit): array {
                $active = (int) ($activeByUnit[$unit->id] ?? 0);
                $launched = (int) ($payrollLaunchedByUnit[$unit->id] ?? 0);

                return [
                    'unidade_id' => $unit->id,
                    'unidade_nome' => $unit->nome,
                    'active_collaborators' => $active,
                    'payroll_pending_collaborators' => max($active - $launched, 0),
                    'freight_canceled_to_receive' => (int) ($freightPendingByUnit[$unit->id] ?? 0),
                    'onboarding_open' => (int) ($onboardingOpenByUnit[$unit->id] ?? 0),
                    'onboarding_overdue' => (int) ($onboardingOverdueByUnit[$unit->id] ?? 0),
                ];
            })->values(),
        ]);
    }

    public function quality(Request $request): JsonResponse
    {
        abort_unless($this->canAccessInsights($request), 403);

        $allowedUnitIds = $this->visibleUnitIds($request, 'registry');

        $collaborators = Colaborador::query()
            ->when($allowedUnitIds !== null, fn ($query) => $query->whereIn('unidade_id', $allowedUnitIds))
            ->get([
                'id',
                'unidade_id',
                'nome',
                'cpf_hash',
                'telefone',
                'email',
                'data_admissao',
                'funcao_id',
                'foto_3x4_path',
                'cnh_attachment_path',
                'work_card_attachment_path',
            ]);

        $duplicates = $collaborators
            ->filter(fn (Colaborador $colaborador): bool => filled($colaborador->cpf_hash))
            ->groupBy('cpf_hash')
            ->filter(fn ($group): bool => $group->count() > 1);

        $issuesByUnit = $collaborators
            ->groupBy(fn (Colaborador $colaborador): int => (int) ($colaborador->unidade_id ?? 0))
            ->map(function ($group, $unitId): array {
                $rows = collect($group);

                return [
                    'unidade_id' => (int) $unitId,
                    'missing_phone' => $rows->filter(fn (Colaborador $colaborador): bool => blank($colaborador->telefone))->count(),
                    'missing_email' => $rows->filter(fn (Colaborador $colaborador): bool => blank($colaborador->email))->count(),
                    'missing_admission_date' => $rows->filter(fn (Colaborador $colaborador): bool => blank($colaborador->data_admissao))->count(),
                    'missing_function' => $rows->filter(fn (Colaborador $colaborador): bool => blank($colaborador->funcao_id))->count(),
                    'missing_photo' => $rows->filter(fn (Colaborador $colaborador): bool => blank($colaborador->foto_3x4_path))->count(),
                    'missing_cnh_attachment' => $rows->filter(fn (Colaborador $colaborador): bool => blank($colaborador->cnh_attachment_path))->count(),
                    'missing_work_card_attachment' => $rows->filter(fn (Colaborador $colaborador): bool => blank($colaborador->work_card_attachment_path))->count(),
                ];
            })
            ->values();

        return response()->json([
            'generated_at' => now()->toISOString(),
            'summary' => [
                'total_collaborators' => $collaborators->count(),
                'missing_phone' => $collaborators->filter(fn (Colaborador $colaborador): bool => blank($colaborador->telefone))->count(),
                'missing_email' => $collaborators->filter(fn (Colaborador $colaborador): bool => blank($colaborador->email))->count(),
                'missing_admission_date' => $collaborators->filter(fn (Colaborador $colaborador): bool => blank($colaborador->data_admissao))->count(),
                'missing_function' => $collaborators->filter(fn (Colaborador $colaborador): bool => blank($colaborador->funcao_id))->count(),
                'missing_photo' => $collaborators->filter(fn (Colaborador $colaborador): bool => blank($colaborador->foto_3x4_path))->count(),
                'missing_cnh_attachment' => $collaborators->filter(fn (Colaborador $colaborador): bool => blank($colaborador->cnh_attachment_path))->count(),
                'missing_work_card_attachment' => $collaborators->filter(fn (Colaborador $colaborador): bool => blank($colaborador->work_card_attachment_path))->count(),
                'duplicate_cpf_groups' => $duplicates->count(),
            ],
            'duplicates' => $duplicates->map(function ($group, string $hash): array {
                return [
                    'cpf_hash' => $hash,
                    'rows' => collect($group)->map(fn (Colaborador $colaborador): array => [
                        'id' => $colaborador->id,
                        'nome' => $colaborador->nome,
                        'unidade_id' => $colaborador->unidade_id,
                    ])->values(),
                ];
            })->values(),
            'issues_by_unit' => $issuesByUnit,
        ]);
    }

    public function benchmark(Request $request): JsonResponse
    {
        abort_unless($this->canAccessInsights($request), 403);

        $month = now()->month;
        $year = now()->year;
        $benchmark = $this->buildUnitBenchmarkData($request, $month, $year);

        return response()->json([
            'generated_at' => now()->toISOString(),
            'competencia_mes' => $month,
            'competencia_ano' => $year,
            'totals' => $benchmark['totals'],
            'highlights' => $benchmark['highlights'],
            'data' => $benchmark['rows'],
        ]);
    }

    public function forecast(Request $request): JsonResponse
    {
        abort_unless($this->canAccessInsights($request), 403);

        $user = $request->user();
        $today = CarbonImmutable::today();
        $horizons = [30, 60, 90];
        $vacationForecast = [
            'next_30_days' => 0,
            'next_60_days' => 0,
            'next_90_days' => 0,
        ];

        $activeCollaborators = Colaborador::query()
            ->when($this->hasRestrictedUnitScope($request, 'registry'), function (Builder $query) use ($request): void {
                $query->whereIn('unidade_id', $request->user()->allowedUnitIdsFor('registry'));
            })
            ->where('ativo', true)
            ->whereNotNull('data_admissao')
            ->select(['id', 'data_admissao'])
            ->get();

        $latestPeriodEndByCollaborator = FeriasLancamento::query()
            ->whereIn('colaborador_id', $activeCollaborators->pluck('id')->all())
            ->selectRaw('colaborador_id, MAX(periodo_aquisitivo_fim) as base_fim')
            ->groupBy('colaborador_id')
            ->pluck('base_fim', 'colaborador_id');

        foreach ($activeCollaborators as $colaborador) {
            $admissao = $colaborador->data_admissao?->toDateString();

            if (! $admissao) {
                continue;
            }

            $baseDate = (string) ($latestPeriodEndByCollaborator->get($colaborador->id) ?? $admissao);
            $limite = CarbonImmutable::parse($baseDate)->addYear()->addMonths(11);

            foreach ($horizons as $horizon) {
                if ($limite->betweenIncluded($today, $today->addDays($horizon))) {
                    $vacationForecast['next_'.$horizon.'_days']++;
                }
            }
        }

        $benchmarkCurrent = $this->buildUnitBenchmarkData($request, now()->month, now()->year);

        $monthlyOperationCost = [];
        for ($offset = 5; $offset >= 0; $offset--) {
            $reference = $today->startOfMonth()->subMonths($offset);
            $month = (int) $reference->month;
            $year = (int) $reference->year;

            $benchmark = $this->buildUnitBenchmarkData($request, $month, $year);
            $monthlyOperationCost[] = [
                'mes' => $month,
                'ano' => $year,
                'label' => $reference->format('m/y'),
                'freight_total' => (float) ($benchmark['totals']['freight_total'] ?? 0),
                'fines_total' => (float) ($benchmark['totals']['fines_total'] ?? 0),
                'operation_cost_total' => (float) ($benchmark['totals']['operation_cost_total'] ?? 0),
            ];
        }

        $payrollMonthlyTotals = [];
        for ($offset = 2; $offset >= 0; $offset--) {
            $reference = $today->startOfMonth()->subMonths($offset);
            $month = (int) $reference->month;
            $year = (int) $reference->year;

            $payrollBase = Pagamento::query()
                ->where('competencia_mes', $month)
                ->where('competencia_ano', $year);

            if (! $user->isMasterAdmin()) {
                $payrollBase->where('autor_id', $user->id);
            }

            if ($this->hasRestrictedUnitScope($request, 'payroll')) {
                $payrollBase->whereIn('unidade_id', $user->allowedUnitIdsFor('payroll'));
            }

            $payrollMonthlyTotals[] = (float) $payrollBase->sum('valor');
        }

        $averagePayroll = $payrollMonthlyTotals !== []
            ? array_sum($payrollMonthlyTotals) / count($payrollMonthlyTotals)
            : 0.0;

        return response()->json([
            'generated_at' => now()->toISOString(),
            'vacations' => $vacationForecast,
            'cost_relation' => [
                'totals' => $benchmarkCurrent['totals'],
                'by_unit' => $benchmarkCurrent['rows'],
                'highlights' => $benchmarkCurrent['highlights'],
                'trend_last_6_months' => $monthlyOperationCost,
            ],
            'payroll_forecast' => [
                'average_last_3_months' => round($averagePayroll, 2),
                'next_30_days' => round($averagePayroll, 2),
                'next_60_days' => round($averagePayroll * 2, 2),
                'next_90_days' => round($averagePayroll * 3, 2),
            ],
        ]);
    }

    /**
     * @return array{
     *   rows: array<int, array<string, int|float|string|null>>,
     *   totals: array<string, float|int>,
     *   highlights: array<string, array<string, int|float|string|null>|null>
     * }
     */
    private function buildUnitBenchmarkData(Request $request, int $month, int $year): array
    {
        $user = $request->user();
        $isMaster = $user->isMasterAdmin();
        $allowedRegistryUnits = $this->visibleUnitIds($request, 'registry');

        $units = Unidade::query()
            ->when($allowedRegistryUnits !== null, fn (Builder $query) => $query->whereIn('id', $allowedRegistryUnits))
            ->orderBy('nome')
            ->get(['id', 'nome']);

        $freightUnitScope = $this->visibleUnitIds($request, 'freight');
        $payrollUnitScope = $this->visibleUnitIds($request, 'payroll');
        $finesUnitScope = $this->visibleUnitIds($request, 'fines');
        $programmingUnitScope = $this->visibleUnitIds($request, 'programming');

        $freightByUnit = FreightEntry::query()
            ->selectRaw('unidade_id, SUM(frete_total) as freight_total, SUM(km_rodado) as km_total, SUM(aves) as aves_total, COUNT(*) as entries_total')
            ->whereYear('data', $year)
            ->whereMonth('data', $month)
            ->when(! $isMaster, fn (Builder $query) => $query->where('autor_id', $user->id))
            ->when($freightUnitScope !== null, fn (Builder $query) => $query->whereIn('unidade_id', $freightUnitScope))
            ->groupBy('unidade_id')
            ->get()
            ->keyBy('unidade_id');

        $spotByUnit = FreightSpotEntry::query()
            ->selectRaw('unidade_origem_id, SUM(frete_spot) as freight_total, SUM(km_rodado) as km_total, SUM(aves) as aves_total, COUNT(*) as entries_total')
            ->whereYear('data', $year)
            ->whereMonth('data', $month)
            ->when(! $isMaster, fn (Builder $query) => $query->where('autor_id', $user->id))
            ->when($freightUnitScope !== null, fn (Builder $query) => $query->whereIn('unidade_origem_id', $freightUnitScope))
            ->groupBy('unidade_origem_id')
            ->get()
            ->keyBy('unidade_origem_id');

        $payrollByUnit = Pagamento::query()
            ->selectRaw('unidade_id, SUM(valor) as payroll_total')
            ->where('competencia_mes', $month)
            ->where('competencia_ano', $year)
            ->when(! $isMaster, fn (Builder $query) => $query->where('autor_id', $user->id))
            ->when($payrollUnitScope !== null, fn (Builder $query) => $query->whereIn('unidade_id', $payrollUnitScope))
            ->groupBy('unidade_id')
            ->get()
            ->keyBy('unidade_id');

        $finesByUnit = Multa::query()
            ->selectRaw('unidade_id, SUM(valor) as fines_total')
            ->whereYear('data', $year)
            ->whereMonth('data', $month)
            ->when(! $isMaster, fn (Builder $query) => $query->where('autor_id', $user->id))
            ->when($finesUnitScope !== null, fn (Builder $query) => $query->whereIn('unidade_id', $finesUnitScope))
            ->groupBy('unidade_id')
            ->get()
            ->keyBy('unidade_id');

        $programmingByUnit = ProgramacaoViagem::query()
            ->selectRaw('unidade_id, COUNT(*) as trips_total')
            ->whereYear('data_viagem', $year)
            ->whereMonth('data_viagem', $month)
            ->when(! $isMaster, fn (Builder $query) => $query->where('autor_id', $user->id))
            ->when($programmingUnitScope !== null, fn (Builder $query) => $query->whereIn('unidade_id', $programmingUnitScope))
            ->groupBy('unidade_id')
            ->get()
            ->keyBy('unidade_id');

        $rows = [];
        $totals = [
            'freight_total' => 0.0,
            'payroll_total' => 0.0,
            'fines_total' => 0.0,
            'operation_cost_total' => 0.0,
            'km_total' => 0.0,
            'trips_total' => 0,
        ];

        foreach ($units as $unit) {
            $freightRow = $freightByUnit->get($unit->id);
            $spotRow = $spotByUnit->get($unit->id);
            $payrollRow = $payrollByUnit->get($unit->id);
            $finesRow = $finesByUnit->get($unit->id);
            $programmingRow = $programmingByUnit->get($unit->id);

            $freightTotal = (float) ($freightRow->freight_total ?? 0) + (float) ($spotRow->freight_total ?? 0);
            $kmTotal = (float) ($freightRow->km_total ?? 0) + (float) ($spotRow->km_total ?? 0);
            $avesTotal = (int) ((int) ($freightRow->aves_total ?? 0) + (int) ($spotRow->aves_total ?? 0));
            $tripsTotal = (int) ($programmingRow->trips_total ?? 0);
            $payrollTotal = (float) ($payrollRow->payroll_total ?? 0);
            $finesTotal = (float) ($finesRow->fines_total ?? 0);
            $operationCost = $freightTotal + $finesTotal;

            $totals['freight_total'] += $freightTotal;
            $totals['payroll_total'] += $payrollTotal;
            $totals['fines_total'] += $finesTotal;
            $totals['operation_cost_total'] += $operationCost;
            $totals['km_total'] += $kmTotal;
            $totals['trips_total'] += $tripsTotal;

            $rows[] = [
                'unidade_id' => (int) $unit->id,
                'unidade_nome' => (string) $unit->nome,
                'freight_total' => round($freightTotal, 2),
                'payroll_total' => round($payrollTotal, 2),
                'fines_total' => round($finesTotal, 2),
                'operation_cost_total' => round($operationCost, 2),
                'km_total' => round($kmTotal, 2),
                'trips_total' => $tripsTotal,
                'aves_total' => $avesTotal,
                'cost_per_km' => $kmTotal > 0 ? round($operationCost / $kmTotal, 4) : null,
                'cost_per_trip' => $tripsTotal > 0 ? round($operationCost / $tripsTotal, 2) : null,
                'aves_por_viagem' => $tripsTotal > 0 ? (int) round($avesTotal / $tripsTotal) : null,
            ];
        }

        $rowsCollection = collect($rows);

        $totals['freight_total'] = round((float) $totals['freight_total'], 2);
        $totals['payroll_total'] = round((float) $totals['payroll_total'], 2);
        $totals['fines_total'] = round((float) $totals['fines_total'], 2);
        $totals['operation_cost_total'] = round((float) $totals['operation_cost_total'], 2);
        $totals['km_total'] = round((float) $totals['km_total'], 2);

        $rows = $rowsCollection
            ->map(function (array $row) use ($totals): array {
                $costShare = (float) ($row['operation_cost_total'] ?? 0);
                $row['operation_cost_share_percent'] = $totals['operation_cost_total'] > 0
                    ? round(($costShare / (float) $totals['operation_cost_total']) * 100, 2)
                    : 0.0;

                return $row;
            })
            ->sortByDesc('operation_cost_total')
            ->values()
            ->all();

        $bestCostPerKm = $rowsCollection
            ->filter(fn (array $row): bool => isset($row['cost_per_km']) && $row['cost_per_km'] !== null)
            ->sortBy('cost_per_km')
            ->first();

        $highestVolume = $rowsCollection
            ->sortByDesc('freight_total')
            ->first();

        $highestCostPressure = $rowsCollection
            ->sortByDesc('operation_cost_total')
            ->first();

        return [
            'rows' => $rows,
            'totals' => $totals,
            'highlights' => [
                'best_cost_per_km' => $bestCostPerKm,
                'highest_volume' => $highestVolume,
                'highest_cost_pressure' => $highestCostPressure,
            ],
        ];
    }

    private function hasRestrictedUnitScope(Request $request, string $moduleKey): bool
    {
        return $this->visibleUnitIds($request, $moduleKey) !== null;
    }

    /**
     * @return array<int, int>|null
     */
    private function visibleUnitIds(Request $request, string $moduleKey): ?array
    {
        $user = $request->user();

        if (! $user || $user->isMasterAdmin() || $user->dataScopeFor($moduleKey) !== 'units') {
            return null;
        }

        return $user->allowedUnitIdsFor($moduleKey);
    }

    private function canAccessInsights(Request $request): bool
    {
        $user = $request->user();

        if (! $user) {
            return false;
        }

        return $user->hasPermission('operations.tasks.view')
            || $user->hasPermission('sidebar.operations-hub.view')
            || $user->hasPermission('sidebar.executive-dashboard.view');
    }
}
