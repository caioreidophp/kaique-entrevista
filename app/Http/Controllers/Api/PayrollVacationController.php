<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFeriasLancamentoRequest;
use App\Models\Colaborador;
use App\Models\FeriasLancamento;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

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
    ];

    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->isAdmin() || $user?->isMasterAdmin(), 403);

        $rows = $this->buildEligibilityRows($request);

        $today = CarbonImmutable::today();
        $plus30Days = $today->addDays(30);
        $plus2Months = $today->addMonths(2);
        $plus4Months = $today->addMonths(4);

        $feriasVencidas = $rows->where('status', 'vencida')->count();
        $feriasAVencer = $rows
            ->whereIn('status', ['a_vencer', 'liberada', 'atencao', 'urgente'])
            ->count();

        $limiteProximos2Meses = $rows
            ->filter(fn (array $row): bool => CarbonImmutable::parse($row['limite'])->betweenIncluded($today, $plus2Months))
            ->count();

        $limiteProximos4Meses = $rows
            ->filter(fn (array $row): bool => CarbonImmutable::parse($row['limite'])->betweenIncluded($today, $plus4Months))
            ->count();

        $feriasProgramadasProximos30Dias = FeriasLancamento::query()
            ->whereDate('data_inicio', '>=', $today->toDateString())
            ->whereDate('data_inicio', '<=', $plus30Days->toDateString())
            ->count();

        $lancamentosAnoAtual = FeriasLancamento::query()
            ->whereYear('data_inicio', (int) $today->year)
            ->count();

        $totalLancamentos = FeriasLancamento::query()->count();
        $totalComAbono = FeriasLancamento::query()->where('com_abono', true)->count();
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

        return response()->json([
            'data' => [
                'ferias_vencidas' => $feriasVencidas,
                'ferias_a_vencer' => $feriasAVencer,
                'limite_proximos_4_meses' => $limiteProximos4Meses,
                'limite_proximos_2_meses' => $limiteProximos2Meses,
                'ferias_programadas_30_dias' => $feriasProgramadasProximos30Dias,
                'lancamentos_ano_atual' => $lancamentosAnoAtual,
                'percentual_com_abono' => $percentualComAbono,
                'percentual_sem_abono' => $percentualSemAbono,
                'taxa_vencidas_sobre_ativos' => $taxaVencidasSobreAtivos,
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->isAdmin() || $user?->isMasterAdmin(), 403);

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

        abort_unless($user?->isAdmin() || $user?->isMasterAdmin(), 403);

        return response()->json([
            'data' => $this->buildEligibilityRows($request)
                ->sortBy('nome')
                ->values(),
        ]);
    }

    public function launched(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->isAdmin() || $user?->isMasterAdmin(), 403);

        $sortBy = (string) $request->string('sort_by', 'data_inicio');
        $sortDirection = (string) $request->string('sort_direction', 'desc');

        if (! in_array($sortBy, self::REALIZADAS_SORTABLE_FIELDS, true)) {
            $sortBy = 'data_inicio';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }

        $rows = FeriasLancamento::query()
            ->with([
                'colaborador:id,nome',
                'unidade:id,nome',
                'funcao:id,nome',
                'autor:id,name',
            ])
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
                'com_abono' => (bool) $item->com_abono,
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

        abort_unless($user?->isAdmin() || $user?->isMasterAdmin(), 403);

        $validated = $request->validated();
        $comAbono = (bool) $validated['com_abono'];
        $diasFerias = $comAbono ? 20 : 30;

        $colaborador = Colaborador::query()
            ->whereKey((int) $validated['colaborador_id'])
            ->with(['unidade:id,nome', 'funcao:id,nome'])
            ->firstOrFail();

        $dataInicio = CarbonImmutable::parse((string) $validated['data_inicio']);
        $dataFim = isset($validated['data_fim'])
            ? CarbonImmutable::parse((string) $validated['data_fim'])
            : $dataInicio->addDays($diasFerias - 1);

        $lancamento = FeriasLancamento::query()->create([
            'colaborador_id' => (int) $colaborador->id,
            'unidade_id' => (int) $colaborador->unidade_id,
            'funcao_id' => $colaborador->funcao_id,
            'autor_id' => (int) $request->user()->id,
            'com_abono' => $comAbono,
            'dias_ferias' => $diasFerias,
            'data_inicio' => $dataInicio->toDateString(),
            'data_fim' => $dataFim->toDateString(),
            'periodo_aquisitivo_inicio' => (string) $validated['periodo_aquisitivo_inicio'],
            'periodo_aquisitivo_fim' => (string) $validated['periodo_aquisitivo_fim'],
        ]);

        return response()->json([
            'data' => $lancamento->load(['colaborador:id,nome', 'unidade:id,nome', 'funcao:id,nome', 'autor:id,name']),
        ], 201);
    }

    public function update(StoreFeriasLancamentoRequest $request, FeriasLancamento $feriasLancamento): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->isAdmin() || $user?->isMasterAdmin(), 403);

        $validated = $request->validated();
        $comAbono = (bool) $validated['com_abono'];
        $diasFerias = $comAbono ? 20 : 30;

        $colaborador = Colaborador::query()
            ->whereKey((int) $validated['colaborador_id'])
            ->with(['unidade:id,nome', 'funcao:id,nome'])
            ->firstOrFail();

        $dataInicio = CarbonImmutable::parse((string) $validated['data_inicio']);
        $dataFim = isset($validated['data_fim'])
            ? CarbonImmutable::parse((string) $validated['data_fim'])
            : $dataInicio->addDays($diasFerias - 1);

        $feriasLancamento->update([
            'colaborador_id' => (int) $colaborador->id,
            'unidade_id' => (int) $colaborador->unidade_id,
            'funcao_id' => $colaborador->funcao_id,
            'autor_id' => (int) $request->user()->id,
            'com_abono' => $comAbono,
            'dias_ferias' => $diasFerias,
            'data_inicio' => $dataInicio->toDateString(),
            'data_fim' => $dataFim->toDateString(),
            'periodo_aquisitivo_inicio' => (string) $validated['periodo_aquisitivo_inicio'],
            'periodo_aquisitivo_fim' => (string) $validated['periodo_aquisitivo_fim'],
        ]);

        return response()->json([
            'data' => $feriasLancamento->refresh()->load(['colaborador:id,nome', 'unidade:id,nome', 'funcao:id,nome', 'autor:id,name']),
        ]);
    }

    public function collaboratorHistory(Request $request, Colaborador $colaborador): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->isAdmin() || $user?->isMasterAdmin(), 403);

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
                'com_abono' => (bool) $item->com_abono,
                'dias_ferias' => (int) $item->dias_ferias,
                'observacoes' => null,
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

                $baseDate = (string) ($latestPeriodEndByCollaborator->get($colaborador->id) ?? $admissao);
                $base = CarbonImmutable::parse($baseDate);
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
                    'periodo_aquisitivo_fim' => $base->addDays(364)->toDateString(),
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

        if ($request->filled('unidade_id')) {
            $query->where('unidade_id', (int) $request->integer('unidade_id'));
        }

        if ($request->filled('funcao_id')) {
            $query->where('funcao_id', (int) $request->integer('funcao_id'));
        }

        return $query;
    }
}
