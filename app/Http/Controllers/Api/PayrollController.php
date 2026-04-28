<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\GeneratePayrollExportJob;
use App\Http\Requests\StoreBatchPagamentosRequest;
use App\Http\Requests\StorePagamentoRequest;
use App\Http\Requests\UpdatePagamentoRequest;
use App\Models\AsyncExport;
use App\Models\Colaborador;
use App\Models\DescontoColaborador;
use App\Models\EmprestimoColaborador;
use App\Models\Pagamento;
use App\Models\PensaoColaborador;
use App\Models\TipoPagamento;
use App\Support\AsyncOperationTracker;
use App\Support\FinancialApprovalService;
use App\Support\OutboundWebhookService;
use App\Support\TransportCache;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PayrollController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $validated = $request->validate([
            'competencia_mes' => ['nullable', 'integer', 'min:1', 'max:12'],
            'competencia_ano' => ['nullable', 'integer', 'min:2000', 'max:2100'],
        ]);

        $mesAtual = (int) ($validated['competencia_mes'] ?? (int) now()->month);
        $anoAtual = (int) ($validated['competencia_ano'] ?? (int) now()->year);

        $cacheKey = sprintf(
            'payroll:dashboard:%s:%02d:%04d:%d',
            $request->user()?->isMasterAdmin() ? 'master' : 'user:'.(int) $request->user()->id,
            $mesAtual,
            $anoAtual,
            $this->payrollCacheVersion(),
        );

        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return response()->json($cached);
        }

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

        $totaisPorTipo = (clone $pagamentosMesQuery)
            ->selectRaw('tipo_pagamento_id, COUNT(*) as total_lancamentos, SUM(valor) as total_valor')
            ->groupBy('tipo_pagamento_id')
            ->with('tipoPagamento:id,nome')
            ->get()
            ->map(fn (Pagamento $pagamento): array => [
                'tipo_pagamento_id' => $pagamento->tipo_pagamento_id,
                'tipo_pagamento_nome' => $pagamento->tipoPagamento?->nome ?? 'Não informado',
                'total_lancamentos' => (int) ($pagamento->total_lancamentos ?? 0),
                'total_valor' => (float) ($pagamento->total_valor ?? 0),
            ])
            ->values();

        $pagamentosRecentes = $this->basePaymentsQueryForUser($request)
            ->select([
                'id',
                'colaborador_id',
                'unidade_id',
                'competencia_mes',
                'competencia_ano',
                'valor',
                'lancado_em',
            ])
            ->with([
                'colaborador:id,nome',
                'unidade:id,nome',
            ])
            ->latest('lancado_em')
            ->latest('id')
            ->limit(10)
            ->get();

        $payload = [
            'competencia_mes' => $mesAtual,
            'competencia_ano' => $anoAtual,
            'colaboradores_pagos_mes' => $colaboradoresPagosMes,
            'total_pagamentos_a_fazer' => $pagamentosAFazer,
            'total_pagamentos_lancados' => $pagamentosLancados,
            'colaboradores_ativos' => $colaboradoresAtivos,
            'total_a_pagar_mes_atual' => $totalPagarMesAtual,
            'totais_por_unidade' => $totaisPorUnidade,
            'totais_por_tipo' => $totaisPorTipo,
            'pagamentos_recentes' => $pagamentosRecentes,
        ];

        Cache::put($cacheKey, $payload, now()->addSeconds(60));

        return response()->json($payload);
    }

    public function dashboardPage(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $mes = (int) $request->integer('competencia_mes', (int) now()->month);
        $ano = (int) $request->integer('competencia_ano', (int) now()->year);

        $cacheKey = sprintf(
            'payroll:dashboard-page:%s:%02d:%04d:%d',
            $request->user()?->isMasterAdmin() ? 'master' : 'user:'.(int) $request->user()->id,
            $mes,
            $ano,
            $this->payrollCacheVersion(),
        );

        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return response()->json($cached);
        }

        $dashboardRequest = $request->duplicate([
            'competencia_mes' => $mes,
            'competencia_ano' => $ano,
        ]);
        $dashboardRequest->setUserResolver(fn () => $request->user());

        $summaryRequest = $request->duplicate([
            'competencia_mes' => $mes,
            'competencia_ano' => $ano,
        ]);
        $summaryRequest->setUserResolver(fn () => $request->user());

        $payload = [
            'dashboard' => $this->dashboard($dashboardRequest)->getData(true),
            'summary' => $this->summary($summaryRequest)->getData(true),
        ];

        Cache::put($cacheKey, $payload, now()->addSeconds(60));

        return response()->json($payload);
    }

    public function summary(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $mes = (int) $request->integer('competencia_mes', (int) now()->month);
        $ano = (int) $request->integer('competencia_ano', (int) now()->year);

        $cacheKey = sprintf(
            'payroll:summary:%s:%d:%d:%d',
            $request->user()?->isMasterAdmin() ? 'master' : 'user:'.(int) $request->user()->id,
            $mes,
            $ano,
            $this->payrollCacheVersion(),
        );

        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return response()->json($cached);
        }

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

        $payload = [
            'competencia_mes' => $mes,
            'competencia_ano' => $ano,
            'total_lancamentos' => $totalLancamentos,
            'total_colaboradores' => $totalColaboradores,
            'total_valor' => $totalValor,
            'por_unidade' => $porUnidade,
        ];

        Cache::put($cacheKey, $payload, now()->addSeconds(60));

        return response()->json($payload);
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

        $pensoesByCollaborator = PensaoColaborador::query()
            ->select([
                'id',
                'colaborador_id',
                'nome_beneficiaria',
                'cpf_beneficiaria',
                'nome_banco',
                'numero_banco',
                'numero_agencia',
                'tipo_conta',
                'numero_conta',
                'tipo_chave_pix',
                'chave_pix',
                'ativo',
            ])
            ->where('ativo', true)
            ->whereIn('colaborador_id', $colaboradores->pluck('id')->all())
            ->orderBy('nome_beneficiaria')
            ->get()
            ->groupBy('colaborador_id');

        $existingQuery = Pagamento::query()
            ->select(['id', 'colaborador_id', 'tipo_pagamento_id', 'valor'])
            ->whereDate('data_pagamento', $dataPagamento);

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
            'data' => $colaboradores->map(function (Colaborador $colaborador) use ($existingByCollaboratorAndType, $pensoesByCollaborator): array {
                $existingByType = $existingByCollaboratorAndType->get($colaborador->id);

                return [
                    'id' => $colaborador->id,
                    'nome' => $colaborador->nome,
                    'cpf' => $colaborador->cpf,
                    'adiantamento_salarial' => (bool) $colaborador->adiantamento_salarial,
                    'unidade_id' => $colaborador->unidade_id,
                    'unidade' => $colaborador->unidade,
                    'pagamentos_existentes_por_tipo' => $existingByType?->toArray() ?? [],
                    'pensoes' => ($pensoesByCollaborator->get($colaborador->id) ?? collect())
                        ->map(fn (PensaoColaborador $pensao): array => [
                            'id' => $pensao->id,
                            'nome_beneficiaria' => $pensao->nome_beneficiaria,
                            'cpf_beneficiaria' => $pensao->cpf_beneficiaria,
                            'nome_banco' => $pensao->nome_banco,
                            'numero_banco' => $pensao->numero_banco,
                            'numero_agencia' => $pensao->numero_agencia,
                            'tipo_conta' => $pensao->tipo_conta,
                            'numero_conta' => $pensao->numero_conta,
                            'tipo_chave_pix' => $pensao->tipo_chave_pix,
                            'chave_pix' => $pensao->chave_pix,
                            'ativo' => (bool) $pensao->ativo,
                        ])
                        ->values()
                        ->all(),
                ];
            })->values(),
        ]);
    }

    public function launchBatch(StoreBatchPagamentosRequest $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $data = $request->validated();

        /** @var FinancialApprovalService $approvalService */
        $approvalService = app(FinancialApprovalService::class);
        $requestHash = $approvalService->buildRequestHash($data);

        if ($approvalService->requiresPayrollLaunchApproval($request->user(), $data)) {
            $summary = $approvalService->buildPayrollLaunchSummary($data);
            $approvalToken = trim((string) ($request->header('X-Financial-Approval-Token') ?: $request->input('financial_approval_token', '')));

            if ($approvalToken === '') {
                $approval = $approvalService->requestOrReusePendingApproval(
                    requester: $request->user(),
                    actionKey: 'payroll.launch-batch',
                    requestHash: $requestHash,
                    summary: $summary,
                );

                return response()->json([
                    'message' => 'Esta operação exige aprovação adicional por volume/valor.',
                    'approval_required' => true,
                    'approval_id' => (int) $approval->id,
                    'approval_uuid' => (string) $approval->request_uuid,
                    'summary' => $summary,
                ], 202);
            }

            $consumedApproval = $approvalService->consumeExecutionToken(
                requester: $request->user(),
                token: $approvalToken,
                requestHash: $requestHash,
            );

            abort_unless($consumedApproval, 422, 'Token de aprovação inválido, expirado ou incompatível com esta solicitação.');
        }

        $legacyMode = ! isset($data['data_pagamento']) || ! isset($data['tipo_pagamento_ids']);

        /** @var OutboundWebhookService $webhookService */
        $webhookService = app(OutboundWebhookService::class);

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

                    $this->bumpPayrollCacheVersion();

            $webhookService->dispatch('payroll.batch.launched', [
                'mode' => 'legacy',
                'created_count' => $created->count(),
                'requested_by' => [
                    'id' => (int) $request->user()->id,
                    'name' => (string) $request->user()->name,
                    'email' => (string) $request->user()->email,
                ],
                'unidade_id' => (int) ($data['unidade_id'] ?? 0),
                'competencia_mes' => (int) ($data['competencia_mes'] ?? 0),
                'competencia_ano' => (int) ($data['competencia_ano'] ?? 0),
                'generated_at' => now()->toISOString(),
            ]);

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
                    if (! ($item['selected'] ?? false)) {
                        return [];
                    }

                    $diasUteis = max((int) ($item['dias_uteis'] ?? 0), 0);
                    $valoresPorTipo = (array) ($item['valores_por_tipo'] ?? []);
                    $valoresPensao = collect((array) ($item['valores_pensao'] ?? []))
                        ->mapWithKeys(fn ($valor, $pensaoId) => [(int) $pensaoId => (float) $valor])
                        ->filter(fn (float $valor, int $pensaoId) => $pensaoId > 0 && $valor > 0)
                        ->all();
                    $createdItems = [];

                    foreach ((array) $data['tipo_pagamento_ids'] as $tipoIdRaw) {
                        $tipoId = (int) $tipoIdRaw;
                        $valor = (float) ($valoresPorTipo[(string) $tipoId] ?? 0);

                        if ($valor <= 0) {
                            continue;
                        }

                        $tipoPagamento = $tiposMap->get($tipoId);
                        $observacaoPayload = [];

                        if ($diasUteis > 0) {
                            $observacaoPayload['dias_uteis'] = $diasUteis;
                        }

                        if ($tipoPagamento?->categoria === 'salario' && count($valoresPensao) > 0) {
                            $observacaoPayload['pensoes'] = collect($valoresPensao)->map(
                                fn (float $valorPensao, int $pensaoId): array => [
                                    'pensao_id' => $pensaoId,
                                    'valor' => round($valorPensao, 2),
                                ],
                            )->values()->all();
                        }

                        $observacao = count($observacaoPayload) > 0
                            ? json_encode($observacaoPayload)
                            : null;
                        $dataPagamentoKey = $dataPagamentoDate->toDateString();

                        $existingPayment = Pagamento::query()
                            ->where('colaborador_id', (int) $item['colaborador_id'])
                            ->where('tipo_pagamento_id', $tipoId)
                            ->whereDate('data_pagamento', $dataPagamentoKey)
                            ->first();

                        if ($existingPayment) {
                            $existingPayment->update([
                                'unidade_id' => (int) $data['unidade_id'],
                                'autor_id' => (int) $request->user()->id,
                                'competencia_mes' => (int) $dataPagamentoDate->month,
                                'competencia_ano' => (int) $dataPagamentoDate->year,
                                'valor' => $valor,
                                'descricao' => $descricao !== ''
                                    ? $descricao
                                    : ($tipoPagamento?->nome ?? 'Pagamento'),
                                'data_pagamento' => $dataPagamento,
                                'observacao' => $observacao,
                                'lancado_em' => now(),
                            ]);

                            $persisted = $existingPayment->refresh();
                        } else {
                            $persisted = Pagamento::query()->create([
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
                                'observacao' => $observacao,
                                'lancado_em' => now(),
                            ]);
                        }

                        if ($persisted) {
                            $createdItems[] = $persisted;
                        }
                    }

                    return $createdItems;
                })
                ->values();
        });

        $this->bumpPayrollCacheVersion();

        $webhookService->dispatch('payroll.batch.launched', [
            'mode' => 'typed',
            'created_count' => $created->count(),
            'requested_by' => [
                'id' => (int) $request->user()->id,
                'name' => (string) $request->user()->name,
                'email' => (string) $request->user()->email,
            ],
            'unidade_id' => (int) ($data['unidade_id'] ?? 0),
            'data_pagamento' => (string) ($data['data_pagamento'] ?? ''),
            'tipo_pagamento_ids' => array_values(array_map('intval', (array) ($data['tipo_pagamento_ids'] ?? []))),
            'generated_at' => now()->toISOString(),
        ]);

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
        [$inicio, $fim] = $this->resolveCompetenciaPeriod($request);
        $inicioKey = ((int) $inicio->year * 100) + (int) $inicio->month;
        $fimKey = ((int) $fim->year * 100) + (int) $fim->month;

        abort_if($unidadeId <= 0, 422, 'Informe uma unidade válida.');

        $base = $this->basePaymentsQueryForUser($request)
            ->where('unidade_id', $unidadeId)
            ->whereRaw('(competencia_ano * 100 + competencia_mes) BETWEEN ? AND ?', [$inicioKey, $fimKey]);

        $totalPagoPeriodo = (float) ((clone $base)->sum('valor'));
        $colaboradoresPagos = (clone $base)
            ->distinct('colaborador_id')
            ->count('colaborador_id');

        $totaisPorMes = (clone $base)
            ->selectRaw('competencia_ano, competencia_mes, SUM(valor) as total_valor, COUNT(*) as total_lancamentos')
            ->groupBy('competencia_ano', 'competencia_mes')
            ->get()
            ->keyBy(fn (Pagamento $pagamento): string => sprintf('%04d-%02d', (int) $pagamento->competencia_ano, (int) $pagamento->competencia_mes));

        $serieMensal = $this->buildMonthlySeries($inicio, $fim, $totaisPorMes);
        $mediaSalarialMes = count($serieMensal) > 0
            ? $totalPagoPeriodo / count($serieMensal)
            : 0.0;

        $distributionRanges = [
            ['label' => 'Até 2.000', 'min' => 0, 'max' => 2000],
            ['label' => '2.000 a 3.500', 'min' => 2000.01, 'max' => 3500],
            ['label' => '3.500 a 5.000', 'min' => 3500.01, 'max' => 5000],
            ['label' => 'Acima de 5.000', 'min' => 5000.01, 'max' => null],
        ];

        $values = (clone $base)->pluck('valor')->map(fn ($value) => (float) $value)->values();

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

        return response()->json([
            'unidade_id' => $unidadeId,
            'competencia_inicial' => $inicio->format('Y-m'),
            'competencia_final' => $fim->format('Y-m'),
            'total_pago_mes' => $totalPagoPeriodo,
            'total_pago_periodo' => $totalPagoPeriodo,
            'colaboradores_pagos' => $colaboradoresPagos,
            'media_salarial_mes' => $mediaSalarialMes,
            'distribuicao' => $distribuicao,
            'evolucao_mensal' => $serieMensal,
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

        [$inicio, $fim] = $this->resolveCompetenciaPeriod($request);
        $inicioKey = ((int) $inicio->year * 100) + (int) $inicio->month;
        $fimKey = ((int) $fim->year * 100) + (int) $fim->month;

        $historicoQuery = $this->basePaymentsQueryForUser($request)
            ->where('colaborador_id', $colaboradorId)
            ->whereRaw('(competencia_ano * 100 + competencia_mes) BETWEEN ? AND ?', [$inicioKey, $fimKey]);

        $historico = $historicoQuery
            ->orderBy('competencia_ano')
            ->orderBy('competencia_mes')
            ->get();

        $descontosPorMes = $this->buildReportDiscountsByMonth(
            $colaboradorId,
            $inicioKey,
            $fimKey,
        );

        $totaisPorMes = $historico
            ->groupBy(fn (Pagamento $pagamento): string => sprintf('%04d-%02d', (int) $pagamento->competencia_ano, (int) $pagamento->competencia_mes))
            ->map(function (Collection $pagamentos, string $monthKey) use ($descontosPorMes): array {
                $first = $pagamentos->first();
                $pagamentosMes = (float) $pagamentos->sum('valor');
                $pensoesMes = (float) $pagamentos->sum(
                    fn (Pagamento $pagamento): float => $this->extractPensaoTotalFromObservation($pagamento->observacao),
                );
                $descontosMes = (float) ($descontosPorMes[$monthKey] ?? 0);
                $totalMes = round($pagamentosMes + $pensoesMes + $descontosMes, 2);
                $lancadoEm = $pagamentos
                    ->filter(fn (Pagamento $pagamento): bool => $pagamento->lancado_em !== null)
                    ->max(fn (Pagamento $pagamento) => $pagamento->lancado_em?->timestamp ?? 0);

                return [
                    'competencia_ano' => (int) ($first?->competencia_ano ?? 0),
                    'competencia_mes' => (int) ($first?->competencia_mes ?? 0),
                    'total_pagamentos' => round($pagamentosMes, 2),
                    'total_pensoes' => round($pensoesMes, 2),
                    'total_descontos' => round($descontosMes, 2),
                    'total_valor' => $totalMes,
                    'total_lancamentos' => (int) $pagamentos->count(),
                    'lancado_em' => $lancadoEm !== null
                        ? now()->setTimestamp((int) $lancadoEm)->toISOString()
                        : null,
                ];
            })
            ->keyBy(fn (array $item): string => sprintf('%04d-%02d', $item['competencia_ano'], $item['competencia_mes']));

        $serieMensal = $this->buildMonthlySeries($inicio, $fim, $totaisPorMes);
        $timeline = collect($serieMensal)
            ->map(fn (array $item): array => [
                'competencia_mes' => (int) $item['competencia_mes'],
                'competencia_ano' => (int) $item['competencia_ano'],
                'competencia_label' => (string) $item['competencia_label'],
                'total_pagamentos' => (float) ($item['total_pagamentos'] ?? 0),
                'total_pensoes' => (float) ($item['total_pensoes'] ?? 0),
                'total_descontos' => (float) ($item['total_descontos'] ?? 0),
                'total_valor' => (float) ($item['total_valor'] ?? 0),
                'lancado_em' => $item['lancado_em'] ?? null,
                'total_lancamentos' => (int) ($item['total_lancamentos'] ?? 0),
            ])
            ->filter(fn (array $item): bool => (int) ($item['total_lancamentos'] ?? 0) > 0)
            ->values();

        $totalAcumulado = (float) $timeline->sum('total_valor');
        $totalPensoes = (float) $timeline->sum('total_pensoes');
        $totalDescontos = (float) $timeline->sum('total_descontos');
        $mediaSalarialMes = count($serieMensal) > 0
            ? $totalAcumulado / count($serieMensal)
            : 0.0;

        $variacao = collect($serieMensal)
            ->values()
            ->map(function (array $item, int $index) use ($serieMensal): array {
                $current = (float) $item['total_valor'];

                if ($index === 0) {
                    return [
                        'competencia_mes' => (int) $item['competencia_mes'],
                        'competencia_ano' => (int) $item['competencia_ano'],
                        'variacao_percentual' => null,
                    ];
                }

                $previous = (float) ($serieMensal[$index - 1]['total_valor'] ?? 0);

                if ($previous == 0.0) {
                    return [
                        'competencia_mes' => (int) $item['competencia_mes'],
                        'competencia_ano' => (int) $item['competencia_ano'],
                        'variacao_percentual' => null,
                    ];
                }

                $percentage = (($current - $previous) / $previous) * 100;

                return [
                    'competencia_mes' => (int) $item['competencia_mes'],
                    'competencia_ano' => (int) $item['competencia_ano'],
                    'variacao_percentual' => round($percentage, 2),
                ];
            })
            ->values();

        return response()->json([
            'colaborador' => $colaborador,
            'competencia_inicial' => $inicio->format('Y-m'),
            'competencia_final' => $fim->format('Y-m'),
            'timeline' => $timeline,
            'resumo_mensal' => $serieMensal,
            'total_acumulado' => $totalAcumulado,
            'total_pensoes' => $totalPensoes,
            'total_descontos' => $totalDescontos,
            'media_salarial' => $mediaSalarialMes,
            'variacao_percentual' => $variacao,
            'datas_importantes' => [
                'data_admissao' => $colaborador->data_admissao?->toDateString(),
                'data_demissao' => $colaborador->data_demissao?->toDateString(),
                'data_nascimento' => $colaborador->data_nascimento?->toDateString(),
            ],
        ]);
    }

    public function launchDiscountPreview(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $competenciaMes = (int) $request->integer('competencia_mes');
        $competenciaAno = (int) $request->integer('competencia_ano');
        $rows = collect((array) $request->input('rows', []));

        abort_if($competenciaMes < 1 || $competenciaMes > 12 || $competenciaAno < 2000, 422, 'Competência inválida.');
        abort_if($rows->isEmpty(), 422, 'Informe os colaboradores do lançamento.');

        $currentKey = ($competenciaAno * 100) + $competenciaMes;
        $collaboratorIds = $rows
            ->map(fn ($row) => (int) ($row['colaborador_id'] ?? 0))
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values();

        $launchPools = $rows
            ->mapWithKeys(function ($row): array {
                $id = (int) ($row['colaborador_id'] ?? 0);
                $totals = (array) ($row['categoria_totais'] ?? []);

                return [
                    $id => [
                        'salario' => (float) ($totals['salario'] ?? 0),
                        'beneficios' => (float) ($totals['beneficios'] ?? 0),
                        'extras' => (float) ($totals['extras'] ?? 0),
                    ],
                ];
            })
            ->toArray();

        $historicalPools = $this->loadHistoricalPoolsBeforeCompetencia($request, $collaboratorIds, $currentKey);

        $discounts = DescontoColaborador::query()
            ->whereIn('colaborador_id', $collaboratorIds)
            ->orderByRaw('COALESCE(data_referencia, created_at) asc')
            ->orderBy('id')
            ->get();

        $result = $collaboratorIds
            ->map(function (int $collaboratorId) use ($discounts, $historicalPools, $launchPools, $competenciaAno, $competenciaMes): array {
                $historyByMonth = $historicalPools[$collaboratorId] ?? [];
                $currentPools = $launchPools[$collaboratorId] ?? [
                    'salario' => 0.0,
                    'beneficios' => 0.0,
                    'extras' => 0.0,
                ];
                $collaboratorDiscounts = $discounts
                    ->where('colaborador_id', $collaboratorId)
                    ->values();

                $processed = $this->simulateDiscountsForCollaborator(
                    $collaboratorDiscounts,
                    $historyByMonth,
                    $currentPools,
                    $competenciaAno,
                    $competenciaMes,
                );

                $totalBruto = $currentPools['salario'] + $currentPools['beneficios'] + $currentPools['extras'];
                $totalDescontado = collect($processed)->sum('aplicado_no_mes');

                return [
                    'colaborador_id' => $collaboratorId,
                    'total_bruto' => round($totalBruto, 2),
                    'total_descontado' => round($totalDescontado, 2),
                    'total_liquido' => round(max($totalBruto - $totalDescontado, 0), 2),
                    'descontos' => $processed,
                ];
            })
            ->values();

        return response()->json([
            'competencia_mes' => $competenciaMes,
            'competencia_ano' => $competenciaAno,
            'data' => $result,
        ]);
    }

    private function resolveCompetenciaPeriod(Request $request): array
    {
        $initialRaw = trim((string) $request->string('competencia_inicial'));
        $finalRaw = trim((string) $request->string('competencia_final'));

        if ($initialRaw !== '' && preg_match('/^\d{4}-\d{2}$/', $initialRaw) === 1) {
            $inicio = CarbonImmutable::createFromFormat('Y-m', $initialRaw)->startOfMonth();
        } elseif ($request->filled('competencia_mes') && $request->filled('competencia_ano')) {
            $inicio = CarbonImmutable::create((int) $request->integer('competencia_ano'), (int) $request->integer('competencia_mes'), 1)->startOfMonth();
        } else {
            $inicio = CarbonImmutable::now()->startOfYear()->startOfMonth();
        }

        if ($finalRaw !== '' && preg_match('/^\d{4}-\d{2}$/', $finalRaw) === 1) {
            $fim = CarbonImmutable::createFromFormat('Y-m', $finalRaw)->startOfMonth();
        } elseif ($request->filled('competencia_mes') && $request->filled('competencia_ano')) {
            $fim = CarbonImmutable::create((int) $request->integer('competencia_ano'), (int) $request->integer('competencia_mes'), 1)->startOfMonth();
        } else {
            $fim = CarbonImmutable::now()->endOfYear()->startOfMonth();
        }

        if ($fim->lt($inicio)) {
            [$inicio, $fim] = [$fim, $inicio];
        }

        return [$inicio, $fim];
    }

    private function loadHistoricalPoolsBeforeCompetencia(Request $request, Collection $collaboratorIds, int $currentKey): array
    {
        if ($collaboratorIds->isEmpty()) {
            return [];
        }

        $rows = $this->basePaymentsQueryForUser($request)
            ->selectRaw('pagamentos.colaborador_id as colaborador_id')
            ->selectRaw('pagamentos.competencia_ano as competencia_ano')
            ->selectRaw('pagamentos.competencia_mes as competencia_mes')
            ->selectRaw('tipos_pagamento.categoria as categoria')
            ->selectRaw('SUM(pagamentos.valor) as total_valor')
            ->join('tipos_pagamento', 'tipos_pagamento.id', '=', 'pagamentos.tipo_pagamento_id')
            ->whereIn('pagamentos.colaborador_id', $collaboratorIds)
            ->whereRaw('(pagamentos.competencia_ano * 100 + pagamentos.competencia_mes) < ?', [$currentKey])
            ->whereIn('tipos_pagamento.categoria', ['salario', 'beneficios', 'extras'])
            ->groupBy('pagamentos.colaborador_id', 'pagamentos.competencia_ano', 'pagamentos.competencia_mes', 'tipos_pagamento.categoria')
            ->get();

        $result = [];

        foreach ($rows as $row) {
            $collaboratorId = (int) $row->colaborador_id;
            $monthKey = ((int) $row->competencia_ano * 100) + (int) $row->competencia_mes;
            $category = (string) $row->categoria;
            $value = (float) ($row->total_valor ?? 0);

            if (! isset($result[$collaboratorId])) {
                $result[$collaboratorId] = [];
            }

            if (! isset($result[$collaboratorId][$monthKey])) {
                $result[$collaboratorId][$monthKey] = [
                    'salario' => 0.0,
                    'beneficios' => 0.0,
                    'extras' => 0.0,
                ];
            }

            $result[$collaboratorId][$monthKey][$category] = $value;
        }

        return $result;
    }

    private function simulateDiscountsForCollaborator(Collection $discounts, array $historyByMonth, array $currentPools, int $competenciaAno, int $competenciaMes): array
    {
        $availableByMonth = [];

        foreach ($historyByMonth as $monthKey => $pool) {
            $availableByMonth[(int) $monthKey] = [
                'salario' => (float) ($pool['salario'] ?? 0),
                'beneficios' => (float) ($pool['beneficios'] ?? 0),
                'extras' => (float) ($pool['extras'] ?? 0),
            ];
        }

        ksort($availableByMonth);

        $currentAvailable = [
            'salario' => (float) ($currentPools['salario'] ?? 0),
            'beneficios' => (float) ($currentPools['beneficios'] ?? 0),
            'extras' => (float) ($currentPools['extras'] ?? 0),
        ];

        $currentKey = ($competenciaAno * 100) + $competenciaMes;
        $processed = [];

        foreach ($discounts as $discount) {
            $discountTotal = (float) $discount->valor;
            $appliedNow = 0.0;
            $categories = $this->resolveDiscountCategories(
                (string) $discount->tipo_saida,
                $discount->tipo_saida_prioridades,
            );
            $startKey = $discount->data_referencia
                ? (((int) $discount->data_referencia->year * 100) + (int) $discount->data_referencia->month)
                : 0;
            $createdAtKey = $discount->created_at
                ? (((int) $discount->created_at->year * 100) + (int) $discount->created_at->month)
                : $currentKey;
            $effectiveStartKey = $startKey > 0
                ? $startKey
                : $createdAtKey;
            $dueByMonth = $this->buildDiscountDueScheduleUpToCurrent($discount, $discountTotal, $effectiveStartKey, $currentKey);

            $openBalance = 0.0;
            $appliedUpToCurrent = 0.0;
            $iterKey = $effectiveStartKey;

            while ($iterKey <= $currentKey) {
                $openBalance += (float) ($dueByMonth[$iterKey] ?? 0);

                if ($openBalance <= 0) {
                    $iterKey = $this->addMonthsToCompetenciaKey($iterKey, 1);

                    continue;
                }

                $isCurrentMonth = $iterKey === $currentKey;

                if (! $isCurrentMonth && ! isset($availableByMonth[$iterKey])) {
                    $availableByMonth[$iterKey] = [
                        'salario' => 0.0,
                        'beneficios' => 0.0,
                        'extras' => 0.0,
                    ];
                }

                foreach ($categories as $category) {
                    if ($openBalance <= 0) {
                        break;
                    }

                    $available = $isCurrentMonth
                        ? (float) ($currentAvailable[$category] ?? 0)
                        : (float) ($availableByMonth[$iterKey][$category] ?? 0);

                    if ($available <= 0) {
                        continue;
                    }

                    $consume = min($openBalance, $available);

                    if ($isCurrentMonth) {
                        $currentAvailable[$category] = max($available - $consume, 0);
                        $appliedNow += $consume;
                    } else {
                        $availableByMonth[$iterKey][$category] = max($available - $consume, 0);
                    }

                    $openBalance -= $consume;
                    $appliedUpToCurrent += $consume;
                }

                $iterKey = $this->addMonthsToCompetenciaKey($iterKey, 1);
            }

            $overallRemaining = max($discountTotal - $appliedUpToCurrent, 0);

            $processed[] = [
                'id' => (int) $discount->id,
                'descricao' => (string) $discount->descricao,
                'tipo_saida' => (string) $discount->tipo_saida,
                'tipo_saida_prioridades' => $categories,
                'aplicado_no_mes' => round($appliedNow, 2),
                'saldo_restante' => round($overallRemaining, 2),
            ];
        }

        return $processed;
    }

    private function buildDiscountDueScheduleUpToCurrent($discount, float $discountTotal, int $startKey, int $currentKey): array
    {
        if ($currentKey < $startKey) {
            return [];
        }

        $isInstallment = (bool) $discount->parcelado && (int) ($discount->total_parcelas ?? 0) > 1;

        if (! $isInstallment) {
            return [
                $startKey => $discountTotal,
            ];
        }

        $totalInstallments = max(1, (int) ($discount->total_parcelas ?? 1));
        $plan = $this->buildInstallmentPlan($discountTotal, $totalInstallments);
        $schedule = [];

        foreach ($plan as $index => $amount) {
            $monthKey = $this->addMonthsToCompetenciaKey($startKey, $index);

            if ($monthKey > $currentKey) {
                break;
            }

            $schedule[$monthKey] = (float) $amount;
        }

        return $schedule;
    }

    private function buildInstallmentPlan(float $total, int $installments): array
    {
        $safeInstallments = max(1, $installments);
        $base = round($total / $safeInstallments, 2);
        $plan = array_fill(0, $safeInstallments, $base);
        $difference = round($total - array_sum($plan), 2);

        if ($safeInstallments > 0) {
            $plan[$safeInstallments - 1] = round($plan[$safeInstallments - 1] + $difference, 2);
        }

        return $plan;
    }

    private function addMonthsToCompetenciaKey(int $key, int $monthsToAdd): int
    {
        $year = intdiv($key, 100);
        $month = $key % 100;
        $zeroBased = ($year * 12) + max($month - 1, 0) + $monthsToAdd;

        $targetYear = intdiv($zeroBased, 12);
        $targetMonth = ($zeroBased % 12) + 1;

        return ($targetYear * 100) + $targetMonth;
    }

    private function resolveDiscountCategories(string $tipoSaida, mixed $prioritiesRaw = null): array
    {
        $priorities = collect(is_array($prioritiesRaw) ? $prioritiesRaw : [])
            ->map(fn ($item) => (string) $item)
            ->filter(fn ($item) => in_array($item, ['salario', 'beneficios', 'extras'], true))
            ->unique()
            ->values()
            ->all();

        if (count($priorities) > 0) {
            return $priorities;
        }

        if ($tipoSaida === 'direto') {
            return ['salario', 'beneficios', 'extras'];
        }

        if ($tipoSaida === 'salario') {
            return ['salario'];
        }

        if ($tipoSaida === 'beneficios') {
            return ['beneficios'];
        }

        return ['extras'];
    }

    private function extractPensaoTotalFromObservation(?string $observacao): float
    {
        if (! is_string($observacao) || trim($observacao) === '') {
            return 0.0;
        }

        $decoded = json_decode($observacao, true);

        if (! is_array($decoded)) {
            return 0.0;
        }

        $pensoes = $decoded['pensoes'] ?? null;

        if (! is_array($pensoes)) {
            return 0.0;
        }

        return round(
            collect($pensoes)
                ->sum(fn ($item): float => (float) (is_array($item) ? ($item['valor'] ?? 0) : 0)),
            2,
        );
    }

    private function buildReportDiscountsByMonth(int $colaboradorId, int $inicioKey, int $fimKey): array
    {
        $totals = [];

        $discounts = DescontoColaborador::query()
            ->select([
                'id',
                'valor',
                'parcelado',
                'total_parcelas',
                'data_referencia',
                'created_at',
            ])
            ->where('colaborador_id', $colaboradorId)
            ->get();

        foreach ($discounts as $discount) {
            $startKey = $discount->data_referencia
                ? (((int) $discount->data_referencia->year * 100) + (int) $discount->data_referencia->month)
                : ($discount->created_at
                    ? (((int) $discount->created_at->year * 100) + (int) $discount->created_at->month)
                    : 0);

            if ($startKey <= 0) {
                continue;
            }

            $schedule = $this->buildDiscountDueScheduleUpToCurrent(
                $discount,
                (float) $discount->valor,
                $startKey,
                $fimKey,
            );

            foreach ($schedule as $monthKey => $amount) {
                $intMonthKey = (int) $monthKey;

                if ($intMonthKey < $inicioKey || $intMonthKey > $fimKey) {
                    continue;
                }

                $label = sprintf('%04d-%02d', intdiv($intMonthKey, 100), $intMonthKey % 100);
                $totals[$label] = round(((float) ($totals[$label] ?? 0)) + (float) $amount, 2);
            }
        }

        $loans = EmprestimoColaborador::query()
            ->select([
                'valor_parcela',
                'total_parcelas',
                'parcelas_pagas',
                'data_inicio',
                'created_at',
                'ativo',
            ])
            ->where('colaborador_id', $colaboradorId)
            ->where('ativo', true)
            ->get();

        foreach ($loans as $loan) {
            $baseDate = $loan->data_inicio ?? $loan->created_at;

            if (! $baseDate) {
                continue;
            }

            $startKey = ((int) $baseDate->year * 100) + (int) $baseDate->month;
            $totalInstallments = max(1, (int) ($loan->total_parcelas ?? 1));
            $paidInstallments = max(0, min((int) ($loan->parcelas_pagas ?? 0), $totalInstallments));
            $remainingInstallments = max($totalInstallments - $paidInstallments, 0);
            $installmentValue = (float) ($loan->valor_parcela ?? 0);

            if ($installmentValue <= 0 || $remainingInstallments <= 0) {
                continue;
            }

            for ($index = 0; $index < $remainingInstallments; $index++) {
                $monthKey = $this->addMonthsToCompetenciaKey($startKey, $index);

                if ($monthKey < $inicioKey) {
                    continue;
                }

                if ($monthKey > $fimKey) {
                    break;
                }

                $label = sprintf('%04d-%02d', intdiv($monthKey, 100), $monthKey % 100);
                $totals[$label] = round(((float) ($totals[$label] ?? 0)) + $installmentValue, 2);
            }
        }

        return $totals;
    }

    private function buildMonthlySeries(CarbonImmutable $inicio, CarbonImmutable $fim, $totaisPorMes): array
    {
        $series = [];
        $cursor = $inicio;

        while ($cursor->lte($fim)) {
            $key = $cursor->format('Y-m');
            $raw = $totaisPorMes->get($key);

            $totalValor = is_array($raw)
                ? (float) ($raw['total_valor'] ?? 0)
                : (float) ($raw?->total_valor ?? 0);

            $totalLancamentos = is_array($raw)
                ? (int) ($raw['total_lancamentos'] ?? 0)
                : (int) ($raw?->total_lancamentos ?? 0);

            $totalPagamentos = is_array($raw)
                ? (float) ($raw['total_pagamentos'] ?? 0)
                : (float) ($raw?->total_pagamentos ?? 0);

            $totalPensoes = is_array($raw)
                ? (float) ($raw['total_pensoes'] ?? 0)
                : (float) ($raw?->total_pensoes ?? 0);

            $totalDescontos = is_array($raw)
                ? (float) ($raw['total_descontos'] ?? 0)
                : (float) ($raw?->total_descontos ?? 0);

            $lancadoEm = is_array($raw)
                ? ($raw['lancado_em'] ?? null)
                : ($raw?->lancado_em ?? null);

            $series[] = [
                'competencia_ano' => (int) $cursor->year,
                'competencia_mes' => (int) $cursor->month,
                'competencia_label' => $cursor->locale('pt_BR')->translatedFormat('M/y'),
                'total_valor' => $totalValor,
                'total_lancamentos' => $totalLancamentos,
                'total_pagamentos' => $totalPagamentos,
                'total_pensoes' => $totalPensoes,
                'total_descontos' => $totalDescontos,
                'lancado_em' => $lancadoEm,
            ];

            $cursor = $cursor->addMonth();
        }

        return $series;
    }

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $perPage = min(max((int) $request->integer('per_page', 15), 1), 500);

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

    public function exportXlsx(Request $request): StreamedResponse|JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $mes = (int) $request->integer('competencia_mes', (int) now()->month);
        $ano = (int) $request->integer('competencia_ano', (int) now()->year);

        if ($request->boolean('async')) {
            $export = AsyncExport::query()->create([
                'user_id' => (int) $request->user()->id,
                'type' => 'payroll_xlsx',
                'status' => 'queued',
                'filters' => [
                    'competencia_mes' => $mes,
                    'competencia_ano' => $ano,
                ],
            ]);
            $operation = AsyncOperationTracker::ensureForExport($export, 'Exportação de pagamentos enfileirada');

            GeneratePayrollExportJob::dispatch($export->id);

            return response()->json([
                'message' => 'Exportação enfileirada com sucesso.',
                'export_id' => $export->id,
                'operation_id' => $operation->id,
                'status' => $export->status,
            ], 202);
        }

        $query = $this->basePaymentsQueryForUser($request)
            ->with([
                'colaborador:id,nome',
                'tipoPagamento:id,nome',
            ])
            ->where('competencia_mes', $mes)
            ->where('competencia_ano', $ano)
            ->latest('lancado_em')
            ->latest('id');

        $rows = $query->get();
        $fallbackTypeNames = TipoPagamento::query()
            ->withoutGlobalScopes()
            ->whereIn(
                'id',
                $rows
                    ->pluck('tipo_pagamento_id')
                    ->filter(fn ($id) => $id !== null)
                    ->map(fn ($id) => (int) $id)
                    ->unique()
                    ->values()
                    ->all(),
            )
            ->pluck('nome', 'id');

        $grouped = [];

        foreach ($rows as $row) {
            $colaboradorId = (int) ($row->colaborador_id ?? 0);
            $name = trim((string) ($row->colaborador?->nome ?? 'Sem nome'));
            $key = $colaboradorId > 0 ? (string) $colaboradorId : $name;

            if (! isset($grouped[$key])) {
                $grouped[$key] = [
                    'nome' => $name,
                    'vr' => 0.0,
                    'va' => 0.0,
                ];
            }

            $typeName = (string) (
                $row->tipoPagamento?->nome
                ?? $fallbackTypeNames->get((int) ($row->tipo_pagamento_id ?? 0), '')
            );
            $normalizedType = $this->normalizePaymentName($typeName);
            $value = (float) $row->valor;

            if ($this->containsAny($normalizedType, ['vale refeicao', 'vr'])) {
                $grouped[$key]['vr'] += $value;

                continue;
            }

            if ($this->containsAny($normalizedType, ['premio media', 'cesta basica', 'cb', 'va'])) {
                $grouped[$key]['va'] += $value;
            }
        }

        $summaryRows = collect(array_values($grouped))
            ->sortBy('nome', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $totalVr = (float) $summaryRows->sum('vr');
        $totalVa = (float) $summaryRows->sum('va');
        $periodLabel = $this->formatMonthYearLabel($mes, $ano);

        $fileName = sprintf(
            'resumo_vr_va_%04d_%02d.xlsx',
            $ano,
            $mes,
        );

        return response()->streamDownload(function () use ($summaryRows, $totalVr, $totalVa, $periodLabel): void {
            $spreadsheet = new Spreadsheet;
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Resumo VR VA');

            $sheet->setCellValue('A1', 'Resumo VR/VA - '.$periodLabel);
            $sheet->mergeCells('A1:C1');

            $sheet->fromArray(['Nome', 'VR', 'VA'], null, 'A3');

            $line = 4;
            foreach ($summaryRows as $row) {
                $sheet->fromArray([
                    $row['nome'],
                    (float) $row['vr'],
                    (float) $row['va'],
                ], null, 'A'.$line);

                $line++;
            }

            $sheet->fromArray(['TOTAL', $totalVr, $totalVa], null, 'A'.$line);
            $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(13);
            $sheet->getStyle('A3:C3')->getFont()->setBold(true);
            $sheet->getStyle('A'.$line.':C'.$line)->getFont()->setBold(true);
            $sheet->getStyle('B4:C'.$line)->getNumberFormat()->setFormatCode('#,##0.00');

            foreach (range('A', 'C') as $column) {
                $sheet->getColumnDimension($column)->setAutoSize(true);
            }

            $writer = new Xlsx($spreadsheet);
            $writer->save('php://output');
            $spreadsheet->disconnectWorksheets();
            unset($spreadsheet);
        }, $fileName, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    public function exportBenefitsXlsx(Request $request): StreamedResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $validated = $request->validate([
            'pagamento_ids' => ['required', 'string'],
        ]);

        $paymentIds = collect(explode(',', (string) $validated['pagamento_ids']))
            ->map(fn ($value) => (int) trim($value))
            ->filter(fn ($value) => $value > 0)
            ->unique()
            ->values();

        abort_if($paymentIds->isEmpty(), 422, 'Informe pelo menos um pagamento para exportação.');

        $rows = $this->basePaymentsQueryForUser($request)
            ->with([
                'colaborador:id,nome',
                'tipoPagamento:id,nome',
            ])
            ->whereIn('id', $paymentIds->all())
            ->orderBy('colaborador_id')
            ->orderBy('id')
            ->get();

        abort_if($rows->isEmpty(), 404, 'Pagamentos não encontrados para exportação.');

        $fallbackTypeNames = TipoPagamento::query()
            ->withoutGlobalScopes()
            ->whereIn(
                'id',
                $rows
                    ->pluck('tipo_pagamento_id')
                    ->filter(fn ($id) => $id !== null)
                    ->map(fn ($id) => (int) $id)
                    ->unique()
                    ->values()
                    ->all(),
            )
            ->pluck('nome', 'id');

        $grouped = [];

        foreach ($rows as $row) {
            $colaboradorId = (int) ($row->colaborador_id ?? 0);
            $name = trim((string) ($row->colaborador?->nome ?? 'Sem nome'));
            $key = $colaboradorId > 0 ? (string) $colaboradorId : $name;

            if (! isset($grouped[$key])) {
                $grouped[$key] = [
                    'nome' => $name,
                    'vr' => 0.0,
                    'va' => 0.0,
                ];
            }

            $typeName = (string) (
                $row->tipoPagamento?->nome
                ?? $fallbackTypeNames->get((int) ($row->tipo_pagamento_id ?? 0), '')
            );

            $normalizedType = $this->normalizePaymentName($typeName);
            $value = (float) $row->valor;

            if ($this->containsAny($normalizedType, ['vale refeicao', 'vr'])) {
                $grouped[$key]['vr'] += $value;
                continue;
            }

            if ($this->containsAny($normalizedType, ['vale transporte', 'vt'])) {
                $grouped[$key]['va'] += $value;
                continue;
            }

            if ($this->containsAny($normalizedType, ['cesta basica', 'cb'])) {
                $grouped[$key]['va'] += $value;
            }
        }

        $summaryRows = collect(array_values($grouped))
            ->sortBy('nome', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $totalVr = (float) $summaryRows->sum('vr');
        $totalVa = (float) $summaryRows->sum('va');
        $firstPayment = $rows->first();
        $periodLabel = sprintf(
            '%02d/%04d',
            (int) ($firstPayment?->competencia_mes ?? now()->month),
            (int) ($firstPayment?->competencia_ano ?? now()->year),
        );

        $fileName = sprintf('beneficios_lancamento_%s.xlsx', now()->format('Ymd_His'));

        return response()->streamDownload(function () use ($summaryRows, $totalVr, $totalVa, $periodLabel): void {
            $spreadsheet = new Spreadsheet;
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Benefícios VR VA');

            $sheet->setCellValue('A1', 'Benefícios por lançamento (VR/VA) - '.$periodLabel);
            $sheet->mergeCells('A1:D1');

            $sheet->fromArray(['Nome', 'VR', 'VA', 'Total Benefícios'], null, 'A3');

            $line = 4;
            foreach ($summaryRows as $row) {
                $totalBenefits = (float) $row['vr'] + (float) $row['va'];

                $sheet->fromArray([
                    $row['nome'],
                    (float) $row['vr'],
                    (float) $row['va'],
                    $totalBenefits,
                ], null, 'A'.$line);

                $line++;
            }

            $sheet->fromArray([
                'TOTAL',
                $totalVr,
                $totalVa,
                $totalVr + $totalVa,
            ], null, 'A'.$line);

            $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(13);
            $sheet->getStyle('A3:D3')->getFont()->setBold(true);
            $sheet->getStyle('A'.$line.':D'.$line)->getFont()->setBold(true);
            $sheet->getStyle('B4:D'.$line)->getNumberFormat()->setFormatCode('#,##0.00');

            foreach (range('A', 'D') as $column) {
                $sheet->getColumnDimension($column)->setAutoSize(true);
            }

            $writer = new Xlsx($spreadsheet);
            $writer->save('php://output');
            $spreadsheet->disconnectWorksheets();
            unset($spreadsheet);
        }, $fileName, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
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

        $this->bumpPayrollCacheVersion();

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

        $this->bumpPayrollCacheVersion();

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

        $pagamento->delete();

        $this->bumpPayrollCacheVersion();

        return response()->json([], 204);
    }

    private function basePaymentsQueryForUser(Request $request): Builder
    {
        $query = Pagamento::query();
        $user = $request->user();

        if (! $user?->isMasterAdmin()) {
            $query->where('autor_id', $user->id);
        }

        if ($user?->dataScopeFor('payroll') === 'units') {
            $query->whereIn('unidade_id', $user->allowedUnitIdsFor('payroll') ?: [0]);
        }

        return $query;
    }

    private function payrollCacheVersion(): int
    {
        return TransportCache::version('payroll');
    }

    private function bumpPayrollCacheVersion(): void
    {
        TransportCache::bumpMany(['payroll', 'home']);
    }

    private function normalizePaymentName(string $value): string
    {
        $lower = mb_strtolower($value, 'UTF-8');
        $ascii = Str::ascii($lower);
        $sanitized = preg_replace('/[^a-z0-9\s]/', ' ', $ascii) ?? $ascii;

        return trim(preg_replace('/\s+/', ' ', $sanitized) ?? $sanitized);
    }

    /**
     * @param  array<int, string>  $terms
     */
    private function containsAny(string $subject, array $terms): bool
    {
        foreach ($terms as $term) {
            if (str_contains($subject, $this->normalizePaymentName($term))) {
                return true;
            }
        }

        return false;
    }

    private function formatMonthYearLabel(int $month, int $year): string
    {
        $months = [
            1 => 'Janeiro',
            2 => 'Fevereiro',
            3 => 'Março',
            4 => 'Abril',
            5 => 'Maio',
            6 => 'Junho',
            7 => 'Julho',
            8 => 'Agosto',
            9 => 'Setembro',
            10 => 'Outubro',
            11 => 'Novembro',
            12 => 'Dezembro',
        ];

        return sprintf('%s/%02d', $months[$month] ?? (string) $month, $year % 100);
    }
}
