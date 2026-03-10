<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBatchPagamentosRequest;
use App\Http\Requests\StorePagamentoRequest;
use App\Http\Requests\UpdatePagamentoRequest;
use App\Models\Colaborador;
use App\Models\EmprestimoColaborador;
use App\Models\Pagamento;
use App\Models\TipoPagamento;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PayrollController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $mesAtual = (int) now()->month;
        $anoAtual = (int) now()->year;

        $pagamentosMesQuery = $this->basePaymentsQueryForUser($request)
            ->where('competencia_mes', $mesAtual)
            ->where('competencia_ano', $anoAtual);

        $totals = (clone $pagamentosMesQuery)
            ->selectRaw('COUNT(*) as total_lancamentos')
            ->selectRaw('COALESCE(SUM(valor), 0) as total_valor')
            ->selectRaw('COUNT(DISTINCT colaborador_id) as total_colaboradores')
            ->first();

        $pagamentosLancados = (int) ($totals?->total_lancamentos ?? 0);
        $totalPagarMesAtual = (float) ($totals?->total_valor ?? 0);
        $colaboradoresPagosMes = (int) ($totals?->total_colaboradores ?? 0);

        $colaboradoresAtivos = Colaborador::query()->where('ativo', true)->count();
        $pagamentosAFazer = max(0, $colaboradoresAtivos - $colaboradoresPagosMes);

        $totaisPorUnidade = (clone $pagamentosMesQuery)
            ->selectRaw('unidade_id, COUNT(*) as total_lancamentos, SUM(valor) as total_valor')
            ->groupBy('unidade_id')
            ->with('unidade:id,nome')
            ->get()
            ->map(fn (Pagamento $pagamento): array => [
                'unidade_id' => $pagamento->unidade_id,
                'unidade_nome' => $pagamento->unidade?->nome,
                'total_lancamentos' => (int) ($pagamento->total_lancamentos ?? 0),
                'total_valor' => (float) ($pagamento->total_valor ?? 0),
            ])
            ->values();

        $pagamentosRecentes = $this->basePaymentsQueryForUser($request)
            ->with([
                'colaborador:id,nome,cpf,unidade_id',
                'unidade:id,nome,slug',
                'autor:id,name,email',
            ])
            ->latest('lancado_em')
            ->latest('id')
            ->limit(10)
            ->get();

        return response()->json([
            'competencia_mes' => $mesAtual,
            'competencia_ano' => $anoAtual,
            'total_pagamentos_a_fazer' => $pagamentosAFazer,
            'total_pagamentos_lancados' => $pagamentosLancados,
            'colaboradores_ativos' => $colaboradoresAtivos,
            'total_a_pagar_mes_atual' => $totalPagarMesAtual,
            'totais_por_unidade' => $totaisPorUnidade,
            'pagamentos_recentes' => $pagamentosRecentes,
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $mes = (int) $request->integer('competencia_mes', (int) now()->month);
        $ano = (int) $request->integer('competencia_ano', (int) now()->year);

        $query = $this->basePaymentsQueryForUser($request)
            ->with(['unidade:id,nome'])
            ->where('competencia_mes', $mes)
            ->where('competencia_ano', $ano);

        $totals = (clone $query)
            ->selectRaw('COUNT(*) as total_lancamentos')
            ->selectRaw('COALESCE(SUM(valor), 0) as total_valor')
            ->selectRaw('COUNT(DISTINCT colaborador_id) as total_colaboradores')
            ->first();

        $totalLancamentos = (int) ($totals?->total_lancamentos ?? 0);
        $totalValor = (float) ($totals?->total_valor ?? 0);
        $totalColaboradores = (int) ($totals?->total_colaboradores ?? 0);

        $porUnidade = (clone $query)
            ->selectRaw('unidade_id, COUNT(*) as total_lancamentos, SUM(valor) as total_valor')
            ->groupBy('unidade_id')
            ->with('unidade:id,nome')
            ->get()
            ->map(fn (Pagamento $pagamento): array => [
                'unidade_id' => $pagamento->unidade_id,
                'unidade_nome' => $pagamento->unidade?->nome,
                'total_lancamentos' => (int) ($pagamento->total_lancamentos ?? 0),
                'total_valor' => (float) ($pagamento->total_valor ?? 0),
            ])
            ->values();

        return response()->json([
            'competencia_mes' => $mes,
            'competencia_ano' => $ano,
            'total_lancamentos' => $totalLancamentos,
            'total_colaboradores' => $totalColaboradores,
            'total_valor' => $totalValor,
            'por_unidade' => $porUnidade,
        ]);
    }

    public function launchCandidates(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $unidadeId = (int) $request->integer('unidade_id');
        $descricao = trim((string) $request->string('descricao'));
        $dataPagamento = $request->date('data_pagamento')?->toDateString() ?? now()->toDateString();
        $tipoPagamentoIds = collect((array) $request->input('tipo_pagamento_ids', []))
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values();

        abort_if($unidadeId <= 0, 422, 'Informe uma unidade válida.');

        $colaboradores = Colaborador::query()
            ->with(['unidade:id,nome,slug'])
            ->where('ativo', true)
            ->where('unidade_id', $unidadeId)
            ->orderBy('nome')
            ->get();

        $existingQuery = Pagamento::query()
            ->select(['id', 'colaborador_id', 'tipo_pagamento_id', 'valor'])
            ->where('unidade_id', $unidadeId)
            ->whereDate('data_pagamento', $dataPagamento);

        if ($descricao !== '') {
            $existingQuery->where('descricao', $descricao);
        }

        if ($tipoPagamentoIds->isNotEmpty()) {
            $existingQuery->whereIn('tipo_pagamento_id', $tipoPagamentoIds->all());
        }

        $existingByCollaboratorAndType = $existingQuery
            ->get()
            ->groupBy('colaborador_id')
            ->map(function ($items) {
                return $items->keyBy('tipo_pagamento_id')->map(fn (Pagamento $pagamento): array => [
                    'id' => $pagamento->id,
                    'valor' => (float) $pagamento->valor,
                ]);
            });

        return response()->json([
            'data_pagamento' => $dataPagamento,
            'data' => $colaboradores->map(function (Colaborador $colaborador) use ($existingByCollaboratorAndType): array {
                $existingByType = $existingByCollaboratorAndType->get($colaborador->id);

                return [
                    'id' => $colaborador->id,
                    'nome' => $colaborador->nome,
                    'cpf' => $colaborador->cpf,
                    'unidade_id' => $colaborador->unidade_id,
                    'unidade' => $colaborador->unidade,
                    'pagamentos_existentes_por_tipo' => $existingByType?->toArray() ?? [],
                ];
            })->values(),
        ]);
    }

    public function launchBatch(StoreBatchPagamentosRequest $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $data = $request->validated();

        $legacyMode = ! isset($data['data_pagamento']) || ! isset($data['tipo_pagamento_ids']);

        if ($legacyMode) {
            $created = DB::transaction(function () use ($data, $request) {
                return collect((array) $data['pagamentos'])
                    ->filter(function (array $item): bool {
                        return (float) ($item['valor'] ?? 0) > 0;
                    })
                    ->map(function (array $item) use ($data, $request) {
                        return Pagamento::query()->create([
                            'colaborador_id' => (int) $item['colaborador_id'],
                            'unidade_id' => (int) $data['unidade_id'],
                            'autor_id' => (int) $request->user()->id,
                            'competencia_mes' => (int) $data['competencia_mes'],
                            'competencia_ano' => (int) $data['competencia_ano'],
                            'valor' => (float) $item['valor'],
                            'observacao' => $item['observacao'] ?? null,
                            'lancado_em' => now(),
                        ]);
                    })
                    ->values();
            });

            return response()->json([
                'message' => 'Pagamentos lançados com sucesso.',
                'created_count' => $created->count(),
                'data' => $created,
            ], 201);
        }

        $dataPagamento = (string) $data['data_pagamento'];
        $descricao = trim((string) ($data['descricao'] ?? ''));
        $dataPagamentoDate = now()->parse($dataPagamento);

        $tiposMap = TipoPagamento::query()
            ->whereIn('id', array_map('intval', (array) $data['tipo_pagamento_ids']))
            ->get()
            ->keyBy('id');

        $created = DB::transaction(function () use ($data, $request, $dataPagamento, $dataPagamentoDate, $descricao, $tiposMap) {
            return collect((array) $data['pagamentos'])
                ->flatMap(function (array $item) use ($data, $request, $dataPagamento, $dataPagamentoDate, $descricao, $tiposMap) {
                    if (!($item['selected'] ?? false)) {
                        return [];
                    }

                    $valoresPorTipo = (array) ($item['valores_por_tipo'] ?? []);
                    $createdItems = [];

                    foreach ((array) $data['tipo_pagamento_ids'] as $tipoIdRaw) {
                        $tipoId = (int) $tipoIdRaw;
                        $valor = (float) ($valoresPorTipo[(string) $tipoId] ?? 0);

                        if ($valor <= 0) {
                            continue;
                        }

                        $tipoPagamento = $tiposMap->get($tipoId);

                        $createdItems[] = Pagamento::query()->create([
                            'colaborador_id' => (int) $item['colaborador_id'],
                            'unidade_id' => (int) $data['unidade_id'],
                            'autor_id' => (int) $request->user()->id,
                            'tipo_pagamento_id' => $tipoId,
                            'competencia_mes' => (int) $dataPagamentoDate->month,
                            'competencia_ano' => (int) $dataPagamentoDate->year,
                            'valor' => $valor,
                            'descricao' => $descricao !== ''
                                ? $descricao
                                : ($tipoPagamento?->nome ?? 'Pagamento'),
                            'data_pagamento' => $dataPagamento,
                            'observacao' => null,
                            'lancado_em' => now(),
                        ]);
                    }

                    return $createdItems;
                })
                ->values();
        });

        return response()->json([
            'message' => 'Pagamentos lançados com sucesso.',
            'created_count' => $created->count(),
            'data' => $created,
        ], 201);
    }

    public function reportByUnit(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $unidadeId = (int) $request->integer('unidade_id');
        $mes = (int) $request->integer('competencia_mes', (int) now()->month);
        $ano = (int) $request->integer('competencia_ano', (int) now()->year);

        abort_if($unidadeId <= 0, 422, 'Informe uma unidade válida.');

        $base = $this->basePaymentsQueryForUser($request)
            ->where('unidade_id', $unidadeId);

        $mensal = (clone $base)
            ->where('competencia_mes', $mes)
            ->where('competencia_ano', $ano);

        $totalPagoMes = (float) ((clone $mensal)->sum('valor'));
        $colaboradoresPagos = (clone $mensal)
            ->distinct('colaborador_id')
            ->count('colaborador_id');
        $mediaSalarial = $colaboradoresPagos > 0
            ? $totalPagoMes / $colaboradoresPagos
            : 0.0;

        $distributionRanges = [
            ['label' => 'Até 2.000', 'min' => 0, 'max' => 2000],
            ['label' => '2.000 a 3.500', 'min' => 2000.01, 'max' => 3500],
            ['label' => '3.500 a 5.000', 'min' => 3500.01, 'max' => 5000],
            ['label' => 'Acima de 5.000', 'min' => 5000.01, 'max' => null],
        ];

        $values = (clone $mensal)->pluck('valor')->map(fn ($value) => (float) $value)->values();

        $distribuicao = collect($distributionRanges)->map(function (array $range) use ($values): array {
            $count = $values->filter(function (float $value) use ($range): bool {
                if ($range['max'] === null) {
                    return $value >= $range['min'];
                }

                return $value >= $range['min'] && $value <= $range['max'];
            })->count();

            return [
                'faixa' => $range['label'],
                'quantidade' => $count,
            ];
        })->values();

        $evolucao = (clone $base)
            ->selectRaw('competencia_ano, competencia_mes, SUM(valor) as total_valor, COUNT(*) as total_lancamentos')
            ->groupBy('competencia_ano', 'competencia_mes')
            ->orderBy('competencia_ano')
            ->orderBy('competencia_mes')
            ->get()
            ->map(fn (Pagamento $pagamento): array => [
                'competencia_ano' => (int) $pagamento->competencia_ano,
                'competencia_mes' => (int) $pagamento->competencia_mes,
                'total_valor' => (float) ($pagamento->total_valor ?? 0),
                'total_lancamentos' => (int) ($pagamento->total_lancamentos ?? 0),
            ])
            ->values();

        return response()->json([
            'unidade_id' => $unidadeId,
            'competencia_mes' => $mes,
            'competencia_ano' => $ano,
            'total_pago_mes' => $totalPagoMes,
            'colaboradores_pagos' => $colaboradoresPagos,
            'media_salarial' => $mediaSalarial,
            'distribuicao' => $distribuicao,
            'evolucao_mensal' => $evolucao,
        ]);
    }

    public function reportByCollaborator(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $colaboradorId = (int) $request->integer('colaborador_id');
        abort_if($colaboradorId <= 0, 422, 'Informe um colaborador válido.');

        $colaborador = Colaborador::query()
            ->with(['unidade:id,nome,slug', 'funcao:id,nome'])
            ->whereKey($colaboradorId)
            ->firstOrFail();

        $historico = $this->basePaymentsQueryForUser($request)
            ->where('colaborador_id', $colaboradorId)
            ->orderBy('competencia_ano')
            ->orderBy('competencia_mes')
            ->get();

        $totalAcumulado = (float) $historico->sum('valor');
        $mediaSalarial = $historico->count() > 0
            ? $totalAcumulado / $historico->count()
            : 0.0;

        $emprestimos = EmprestimoColaborador::query()
            ->where('colaborador_id', $colaboradorId)
            ->where('ativo', true)
            ->get();

        $timeline = $historico->map(function (Pagamento $pagamento) use ($emprestimos): array {
            $parcelaEmprestimo = $emprestimos->sum(function (EmprestimoColaborador $emprestimo) use ($pagamento): float {
                $inicio = $emprestimo->data_inicio?->copy()->startOfMonth();

                if (! $inicio) {
                    return 0.0;
                }

                $competencia = now()
                    ->setDate((int) $pagamento->competencia_ano, (int) $pagamento->competencia_mes, 1)
                    ->startOfMonth();

                if ($competencia->lt($inicio)) {
                    return 0.0;
                }

                $mesesDiff = (($competencia->year - $inicio->year) * 12) + ($competencia->month - $inicio->month);

                if ($mesesDiff < 0 || $mesesDiff >= (int) $emprestimo->total_parcelas) {
                    return 0.0;
                }

                return (float) $emprestimo->valor_parcela;
            });

            $valorPagamento = (float) $pagamento->valor;

            return [
                'id' => $pagamento->id,
                'competencia_mes' => (int) $pagamento->competencia_mes,
                'competencia_ano' => (int) $pagamento->competencia_ano,
                'valor' => $valorPagamento,
                'parcela_emprestimo' => $parcelaEmprestimo,
                'ganho_total' => $valorPagamento + $parcelaEmprestimo,
                'lancado_em' => $pagamento->lancado_em?->toISOString(),
                'observacao' => $pagamento->observacao,
            ];
        })->values();

        $totalAcumuladoComEmprestimo = (float) $timeline->sum('ganho_total');

        $variacao = $historico
            ->values()
            ->map(function (Pagamento $pagamento, int $index) use ($historico): array {
                $current = (float) $pagamento->valor;

                if ($index === 0) {
                    return [
                        'competencia_mes' => (int) $pagamento->competencia_mes,
                        'competencia_ano' => (int) $pagamento->competencia_ano,
                        'variacao_percentual' => null,
                    ];
                }

                $previous = (float) $historico[$index - 1]->valor;

                if ($previous == 0.0) {
                    return [
                        'competencia_mes' => (int) $pagamento->competencia_mes,
                        'competencia_ano' => (int) $pagamento->competencia_ano,
                        'variacao_percentual' => null,
                    ];
                }

                $percentage = (($current - $previous) / $previous) * 100;

                return [
                    'competencia_mes' => (int) $pagamento->competencia_mes,
                    'competencia_ano' => (int) $pagamento->competencia_ano,
                    'variacao_percentual' => round($percentage, 2),
                ];
            })
            ->values();

        return response()->json([
            'colaborador' => $colaborador,
            'timeline' => $timeline,
            'total_acumulado' => $totalAcumulado,
            'total_acumulado_com_emprestimo' => $totalAcumuladoComEmprestimo,
            'media_salarial' => $mediaSalarial,
            'variacao_percentual' => $variacao,
            'datas_importantes' => [
                'data_admissao' => $colaborador->data_admissao?->toDateString(),
                'data_demissao' => $colaborador->data_demissao?->toDateString(),
                'data_nascimento' => $colaborador->data_nascimento?->toDateString(),
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $perPage = min(max((int) $request->integer('per_page', 15), 1), 100);

        $query = $this->basePaymentsQueryForUser($request)
            ->with([
                'colaborador:id,nome,cpf,unidade_id,nome_banco,numero_agencia,numero_conta,tipo_conta,chave_pix,banco_salario,numero_agencia_salario,numero_conta_salario,conta_pagamento,cartao_beneficio',
                'colaborador.unidade:id,nome,slug',
                'unidade:id,nome,slug',
                'autor:id,name,email',
                'tipoPagamento:id,nome,categoria,forma_pagamento',
            ])
            ->latest('lancado_em')
            ->latest('id');

        if ($request->filled('competencia_mes')) {
            $query->where('competencia_mes', (int) $request->integer('competencia_mes'));
        }

        if ($request->filled('competencia_ano')) {
            $query->where('competencia_ano', (int) $request->integer('competencia_ano'));
        }

        if ($request->filled('unidade_id')) {
            $query->where('unidade_id', (int) $request->integer('unidade_id'));
        }

        if ($request->filled('colaborador_id')) {
            $query->where('colaborador_id', (int) $request->integer('colaborador_id'));
        }

        if ($request->filled('descricao')) {
            $query->where('descricao', 'like', '%'.(string) $request->string('descricao').'%');
        }

        if ($request->filled('data_pagamento')) {
            $query->whereDate('data_pagamento', (string) $request->string('data_pagamento'));
        }

        if ($request->filled('tipo_pagamento_id')) {
            $query->where('tipo_pagamento_id', (int) $request->integer('tipo_pagamento_id'));
        }

        if ($request->filled('name')) {
            $name = (string) $request->string('name');
            $query->whereHas('colaborador', function (Builder $builder) use ($name): void {
                $builder->where('nome', 'like', "%{$name}%");
            });
        }

        if ($request->filled('autor_id') && $request->user()?->isMasterAdmin()) {
            $query->where('autor_id', (int) $request->integer('autor_id'));
        }

        return response()->json($query->paginate($perPage)->withQueryString());
    }

    public function store(StorePagamentoRequest $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $data = $request->validated();

        $colaborador = Colaborador::query()
            ->whereKey((int) $data['colaborador_id'])
            ->firstOrFail();

        $dataPagamento = isset($data['data_pagamento'])
            ? now()->parse((string) $data['data_pagamento'])
            : null;

        $pagamento = Pagamento::query()->create([
            'colaborador_id' => (int) $data['colaborador_id'],
            'unidade_id' => (int) $colaborador->unidade_id,
            'autor_id' => (int) $request->user()->id,
            'tipo_pagamento_id' => $data['tipo_pagamento_id'] ?? null,
            'competencia_mes' => (int) ($dataPagamento?->month ?? $data['competencia_mes'] ?? now()->month),
            'competencia_ano' => (int) ($dataPagamento?->year ?? $data['competencia_ano'] ?? now()->year),
            'valor' => (float) $data['valor'],
            'descricao' => $data['descricao'] ?? null,
            'data_pagamento' => $data['data_pagamento'] ?? null,
            'observacao' => $data['observacao'] ?? null,
            'lancado_em' => $data['lancado_em'] ?? now(),
        ]);

        return response()->json([
            'data' => $pagamento->load([
                'colaborador:id,nome,cpf,unidade_id',
                'colaborador.unidade:id,nome,slug',
                'unidade:id,nome,slug',
                'autor:id,name,email',
                'tipoPagamento:id,nome,categoria,forma_pagamento',
            ]),
        ], 201);
    }

    public function show(Request $request, Pagamento $pagamento): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        if (! $request->user()?->isMasterAdmin() && $pagamento->autor_id !== $request->user()->id) {
            abort(403);
        }

        return response()->json([
            'data' => $pagamento->load([
                'colaborador:id,nome,cpf,unidade_id',
                'colaborador.unidade:id,nome,slug',
                'unidade:id,nome,slug',
                'autor:id,name,email',
                'tipoPagamento:id,nome,categoria,forma_pagamento',
            ]),
        ]);
    }

    public function update(UpdatePagamentoRequest $request, Pagamento $pagamento): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        if (! $request->user()?->isMasterAdmin() && $pagamento->autor_id !== $request->user()->id) {
            abort(403);
        }

        $data = $request->validated();

        if (array_key_exists('colaborador_id', $data)) {
            $colaborador = Colaborador::query()
                ->whereKey((int) $data['colaborador_id'])
                ->firstOrFail();

            $data['unidade_id'] = (int) $colaborador->unidade_id;
        }

        if (array_key_exists('data_pagamento', $data) && $data['data_pagamento']) {
            $dataPagamento = now()->parse((string) $data['data_pagamento']);
            $data['competencia_mes'] = (int) $dataPagamento->month;
            $data['competencia_ano'] = (int) $dataPagamento->year;
        }

        $pagamento->update($data);

        return response()->json([
            'data' => $pagamento->refresh()->load([
                'colaborador:id,nome,cpf,unidade_id',
                'colaborador.unidade:id,nome,slug',
                'unidade:id,nome,slug',
                'autor:id,name,email',
                'tipoPagamento:id,nome,categoria,forma_pagamento',
            ]),
        ]);
    }

    public function destroy(Request $request, Pagamento $pagamento): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        if (! $request->user()?->isMasterAdmin() && $pagamento->autor_id !== $request->user()->id) {
            abort(403);
        }

        $pagamento->delete();

        return response()->json([], 204);
    }

    private function basePaymentsQueryForUser(Request $request): Builder
    {
        $query = Pagamento::query();

        if (! $request->user()?->isMasterAdmin()) {
            $query->where('autor_id', $request->user()->id);
        }

        return $query;
    }
}
