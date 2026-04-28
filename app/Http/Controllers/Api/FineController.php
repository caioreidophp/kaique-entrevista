<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMultaRequest;
use App\Http\Requests\UpdateMultaRequest;
use App\Models\Colaborador;
use App\Models\Multa;
use App\Models\MultaInfracao;
use App\Models\MultaOrgaoAutuador;
use App\Models\PlacaFrota;
use App\Models\Unidade;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FineController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->hasPermission('fines.dashboard.view'), 403);

        $validated = $request->validate([
            'data_inicio' => ['nullable', 'date_format:Y-m-d'],
            'data_fim' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:data_inicio'],
            'unidade_id' => ['nullable', 'integer', 'exists:unidades,id'],
        ]);

        $start = CarbonImmutable::parse((string) ($validated['data_inicio'] ?? now()->startOfMonth()->toDateString()));
        $end = CarbonImmutable::parse((string) ($validated['data_fim'] ?? now()->endOfMonth()->toDateString()));

        if ($end->lt($start)) {
            [$start, $end] = [$end, $start];
        }

        $unidadeId = isset($validated['unidade_id']) ? (int) $validated['unidade_id'] : null;
        $allowedUnitIds = $this->allowedUnitIds($request);

        if ($unidadeId !== null) {
            abort_unless($user?->canAccessUnit('fines', $unidadeId), 403);
        }

        $baseQuery = Multa::query()
            ->where('multas.tipo_registro', 'multa')
            ->whereDate('multas.data', '>=', $start->toDateString())
            ->whereDate('multas.data', '<=', $end->toDateString())
            ->when(
                $user?->dataScopeFor('fines') === 'units',
                fn ($query) => $query->whereIn('multas.unidade_id', $allowedUnitIds !== [] ? $allowedUnitIds : [0]),
            )
            ->when($unidadeId, fn ($query) => $query->where('multas.unidade_id', $unidadeId));

        $totalQuantidade = (clone $baseQuery)->count();
        $totalValor = (float) ((clone $baseQuery)->sum('multas.valor'));
        $valorMedio = $totalQuantidade > 0
            ? round($totalValor / $totalQuantidade, 2)
            : 0.0;
        $today = CarbonImmutable::today()->toDateString();

        $statusSummaryRows = (clone $baseQuery)
            ->selectRaw('multas.status as label, COUNT(*) as quantidade, COALESCE(SUM(multas.valor), 0) as valor_total')
            ->groupBy('multas.status')
            ->get();

        $statusSummary = collect($this->normalizeChartRows($statusSummaryRows, 'Nao informado'))
            ->keyBy('label');

        $overdueOpenRows = (clone $baseQuery)
            ->whereDate('multas.vencimento', '<', $today)
            ->where('multas.status', '!=', 'pago')
            ->get(['multas.id', 'multas.valor']);

        $porInfracao = (clone $baseQuery)
            ->leftJoin('multa_infracoes as infracoes', 'infracoes.id', '=', 'multas.multa_infracao_id')
            ->selectRaw('infracoes.nome as label, COUNT(*) as quantidade, COALESCE(SUM(multas.valor), 0) as valor_total')
            ->groupBy('infracoes.nome')
            ->orderByDesc('quantidade')
            ->get();

        $porCulpa = (clone $baseQuery)
            ->selectRaw('multas.culpa as label, COUNT(*) as quantidade, COALESCE(SUM(multas.valor), 0) as valor_total')
            ->groupBy('multas.culpa')
            ->orderByDesc('quantidade')
            ->get();

        $porTipoValor = (clone $baseQuery)
            ->selectRaw('multas.tipo_valor as label, COUNT(*) as quantidade, COALESCE(SUM(multas.valor), 0) as valor_total')
            ->groupBy('multas.tipo_valor')
            ->orderByDesc('quantidade')
            ->get();

        $porStatus = (clone $baseQuery)
            ->selectRaw('multas.status as label, COUNT(*) as quantidade, COALESCE(SUM(multas.valor), 0) as valor_total')
            ->groupBy('multas.status')
            ->orderByDesc('quantidade')
            ->get();

        $porPlaca = (clone $baseQuery)
            ->leftJoin('placas_frota as placas', 'placas.id', '=', 'multas.placa_frota_id')
            ->selectRaw('placas.placa as label, COUNT(*) as quantidade, COALESCE(SUM(multas.valor), 0) as valor_total')
            ->groupBy('placas.placa')
            ->orderByDesc('quantidade')
            ->limit(12)
            ->get();

        $porMotorista = (clone $baseQuery)
            ->leftJoin('colaboradores as colaboradores', 'colaboradores.id', '=', 'multas.colaborador_id')
            ->selectRaw('colaboradores.nome as label, COUNT(*) as quantidade, COALESCE(SUM(multas.valor), 0) as valor_total')
            ->groupBy('colaboradores.nome')
            ->orderByDesc('quantidade')
            ->limit(12)
            ->get();

        $topUnidades = (clone $baseQuery)
            ->leftJoin('unidades', 'unidades.id', '=', 'multas.unidade_id')
            ->selectRaw('unidades.nome as label, COUNT(*) as quantidade, COALESCE(SUM(multas.valor), 0) as valor_total')
            ->groupBy('unidades.nome')
            ->orderByDesc('valor_total')
            ->limit(8)
            ->get();

        $topPlaca = $this->topChartRow($porPlaca);
        $topMotorista = $this->topChartRow($porMotorista);
        $alerts = [];

        if ($overdueOpenRows->count() > 0) {
            $alerts[] = [
                'level' => 'warning',
                'title' => 'Multas vencidas em aberto',
                'detail' => sprintf(
                    '%d registro(s) somando R$ %s.',
                    $overdueOpenRows->count(),
                    number_format((float) $overdueOpenRows->sum('valor'), 2, ',', '.'),
                ),
            ];
        }

        if ($topMotorista !== null && (int) $topMotorista['quantidade'] >= 3) {
            $alerts[] = [
                'level' => 'info',
                'title' => 'Recorrencia por motorista',
                'detail' => "{$topMotorista['label']} concentra {$topMotorista['quantidade']} registro(s) no periodo.",
            ];
        }

        return response()->json([
            'filters' => [
                'data_inicio' => $start->toDateString(),
                'data_fim' => $end->toDateString(),
                'unidade_id' => $unidadeId,
            ],
            'unidades' => Unidade::query()
                ->when(
                    $user?->dataScopeFor('fines') === 'units',
                    fn ($query) => $query->whereIn('id', $allowedUnitIds !== [] ? $allowedUnitIds : [0]),
                )
                ->orderBy('nome')
                ->get(['id', 'nome']),
            'totals' => [
                'quantidade' => $totalQuantidade,
                'valor' => round($totalValor, 2),
                'valor_medio' => $valorMedio,
                'vencidas_em_aberto' => [
                    'quantidade' => $overdueOpenRows->count(),
                    'valor' => round((float) $overdueOpenRows->sum('valor'), 2),
                ],
                'status_summary' => [
                    'aguardando_motorista' => [
                        'quantidade' => (int) (($statusSummary['aguardando_motorista']['quantidade'] ?? 0)),
                        'valor' => round((float) ($statusSummary['aguardando_motorista']['valor_total'] ?? 0), 2),
                    ],
                    'solicitado_boleto' => [
                        'quantidade' => (int) (($statusSummary['solicitado_boleto']['quantidade'] ?? 0)),
                        'valor' => round((float) ($statusSummary['solicitado_boleto']['valor_total'] ?? 0), 2),
                    ],
                    'boleto_ok' => [
                        'quantidade' => (int) (($statusSummary['boleto_ok']['quantidade'] ?? 0)),
                        'valor' => round((float) ($statusSummary['boleto_ok']['valor_total'] ?? 0), 2),
                    ],
                    'pago' => [
                        'quantidade' => (int) (($statusSummary['pago']['quantidade'] ?? 0)),
                        'valor' => round((float) ($statusSummary['pago']['valor_total'] ?? 0), 2),
                    ],
                ],
                'top_placa' => $topPlaca,
                'top_motorista' => $topMotorista,
                'top_unidades' => $this->normalizeChartRows($topUnidades, 'Sem unidade'),
            ],
            'charts' => [
                'infracao' => $this->normalizeChartRows($porInfracao, 'Sem infração'),
                'culpa' => $this->normalizeChartRows($porCulpa, 'Não informado'),
                'tipo_valor' => $this->normalizeChartRows($porTipoValor, 'Não informado'),
                'status' => $this->normalizeChartRows($porStatus, 'Não informado'),
                'placa' => $this->normalizeChartRows($porPlaca, 'Sem placa'),
                'motorista' => $this->normalizeChartRows($porMotorista, 'Sem motorista'),
            ],
            'alerts' => $alerts,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->hasPermission('fines.list.view'), 403);

        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'sort_by' => [
                'nullable',
                Rule::in([
                    'id',
                    'data',
                    'hora',
                    'placa',
                    'infracao',
                    'descricao',
                    'numero_auto_infracao',
                    'orgao',
                    'motorista',
                    'indicado_condutor',
                    'culpa',
                    'valor',
                    'tipo_valor',
                    'vencimento',
                    'status',
                    'descontar',
                ]),
            ],
            'sort_direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'tipo_registro' => ['nullable', Rule::in(['multa', 'notificacao'])],
            'data_inicio' => ['nullable', 'date_format:Y-m-d'],
            'data_fim' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:data_inicio'],
            'unidade_id' => ['nullable', 'integer', 'exists:unidades,id'],
            'placa_frota_id' => ['nullable', 'integer', 'exists:placas_frota,id'],
            'colaborador_id' => ['nullable', 'integer', 'exists:colaboradores,id'],
            'multa_infracao_id' => ['nullable', 'integer', 'exists:multa_infracoes,id'],
            'multa_orgao_autuador_id' => ['nullable', 'integer', 'exists:multa_orgaos_autuadores,id'],
            'culpa' => ['nullable', Rule::in(['empresa', 'motorista'])],
            'status' => ['nullable', Rule::in(['aguardando_motorista', 'solicitado_boleto', 'boleto_ok', 'pago'])],
            'search' => ['nullable', 'string', 'max:120'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 20);
        $sortBy = (string) ($validated['sort_by'] ?? 'data');
        $sortDirection = (string) ($validated['sort_direction'] ?? 'desc');
        $tipoRegistro = (string) ($validated['tipo_registro'] ?? 'multa');
        $allowedUnitIds = $this->allowedUnitIds($request);

        $query = Multa::query()
            ->select('multas.*')
            ->with([
                'unidade:id,nome',
                'placaFrota:id,placa,unidade_id',
                'infracao:id,nome',
                'orgaoAutuador:id,nome',
                'colaborador:id,nome,unidade_id',
            ]);

        if ($user?->dataScopeFor('fines') === 'units') {
            $query->whereIn('multas.unidade_id', $allowedUnitIds !== [] ? $allowedUnitIds : [0]);
        }

        if (! empty($validated['data_inicio'])) {
            $query->whereDate('multas.data', '>=', (string) $validated['data_inicio']);
        }

        if (! empty($validated['data_fim'])) {
            $query->whereDate('multas.data', '<=', (string) $validated['data_fim']);
        }

        $query->where('multas.tipo_registro', $tipoRegistro);

        if (! empty($validated['unidade_id'])) {
            abort_unless($user?->canAccessUnit('fines', (int) $validated['unidade_id']), 403);
            $query->where('multas.unidade_id', (int) $validated['unidade_id']);
        }

        if (! empty($validated['placa_frota_id'])) {
            $query->where('multas.placa_frota_id', (int) $validated['placa_frota_id']);
        }

        if (! empty($validated['colaborador_id'])) {
            $query->where('multas.colaborador_id', (int) $validated['colaborador_id']);
        }

        if (! empty($validated['multa_infracao_id'])) {
            $query->where('multas.multa_infracao_id', (int) $validated['multa_infracao_id']);
        }

        if (! empty($validated['multa_orgao_autuador_id'])) {
            $query->where('multas.multa_orgao_autuador_id', (int) $validated['multa_orgao_autuador_id']);
        }

        if (! empty($validated['culpa'])) {
            $query->where('multas.culpa', (string) $validated['culpa']);
        }

        if (! empty($validated['status'])) {
            $query->where('multas.status', (string) $validated['status']);
        }

        if (! empty($validated['search'])) {
            $search = trim((string) $validated['search']);

            $query->where(function ($subQuery) use ($search): void {
                $subQuery
                    ->where('multas.numero_auto_infracao', 'like', '%'.$search.'%')
                    ->orWhere('multas.descricao', 'like', '%'.$search.'%');
            });
        }

        switch ($sortBy) {
            case 'placa':
                $query->leftJoin('placas_frota as placas_sort', 'placas_sort.id', '=', 'multas.placa_frota_id');
                $query->orderBy('placas_sort.placa', $sortDirection);
                break;
            case 'infracao':
                $query->leftJoin('multa_infracoes as infracoes_sort', 'infracoes_sort.id', '=', 'multas.multa_infracao_id');
                $query->orderBy('infracoes_sort.nome', $sortDirection);
                break;
            case 'orgao':
                $query->leftJoin('multa_orgaos_autuadores as orgaos_sort', 'orgaos_sort.id', '=', 'multas.multa_orgao_autuador_id');
                $query->orderBy('orgaos_sort.nome', $sortDirection);
                break;
            case 'motorista':
                $query->leftJoin('colaboradores as colaboradores_sort', 'colaboradores_sort.id', '=', 'multas.colaborador_id');
                $query->orderBy('colaboradores_sort.nome', $sortDirection);
                break;
            default:
                $query->orderBy('multas.'.$sortBy, $sortDirection);
                break;
        }

        if ($sortBy !== 'id') {
            $query->orderBy('multas.id', 'desc');
        }

        return response()->json($query->paginate($perPage)->withQueryString());
    }

    public function show(Request $request, Multa $multa): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $user?->hasPermission('fines.list.view')
            || $user?->hasPermission('fines.entries.create')
            || $user?->hasPermission('fines.entries.update'),
            403,
        );
        abort_unless($user?->canAccessUnit('fines', (int) $multa->unidade_id), 403);

        $tipoRegistro = (string) $request->query('tipo_registro', '');

        if ($tipoRegistro !== '' && $multa->tipo_registro !== $tipoRegistro) {
            abort(404);
        }

        return response()->json([
            'data' => $multa->load([
                'unidade:id,nome',
                'placaFrota:id,placa,unidade_id',
                'infracao:id,nome',
                'orgaoAutuador:id,nome',
                'colaborador:id,nome,unidade_id',
            ]),
        ]);
    }

    public function reference(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $user?->hasPermission('fines.dashboard.view')
            || $user?->hasPermission('fines.list.view')
            || $user?->hasPermission('fines.entries.create')
            || $user?->hasPermission('fines.entries.update'),
            403,
        );
        $allowedUnitIds = $this->allowedUnitIds($request);

        return response()->json([
            'unidades' => Unidade::query()
                ->when(
                    $user?->dataScopeFor('fines') === 'units',
                    fn ($query) => $query->whereIn('id', $allowedUnitIds !== [] ? $allowedUnitIds : [0]),
                )
                ->orderBy('nome')
                ->get(['id', 'nome']),
            'placas' => PlacaFrota::query()
                ->with('unidade:id,nome')
                ->when(
                    $user?->dataScopeFor('fines') === 'units',
                    fn ($query) => $query->whereIn('unidade_id', $allowedUnitIds !== [] ? $allowedUnitIds : [0]),
                )
                ->orderBy('placa')
                ->get(['id', 'placa', 'unidade_id']),
            'motoristas' => Colaborador::query()
                ->with('unidade:id,nome')
                ->where('ativo', true)
                ->when(
                    $user?->dataScopeFor('fines') === 'units',
                    fn ($query) => $query->whereIn('unidade_id', $allowedUnitIds !== [] ? $allowedUnitIds : [0]),
                )
                ->orderBy('nome')
                ->get(['id', 'nome', 'unidade_id']),
            'infracoes' => MultaInfracao::query()
                ->where('ativo', true)
                ->orderBy('nome')
                ->get(['id', 'nome']),
            'orgaos' => MultaOrgaoAutuador::query()
                ->where('ativo', true)
                ->orderBy('nome')
                ->get(['id', 'nome']),
        ]);
    }

    public function store(StoreMultaRequest $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->hasPermission('fines.entries.create'), 403);

        $data = $request->validated();
        $tipoRegistro = (string) ($data['tipo_registro'] ?? 'multa');

        if ($tipoRegistro === 'notificacao') {
            $data['tipo_registro'] = 'notificacao';
            $data['colaborador_id'] = null;
            $data['indicado_condutor'] = false;
            $data['culpa'] = 'empresa';
            $data['valor'] = 0;
            $data['tipo_valor'] = 'normal';
            $data['vencimento'] = null;
            $data['descontar'] = false;
        } else {
            $data['tipo_registro'] = 'multa';
        }

        if (($data['culpa'] ?? 'empresa') !== 'motorista') {
            $data['descontar'] = false;
        }

        $data['unidade_id'] = $this->resolveUnidadeId(
            isset($data['colaborador_id']) ? (int) $data['colaborador_id'] : null,
            (int) $data['placa_frota_id'],
        );
        abort_unless($user?->canAccessUnit('fines', (int) $data['unidade_id']), 403);
        $data['autor_id'] = (int) $user->id;

        $multa = Multa::query()->create($data);

        return response()->json([
            'data' => $multa->load([
                'unidade:id,nome',
                'placaFrota:id,placa,unidade_id',
                'infracao:id,nome',
                'orgaoAutuador:id,nome',
                'colaborador:id,nome,unidade_id',
            ]),
        ], 201);
    }

    public function update(UpdateMultaRequest $request, Multa $multa): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->hasPermission('fines.entries.update'), 403);
        abort_unless($user?->canAccessUnit('fines', (int) $multa->unidade_id), 403);

        $data = $request->validated();
        $tipoRegistro = (string) ($data['tipo_registro'] ?? $multa->tipo_registro ?? 'multa');

        if ($tipoRegistro === 'notificacao') {
            $data['tipo_registro'] = 'notificacao';
            $data['colaborador_id'] = null;
            $data['indicado_condutor'] = false;
            $data['culpa'] = 'empresa';
            $data['valor'] = 0;
            $data['tipo_valor'] = 'normal';
            $data['vencimento'] = null;
            $data['descontar'] = false;
        } else {
            $data['tipo_registro'] = 'multa';
        }

        if (($data['culpa'] ?? 'empresa') !== 'motorista') {
            $data['descontar'] = false;
        }

        $data['unidade_id'] = $this->resolveUnidadeId(
            isset($data['colaborador_id']) ? (int) $data['colaborador_id'] : null,
            (int) $data['placa_frota_id'],
        );
        abort_unless($user?->canAccessUnit('fines', (int) $data['unidade_id']), 403);

        $multa->update($data);

        return response()->json([
            'data' => $multa->refresh()->load([
                'unidade:id,nome',
                'placaFrota:id,placa,unidade_id',
                'infracao:id,nome',
                'orgaoAutuador:id,nome',
                'colaborador:id,nome,unidade_id',
            ]),
        ]);
    }

    public function destroy(Request $request, Multa $multa): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('fines.entries.delete'), 403);
        abort_unless($request->user()?->canAccessUnit('fines', (int) $multa->unidade_id), 403);

        $multa->delete();

        return response()->json([], 204);
    }

    public function storeOrgao(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()?->hasPermission('fines.entries.create')
            || $request->user()?->hasPermission('fines.organs.manage'),
            403,
        );

        $validated = $request->validate([
            'nome' => ['required', 'string', 'max:255'],
        ]);

        $name = trim((string) $validated['nome']);

        $existing = MultaOrgaoAutuador::query()
            ->whereRaw('LOWER(nome) = ?', [strtolower($name)])
            ->first();

        if ($existing) {
            return response()->json([
                'data' => $existing,
                'created' => false,
            ]);
        }

        $orgao = MultaOrgaoAutuador::query()->create([
            'nome' => $name,
            'ativo' => true,
        ]);

        return response()->json([
            'data' => $orgao,
            'created' => true,
        ], 201);
    }

    /**
     * @param  \Illuminate\Support\Collection<int, object>  $rows
     * @return array<int, array<string, float|int|string>>
     */
    private function normalizeChartRows($rows, string $fallbackLabel): array
    {
        return $rows
            ->map(function ($row) use ($fallbackLabel): array {
                $label = trim((string) ($row->label ?? ''));

                return [
                    'label' => $label !== '' ? $label : $fallbackLabel,
                    'quantidade' => (int) ($row->quantidade ?? 0),
                    'valor_total' => round((float) ($row->valor_total ?? 0), 2),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  iterable<int, object|array<string, mixed>>  $rows
     * @return array<string, mixed>|null
     */
    private function topChartRow(iterable $rows): ?array
    {
        $normalized = collect($rows)
            ->map(function ($row): array {
                return [
                    'label' => trim((string) (data_get($row, 'label') ?? '')) !== ''
                        ? trim((string) data_get($row, 'label'))
                        : 'Nao informado',
                    'quantidade' => (int) data_get($row, 'quantidade', 0),
                    'valor_total' => round((float) data_get($row, 'valor_total', 0), 2),
                ];
            })
            ->sortByDesc('valor_total')
            ->values();

        return $normalized->first();
    }

    private function resolveUnidadeId(?int $colaboradorId, int $placaFrotaId): ?int
    {
        if ($colaboradorId) {
            $colaborador = Colaborador::query()->find($colaboradorId);

            if ($colaborador?->unidade_id) {
                return (int) $colaborador->unidade_id;
            }
        }

        $placa = PlacaFrota::query()->find($placaFrotaId);

        return $placa?->unidade_id ? (int) $placa->unidade_id : null;
    }

    /**
     * @return array<int, int>
     */
    private function allowedUnitIds(Request $request): array
    {
        return $request->user()?->allowedUnitIdsFor('fines') ?? [];
    }
}
