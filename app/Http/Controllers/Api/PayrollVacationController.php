<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFeriasLancamentoRequest;
use App\Models\Colaborador;
use App\Models\FeriasLancamento;
use App\Models\Unidade;
use App\Support\FinancialApprovalService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

class PayrollVacationController extends Controller
{
    /**
     * @var array<int, string>
     */
    private const REALIZADAS_SORTABLE_FIELDS = [
        'nome',
        'funcao',
        'unidade',
        'data_inicio',
        'data_fim',
        'periodo_aquisitivo_inicio',
        'periodo_aquisitivo_fim',
        'dias_ferias',
        'tipo',
    ];

    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->hasPermission('vacations.dashboard.view'), 403);

        $this->syncFinishedVacationsToPast();

        $rows = $this->buildEligibilityRows($request);
        $unidadeId = $request->filled('unidade_id')
            ? (int) $request->integer('unidade_id')
            : null;
        $allowedUnitIds = $this->allowedVacationUnitIds($request);

        if ($unidadeId !== null) {
            abort_unless($user?->canAccessUnit('vacations', $unidadeId), 403);
        }

        $today = CarbonImmutable::today();
        $plus30Days = $today->addDays(30);
        $plus2Months = $today->addMonths(2);
        $plus4Months = $today->addMonths(4);

        $feriasVencidas = $rows->where('status', 'vencida')->count();
        $feriasAVencer = $rows
            ->whereIn('status', ['a_vencer', 'liberada', 'atencao', 'urgente'])
            ->count();
        $faixaAVencer = $rows->where('status', 'a_vencer')->count();
        $faixaLiberada = $rows->where('status', 'liberada')->count();
        $faixaAtencao = $rows->where('status', 'atencao')->count();
        $faixaUrgente = $rows->where('status', 'urgente')->count();

        $limiteProximos2Meses = $rows
            ->filter(fn (array $row): bool => CarbonImmutable::parse($row['limite'])->betweenIncluded($today, $plus2Months))
            ->count();

        $limiteProximos4Meses = $rows
            ->filter(fn (array $row): bool => CarbonImmutable::parse($row['limite'])->betweenIncluded($today, $plus4Months))
            ->count();

        $lancamentosDashboardQuery = FeriasLancamento::query();

        if ($user?->dataScopeFor('vacations') === 'units') {
            $lancamentosDashboardQuery->whereIn('unidade_id', $allowedUnitIds !== [] ? $allowedUnitIds : [0]);
        }

        if ($unidadeId !== null) {
            $lancamentosDashboardQuery->where('unidade_id', $unidadeId);
        }

        $feriasProgramadasProximos30Dias = (clone $lancamentosDashboardQuery)
            ->whereDate('data_inicio', '>=', $today->toDateString())
            ->whereDate('data_inicio', '<=', $plus30Days->toDateString())
            ->count();

        $lancamentosAnoAtual = (clone $lancamentosDashboardQuery)
            ->whereYear('data_inicio', (int) $today->year)
            ->count();

        $totalLancamentos = (clone $lancamentosDashboardQuery)->count();
        $totalComAbono = (clone $lancamentosDashboardQuery)
            ->where('com_abono', true)
            ->count();
        $totalSemAbono = max($totalLancamentos - $totalComAbono, 0);

        $percentualComAbono = $totalLancamentos > 0
            ? round(($totalComAbono / $totalLancamentos) * 100, 2)
            : 0.0;

        $percentualSemAbono = $totalLancamentos > 0
            ? round(($totalSemAbono / $totalLancamentos) * 100, 2)
            : 0.0;

        $taxaVencidasSobreAtivos = $rows->count() > 0
            ? round(($feriasVencidas / $rows->count()) * 100, 2)
            : 0.0;

        $taxaLiberadasSobreAtivos = $rows->count() > 0
            ? round(($faixaLiberada / $rows->count()) * 100, 2)
            : 0.0;

        $riscosPorUnidade = $rows
            ->groupBy(fn (array $row): int => (int) ($row['unidade_id'] ?? 0))
            ->map(function (Collection $group): array {
                $total = $group->count();
                $vencidas = $group->where('status', 'vencida')->count();
                $urgentes = $group->where('status', 'urgente')->count();
                $atencao = $group->where('status', 'atencao')->count();
                $liberadas = $group->where('status', 'liberada')->count();
                $aVencer = $group->where('status', 'a_vencer')->count();
                $riskScore = ($vencidas * 4) + ($urgentes * 3) + ($atencao * 2) + $liberadas;

                return [
                    'unidade_id' => (int) ($group->first()['unidade_id'] ?? 0),
                    'unidade_nome' => (string) ($group->first()['unidade'] ?? 'Sem unidade'),
                    'total_colaboradores' => $total,
                    'vencidas' => $vencidas,
                    'urgentes' => $urgentes,
                    'atencao' => $atencao,
                    'liberadas' => $liberadas,
                    'a_vencer' => $aVencer,
                    'risk_score' => $riskScore,
                    'risk_rate' => $total > 0
                        ? round((($vencidas + $urgentes + $atencao) / $total) * 100, 2)
                        : 0.0,
                ];
            })
            ->sortByDesc('risk_score')
            ->values();

        $topPrioridades = $rows
            ->filter(fn (array $row): bool => in_array($row['status'], ['vencida', 'urgente', 'atencao'], true))
            ->map(function (array $row) use ($today): array {
                $limite = CarbonImmutable::parse((string) $row['limite']);

                return [
                    'colaborador_id' => (int) $row['colaborador_id'],
                    'nome' => (string) ($row['nome'] ?? '-'),
                    'funcao' => $row['funcao'],
                    'unidade' => $row['unidade'],
                    'unidade_id' => $row['unidade_id'] !== null ? (int) $row['unidade_id'] : null,
                    'status' => (string) $row['status'],
                    'limite' => (string) $row['limite'],
                    'dias_para_limite' => (int) $today->diffInDays($limite, false),
                ];
            })
            ->sort(function (array $left, array $right): int {
                $severity = [
                    'vencida' => 4,
                    'urgente' => 3,
                    'atencao' => 2,
                    'liberada' => 1,
                    'a_vencer' => 0,
                ];

                $severityCompare = ($severity[$right['status']] ?? 0) <=> ($severity[$left['status']] ?? 0);
                if ($severityCompare !== 0) {
                    return $severityCompare;
                }

                return ((int) $left['dias_para_limite']) <=> ((int) $right['dias_para_limite']);
            })
            ->take(8)
            ->values();

        $feriasVigentesQuery = FeriasLancamento::query()
            ->with([
                'colaborador:id,nome',
                'unidade:id,nome',
                'funcao:id,nome',
            ])
            ->whereDate('data_inicio', '<=', $today->toDateString())
            ->whereDate('data_fim', '>=', $today->toDateString())
            ->orderBy('data_fim');

        if ($user?->dataScopeFor('vacations') === 'units') {
            $feriasVigentesQuery->whereIn('unidade_id', $allowedUnitIds !== [] ? $allowedUnitIds : [0]);
        }

        if ($request->filled('unidade_id')) {
            $feriasVigentesQuery->where('unidade_id', (int) $request->integer('unidade_id'));
        }

        $feriasVigentes = $feriasVigentesQuery
            ->get()
            ->map(fn (FeriasLancamento $item): array => [
                'id' => (int) $item->id,
                'nome' => $item->colaborador?->nome,
                'funcao' => $item->funcao?->nome,
                'unidade' => $item->unidade?->nome,
                'unidade_id' => $item->unidade_id !== null ? (int) $item->unidade_id : null,
                'tipo' => $item->tipo,
                'data_inicio' => $item->data_inicio?->toDateString(),
                'data_fim' => $item->data_fim?->toDateString(),
                'dias_restantes' => max($today->diffInDays($item->data_fim, false) + 1, 0),
            ])
            ->values();

        $timelineQuery = FeriasLancamento::query()
            ->with([
                'colaborador:id,nome',
                'unidade:id,nome',
                'funcao:id,nome',
            ])
            ->whereDate('data_fim', '>=', $today->toDateString())
            ->orderBy('data_inicio')
            ->orderBy('data_fim');

        if ($user?->dataScopeFor('vacations') === 'units') {
            $timelineQuery->whereIn('unidade_id', $allowedUnitIds !== [] ? $allowedUnitIds : [0]);
        }

        if ($request->filled('unidade_id')) {
            $timelineQuery->where('unidade_id', (int) $request->integer('unidade_id'));
        }

        $timeline = $timelineQuery
            ->get()
            ->map(function (FeriasLancamento $item) use ($today): array {
                $dataInicio = $item->data_inicio;
                $dataFim = $item->data_fim;

                $statusTimeline = 'concluida';

                if ($dataInicio && $dataFim && $today->betweenIncluded($dataInicio, $dataFim)) {
                    $statusTimeline = 'vigente';
                } elseif ($dataInicio && $dataInicio->isAfter($today)) {
                    $statusTimeline = 'agendada';
                }

                return [
                    'id' => (int) $item->id,
                    'colaborador_id' => (int) $item->colaborador_id,
                    'nome' => $item->colaborador?->nome,
                    'funcao' => $item->funcao?->nome,
                    'unidade' => $item->unidade?->nome,
                    'unidade_id' => $item->unidade_id !== null ? (int) $item->unidade_id : null,
                    'tipo' => $item->tipo,
                    'com_abono' => (bool) $item->com_abono,
                    'dias_ferias' => (int) $item->dias_ferias,
                    'status_timeline' => $statusTimeline,
                    'data_inicio' => $dataInicio?->toDateString(),
                    'data_fim' => $dataFim?->toDateString(),
                ];
            })
            ->values();

        return response()->json([
            'data' => [
                'ferias_vencidas' => $feriasVencidas,
                'ferias_a_vencer' => $feriasAVencer,
                'faixa_a_vencer' => $faixaAVencer,
                'faixa_liberada' => $faixaLiberada,
                'faixa_atencao' => $faixaAtencao,
                'faixa_urgente' => $faixaUrgente,
                'limite_proximos_4_meses' => $limiteProximos4Meses,
                'limite_proximos_2_meses' => $limiteProximos2Meses,
                'ferias_programadas_30_dias' => $feriasProgramadasProximos30Dias,
                'lancamentos_ano_atual' => $lancamentosAnoAtual,
                'total_lancamentos_abono' => $totalLancamentos,
                'total_com_abono' => $totalComAbono,
                'total_sem_abono' => $totalSemAbono,
                'percentual_com_abono' => $percentualComAbono,
                'percentual_sem_abono' => $percentualSemAbono,
                'taxa_vencidas_sobre_ativos' => $taxaVencidasSobreAtivos,
                'taxa_liberadas_sobre_ativos' => $taxaLiberadasSobreAtivos,
                'riscos_por_unidade' => $riscosPorUnidade,
                'top_prioridades' => $topPrioridades,
                'ferias_vigentes' => $feriasVigentes,
                'timeline' => $timeline,
            ],
        ]);
    }

    public function reports(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->hasPermission('vacations.dashboard.view'), 403);

        $this->syncFinishedVacationsToPast();

        $validated = $request->validate([
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:start_date'],
        ]);

        $startDate = CarbonImmutable::parse((string) $validated['start_date']);
        $endDate = CarbonImmutable::parse((string) $validated['end_date']);
        $allowedUnitIds = $this->allowedVacationUnitIds($request);

        $feriasGozadas = FeriasLancamento::query()
            ->with(['colaborador:id,nome', 'unidade:id,nome'])
            ->whereDate('data_inicio', '<=', $endDate->toDateString())
            ->whereDate('data_fim', '>=', $startDate->toDateString())
            ->when(
                $user?->dataScopeFor('vacations') === 'units',
                fn ($query) => $query->whereIn('unidade_id', $allowedUnitIds !== [] ? $allowedUnitIds : [0]),
            )
            ->orderBy('data_inicio')
            ->get()
            ->map(fn (FeriasLancamento $item): array => [
                'id' => (int) $item->id,
                'nome' => $item->colaborador?->nome,
                'unidade' => $item->unidade?->nome,
                'tipo' => $item->tipo,
                'data_inicio' => $item->data_inicio?->toDateString(),
                'data_fim' => $item->data_fim?->toDateString(),
                'dias_ferias' => (int) $item->dias_ferias,
                'com_abono' => (bool) $item->com_abono,
            ])
            ->values();

        $admissoes = Colaborador::query()
            ->with(['unidade:id,nome', 'funcao:id,nome'])
            ->whereNotNull('data_admissao')
            ->whereDate('data_admissao', '>=', $startDate->toDateString())
            ->whereDate('data_admissao', '<=', $endDate->toDateString())
            ->when(
                $user?->dataScopeFor('vacations') === 'units',
                fn ($query) => $query->whereIn('unidade_id', $allowedUnitIds !== [] ? $allowedUnitIds : [0]),
            )
            ->orderBy('data_admissao')
            ->get()
            ->map(fn (Colaborador $item): array => [
                'id' => (int) $item->id,
                'nome' => $item->nome,
                'unidade' => $item->unidade?->nome,
                'funcao' => $item->funcao?->nome,
                'data_admissao' => $item->data_admissao?->toDateString(),
            ])
            ->values();

        $demissoes = Colaborador::query()
            ->with(['unidade:id,nome', 'funcao:id,nome'])
            ->whereNotNull('data_demissao')
            ->whereDate('data_demissao', '>=', $startDate->toDateString())
            ->whereDate('data_demissao', '<=', $endDate->toDateString())
            ->when(
                $user?->dataScopeFor('vacations') === 'units',
                fn ($query) => $query->whereIn('unidade_id', $allowedUnitIds !== [] ? $allowedUnitIds : [0]),
            )
            ->orderBy('data_demissao')
            ->get()
            ->map(fn (Colaborador $item): array => [
                'id' => (int) $item->id,
                'nome' => $item->nome,
                'unidade' => $item->unidade?->nome,
                'funcao' => $item->funcao?->nome,
                'data_demissao' => $item->data_demissao?->toDateString(),
            ])
            ->values();

        return response()->json([
            'data' => [
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'ferias_gozadas' => [
                    'total' => $feriasGozadas->count(),
                    'rows' => $feriasGozadas,
                ],
                'admissoes' => [
                    'total' => $admissoes->count(),
                    'rows' => $admissoes,
                ],
                'demissoes' => [
                    'total' => $demissoes->count(),
                    'rows' => $demissoes,
                ],
                'unidades' => Unidade::query()
                    ->when(
                        $user?->dataScopeFor('vacations') === 'units',
                        fn ($query) => $query->whereIn('id', $allowedUnitIds !== [] ? $allowedUnitIds : [0]),
                    )
                    ->orderBy('nome')
                    ->get(['id', 'nome']),
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->hasPermission('vacations.dashboard.view'), 403);

        $this->syncFinishedVacationsToPast();

        $limiteFilter = (string) $request->string('limite', 'todos');
        $today = CarbonImmutable::today();
        $plus2Months = $today->addMonths(2);
        $plus4Months = $today->addMonths(4);

        $rows = $this->buildEligibilityRows($request)
            ->filter(function (array $row) use ($limiteFilter, $today, $plus2Months, $plus4Months): bool {
                $limite = CarbonImmutable::parse($row['limite']);

                return match ($limiteFilter) {
                    'vencidas' => $row['status'] === 'vencida',
                    'a_vencer' => $row['status'] !== 'vencida',
                    'proximos_2_meses' => $limite->betweenIncluded($today, $plus2Months),
                    'proximos_4_meses' => $limite->betweenIncluded($today, $plus4Months),
                    default => true,
                };
            })
            ->sortBy('limite')
            ->values();

        return response()->json([
            'data' => $rows,
        ]);
    }

    public function candidates(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->hasPermission('vacations.launch'), 403);

        $this->syncFinishedVacationsToPast();

        return response()->json([
            'data' => $this->buildEligibilityRows($request)
                ->sortBy('nome')
                ->values(),
        ]);
    }

    public function launched(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->hasPermission('vacations.history.view'), 403);

        $this->syncFinishedVacationsToPast();

        $sortBy = (string) $request->string('sort_by', 'data_inicio');
        $sortDirection = (string) $request->string('sort_direction', 'desc');

        if (! in_array($sortBy, self::REALIZADAS_SORTABLE_FIELDS, true)) {
            $sortBy = 'data_inicio';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }
        $allowedUnitIds = $this->allowedVacationUnitIds($request);

        $rows = FeriasLancamento::query()
            ->with([
                'colaborador:id,nome',
                'unidade:id,nome',
                'funcao:id,nome',
                'autor:id,name',
            ])
            ->when(
                $user?->dataScopeFor('vacations') === 'units',
                fn ($query) => $query->whereIn('unidade_id', $allowedUnitIds !== [] ? $allowedUnitIds : [0]),
            )
            ->when($request->filled('unidade_id'), function ($query) use ($request): void {
                $query->where('unidade_id', (int) $request->integer('unidade_id'));
            })
            ->when($request->filled('funcao_id'), function ($query) use ($request): void {
                $query->where('funcao_id', (int) $request->integer('funcao_id'));
            })
            ->get()
            ->map(fn (FeriasLancamento $item): array => [
                'id' => (int) $item->id,
                'colaborador_id' => (int) $item->colaborador_id,
                'nome' => $item->colaborador?->nome,
                'funcao' => $item->funcao?->nome,
                'unidade' => $item->unidade?->nome,
                'data_inicio' => $item->data_inicio?->toDateString(),
                'data_fim' => $item->data_fim?->toDateString(),
                'periodo_aquisitivo_inicio' => $item->periodo_aquisitivo_inicio?->toDateString(),
                'periodo_aquisitivo_fim' => $item->periodo_aquisitivo_fim?->toDateString(),
                'dias_ferias' => (int) $item->dias_ferias,
                'tipo' => $item->tipo,
                'com_abono' => (bool) $item->com_abono,
                'observacoes' => $item->observacoes,
                'autor' => $item->autor?->name,
            ])
            ->sortBy($sortBy, SORT_NATURAL | SORT_FLAG_CASE, $sortDirection === 'desc')
            ->values();

        return response()->json([
            'data' => $rows,
        ]);
    }

    public function store(StoreFeriasLancamentoRequest $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->hasPermission('vacations.launch'), 403);

        $validated = $request->validated();
        $tipo = (string) $validated['tipo'];
        $requestedDiasFerias = isset($validated['dias_ferias'])
            ? (int) $validated['dias_ferias']
            : ((bool) $validated['com_abono'] ? 20 : 30);

        $colaborador = Colaborador::query()
            ->whereKey((int) $validated['colaborador_id'])
            ->with(['unidade:id,nome', 'funcao:id,nome'])
            ->firstOrFail();
        abort_unless($user?->canAccessUnit('vacations', (int) $colaborador->unidade_id), 403);

        $dataInicio = CarbonImmutable::parse((string) $validated['data_inicio']);
        $dataFim = isset($validated['data_fim'])
            ? CarbonImmutable::parse((string) $validated['data_fim'])
            : null;

        if ($dataFim !== null) {
            $diasPorIntervalo = (int) round($dataInicio->diffInDays($dataFim) + 1);

            if (! in_array($diasPorIntervalo, [20, 30], true)) {
                throw ValidationException::withMessages([
                    'data_fim' => ['O período informado deve resultar em 20 ou 30 dias de férias.'],
                ]);
            }

            $diasFerias = $diasPorIntervalo;
            $comAbono = $diasFerias === 20;
        } else {
            $diasFerias = $requestedDiasFerias;
            $comAbono = $diasFerias === 20;
            $dataFim = $dataInicio->addDays($diasFerias - 1);
        }

        /** @var FinancialApprovalService $approvalService */
        $approvalService = app(FinancialApprovalService::class);
        $approvalPayload = [
            'colaborador_id' => (int) $colaborador->id,
            'unidade_id' => (int) $colaborador->unidade_id,
            'unidade_nome' => $colaborador->unidade?->nome,
            'tipo' => $tipo,
            'com_abono' => $comAbono,
            'dias_ferias' => $diasFerias,
            'data_inicio' => $dataInicio->toDateString(),
            'data_fim' => $dataFim->toDateString(),
        ];
        $approvalHash = $approvalService->buildRequestHash([
            'action' => 'vacations.entry.store',
            'payload' => $approvalPayload,
        ]);

        if ($approvalService->requiresVacationEntryApproval($user, $approvalPayload)) {
            $approvalToken = $this->resolveApprovalToken($request);

            if ($approvalToken === '') {
                $approval = $approvalService->requestOrReusePendingApproval(
                    requester: $user,
                    actionKey: 'vacations.entry.store',
                    requestHash: $approvalHash,
                    summary: $approvalService->buildVacationEntrySummary($approvalPayload),
                );

                return response()->json([
                    'message' => 'Este lancamento de ferias exige aprovacao adicional.',
                    'approval_required' => true,
                    'approval_id' => (int) $approval->id,
                    'approval_uuid' => (string) $approval->request_uuid,
                    'summary' => $approval->summary,
                ], 202);
            }

            $consumedApproval = $approvalService->consumeExecutionToken(
                requester: $user,
                token: $approvalToken,
                requestHash: $approvalHash,
            );

            abort_unless($consumedApproval, 422, 'Token de aprovacao invalido, expirado ou incompativel com este lancamento.');
        }

        $lancamento = FeriasLancamento::query()->create([
            'colaborador_id' => (int) $colaborador->id,
            'unidade_id' => (int) $colaborador->unidade_id,
            'funcao_id' => $colaborador->funcao_id,
            'autor_id' => (int) $request->user()->id,
            'tipo' => $tipo,
            'com_abono' => $comAbono,
            'dias_ferias' => $diasFerias,
            'data_inicio' => $dataInicio->toDateString(),
            'data_fim' => $dataFim->toDateString(),
            'periodo_aquisitivo_inicio' => $dataInicio->toDateString(),
            'periodo_aquisitivo_fim' => $dataInicio->toDateString(),
            'observacoes' => isset($validated['observacoes'])
                ? trim((string) $validated['observacoes'])
                : null,
        ]);

        $this->rebalanceCollaboratorVacationPeriods((int) $colaborador->id);

        return response()->json([
            'data' => $lancamento->refresh()->load(['colaborador:id,nome', 'unidade:id,nome', 'funcao:id,nome', 'autor:id,name']),
        ], 201);
    }

    public function update(StoreFeriasLancamentoRequest $request, FeriasLancamento $feriasLancamento): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->hasPermission('vacations.edit'), 403);
        abort_unless($user?->canAccessUnit('vacations', (int) $feriasLancamento->unidade_id), 403);

        $validated = $request->validated();
        $oldCollaboratorId = (int) $feriasLancamento->colaborador_id;
        $tipo = (string) $validated['tipo'];
        $requestedDiasFerias = isset($validated['dias_ferias'])
            ? (int) $validated['dias_ferias']
            : ((bool) $validated['com_abono'] ? 20 : 30);

        $colaborador = Colaborador::query()
            ->whereKey((int) $validated['colaborador_id'])
            ->with(['unidade:id,nome', 'funcao:id,nome'])
            ->firstOrFail();
        abort_unless($user?->canAccessUnit('vacations', (int) $colaborador->unidade_id), 403);

        $dataInicio = CarbonImmutable::parse((string) $validated['data_inicio']);
        $dataFim = isset($validated['data_fim'])
            ? CarbonImmutable::parse((string) $validated['data_fim'])
            : null;

        if ($dataFim !== null) {
            $diasPorIntervalo = (int) round($dataInicio->diffInDays($dataFim) + 1);

            if (! in_array($diasPorIntervalo, [20, 30], true)) {
                throw ValidationException::withMessages([
                    'data_fim' => ['O período informado deve resultar em 20 ou 30 dias de férias.'],
                ]);
            }

            $diasFerias = $diasPorIntervalo;
            $comAbono = $diasFerias === 20;
        } else {
            $diasFerias = $requestedDiasFerias;
            $comAbono = $diasFerias === 20;
            $dataFim = $dataInicio->addDays($diasFerias - 1);
        }

        /** @var FinancialApprovalService $approvalService */
        $approvalService = app(FinancialApprovalService::class);
        $approvalPayload = [
            'colaborador_id' => (int) $colaborador->id,
            'unidade_id' => (int) $colaborador->unidade_id,
            'unidade_nome' => $colaborador->unidade?->nome,
            'tipo' => $tipo,
            'com_abono' => $comAbono,
            'dias_ferias' => $diasFerias,
            'data_inicio' => $dataInicio->toDateString(),
            'data_fim' => $dataFim->toDateString(),
        ];
        $approvalHash = $approvalService->buildRequestHash([
            'action' => 'vacations.entry.update',
            'lancamento_id' => (int) $feriasLancamento->id,
            'payload' => $approvalPayload,
        ]);

        if ($approvalService->requiresVacationEntryApproval($user, $approvalPayload)) {
            $approvalToken = $this->resolveApprovalToken($request);

            if ($approvalToken === '') {
                $approval = $approvalService->requestOrReusePendingApproval(
                    requester: $user,
                    actionKey: 'vacations.entry.update',
                    requestHash: $approvalHash,
                    summary: $approvalService->buildVacationEntrySummary($approvalPayload),
                );

                return response()->json([
                    'message' => 'Esta alteracao de ferias exige aprovacao adicional.',
                    'approval_required' => true,
                    'approval_id' => (int) $approval->id,
                    'approval_uuid' => (string) $approval->request_uuid,
                    'summary' => $approval->summary,
                ], 202);
            }

            $consumedApproval = $approvalService->consumeExecutionToken(
                requester: $user,
                token: $approvalToken,
                requestHash: $approvalHash,
            );

            abort_unless($consumedApproval, 422, 'Token de aprovacao invalido, expirado ou incompativel com esta alteracao.');
        }

        $feriasLancamento->update([
            'colaborador_id' => (int) $colaborador->id,
            'unidade_id' => (int) $colaborador->unidade_id,
            'funcao_id' => $colaborador->funcao_id,
            'autor_id' => (int) $request->user()->id,
            'tipo' => $tipo,
            'com_abono' => $comAbono,
            'dias_ferias' => $diasFerias,
            'data_inicio' => $dataInicio->toDateString(),
            'data_fim' => $dataFim->toDateString(),
            'periodo_aquisitivo_inicio' => $dataInicio->toDateString(),
            'periodo_aquisitivo_fim' => $dataInicio->toDateString(),
            'observacoes' => isset($validated['observacoes'])
                ? trim((string) $validated['observacoes'])
                : null,
        ]);

        $this->rebalanceCollaboratorVacationPeriods((int) $colaborador->id);

        if ($oldCollaboratorId !== (int) $colaborador->id) {
            $this->rebalanceCollaboratorVacationPeriods($oldCollaboratorId);
        }

        return response()->json([
            'data' => $feriasLancamento->refresh()->load(['colaborador:id,nome', 'unidade:id,nome', 'funcao:id,nome', 'autor:id,name']),
        ]);
    }

    public function destroy(Request $request, FeriasLancamento $feriasLancamento): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->hasPermission('vacations.edit'), 403);
        abort_unless($user?->canAccessUnit('vacations', (int) $feriasLancamento->unidade_id), 403);

        $colaboradorId = (int) $feriasLancamento->colaborador_id;

        $feriasLancamento->delete();

        $this->rebalanceCollaboratorVacationPeriods($colaboradorId);

        return response()->json([
            'message' => 'Lançamento de férias excluído com sucesso.',
        ]);
    }

    public function collaboratorHistory(Request $request, Colaborador $colaborador): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->hasPermission('vacations.history.view'), 403);
        abort_unless($user?->canAccessUnit('vacations', (int) $colaborador->unidade_id), 403);

        $this->syncFinishedVacationsToPast();

        $rows = FeriasLancamento::query()
            ->where('colaborador_id', $colaborador->id)
            ->orderByDesc('data_inicio')
            ->orderByDesc('id')
            ->get()
            ->map(fn (FeriasLancamento $item): array => [
                'id' => (int) $item->id,
                'data_inicio' => $item->data_inicio?->toDateString(),
                'data_termino' => $item->data_fim?->toDateString(),
                'periodo_aquisitivo_inicio' => $item->periodo_aquisitivo_inicio?->toDateString(),
                'periodo_aquisitivo_fim' => $item->periodo_aquisitivo_fim?->toDateString(),
                'tipo' => $item->tipo,
                'com_abono' => (bool) $item->com_abono,
                'dias_ferias' => (int) $item->dias_ferias,
                'observacoes' => $item->observacoes,
            ])
            ->values();

        return response()->json([
            'data' => $rows,
        ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function buildEligibilityRows(Request $request): Collection
    {
        $colaboradores = $this->eligibleCollaboratorsQuery($request)
            ->with(['unidade:id,nome', 'funcao:id,nome'])
            ->get();

        $latestPeriodEndByCollaborator = FeriasLancamento::query()
            ->whereIn('colaborador_id', $colaboradores->pluck('id')->all())
            ->selectRaw('colaborador_id, MAX(periodo_aquisitivo_fim) as base_fim')
            ->groupBy('colaborador_id')
            ->pluck('base_fim', 'colaborador_id');

        $today = CarbonImmutable::today();

        return $colaboradores
            ->map(function (Colaborador $colaborador) use ($latestPeriodEndByCollaborator, $today): ?array {
                $admissao = $colaborador->data_admissao?->toDateString();

                if (! $admissao) {
                    return null;
                }

                $latestPeriodEnd = $latestPeriodEndByCollaborator->get($colaborador->id);
                $base = $latestPeriodEnd
                    ? CarbonImmutable::parse((string) $latestPeriodEnd)->addDay()
                    : CarbonImmutable::parse($admissao);
                $diasDesdeBase = max($base->diffInDays($today) + 1, 1);
                $status = $this->resolveVacationStatusByDays($diasDesdeBase);

                $direito = $base->addYear();
                $limite = $direito->addMonths(11);

                return [
                    'colaborador_id' => (int) $colaborador->id,
                    'nome' => $colaborador->nome,
                    'funcao' => $colaborador->funcao?->nome,
                    'funcao_id' => $colaborador->funcao_id,
                    'unidade' => $colaborador->unidade?->nome,
                    'unidade_id' => $colaborador->unidade_id,
                    'periodo_aquisitivo_inicio' => $base->toDateString(),
                    'periodo_aquisitivo_fim' => $base->addYear()->subDay()->toDateString(),
                    'direito' => $direito->toDateString(),
                    'limite' => $limite->toDateString(),
                    'status' => $status,
                ];
            })
            ->filter(fn (?array $row): bool => $row !== null)
            ->values();
    }

    private function resolveVacationStatusByDays(int $daysSinceBase): string
    {
        if ($daysSinceBase <= 365) {
            return 'a_vencer';
        }

        if ($daysSinceBase <= 576) {
            return 'liberada';
        }

        if ($daysSinceBase <= 636) {
            return 'atencao';
        }

        if ($daysSinceBase <= 699) {
            return 'urgente';
        }

        return 'vencida';
    }

    private function eligibleCollaboratorsQuery(Request $request): Builder
    {
        $query = Colaborador::query()
            ->where('ativo', true)
            ->whereNotNull('data_admissao');

        if ($request->user()?->dataScopeFor('vacations') === 'units') {
            $allowedUnitIds = $this->allowedVacationUnitIds($request);
            $query->whereIn('unidade_id', $allowedUnitIds !== [] ? $allowedUnitIds : [0]);
        }

        if ($request->filled('unidade_id')) {
            $query->where('unidade_id', (int) $request->integer('unidade_id'));
        }

        if ($request->filled('funcao_id')) {
            $query->where('funcao_id', (int) $request->integer('funcao_id'));
        }

        return $query;
    }

    /**
     * @return array<int, int>
     */
    private function allowedVacationUnitIds(Request $request): array
    {
        return $request->user()?->allowedUnitIdsFor('vacations') ?? [];
    }

    private function resolveApprovalToken(Request $request): string
    {
        return trim((string) ($request->header('X-Financial-Approval-Token') ?: $request->input('financial_approval_token', '')));
    }

    private function rebalanceCollaboratorVacationPeriods(int $colaboradorId): void
    {
        $colaborador = Colaborador::query()
            ->whereKey($colaboradorId)
            ->first(['id', 'data_admissao']);

        if (! $colaborador?->data_admissao) {
            return;
        }

        $admissao = CarbonImmutable::parse($colaborador->data_admissao->toDateString());

        $lancamentos = FeriasLancamento::query()
            ->where('colaborador_id', $colaboradorId)
            ->orderBy('data_inicio')
            ->orderBy('id')
            ->get(['id']);

        foreach ($lancamentos as $index => $lancamento) {
            $periodoInicio = $admissao->addYearsNoOverflow($index);
            $periodoFim = $periodoInicio->addYear()->subDay();

            FeriasLancamento::query()
                ->whereKey((int) $lancamento->id)
                ->update([
                    'periodo_aquisitivo_inicio' => $periodoInicio->toDateString(),
                    'periodo_aquisitivo_fim' => $periodoFim->toDateString(),
                ]);
        }
    }

    private function syncFinishedVacationsToPast(): void
    {
        $cacheKey = 'vacations:sync-finished-to-past';
        if (Cache::has($cacheKey)) {
            return;
        }

        $today = CarbonImmutable::today()->toDateString();

        $hasPending = FeriasLancamento::query()
            ->where('tipo', '!=', 'passada')
            ->whereNotNull('data_fim')
            ->whereDate('data_fim', '<', $today)
            ->exists();

        if ($hasPending) {
            FeriasLancamento::query()
                ->where('tipo', '!=', 'passada')
                ->whereNotNull('data_fim')
                ->whereDate('data_fim', '<', $today)
                ->update([
                    'tipo' => 'passada',
                ]);
        }

        Cache::put($cacheKey, true, now()->addMinutes(2));
    }
}
