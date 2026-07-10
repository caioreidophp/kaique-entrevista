<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PayrollPendingExtra;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PayrollPendingExtraController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($this->canView($request), 403);

        $validated = $request->validate([
            'tab' => ['nullable', Rule::in(['pending', 'finished', 'all'])],
            'status' => ['nullable', Rule::in($this->statuses())],
            'tipo' => ['nullable', Rule::in($this->types())],
            'data' => ['nullable', 'date'],
            'unidade_id' => ['nullable', 'integer', 'exists:unidades,id'],
            'search' => ['nullable', 'string', 'max:120'],
        ]);

        $tab = (string) ($validated['tab'] ?? 'pending');

        $query = $this->queryForUser($request)
            ->with([
                'unidade:id,nome,slug',
                'pagamento:id,colaborador_id,tipo_pagamento_id,valor,data_pagamento,descricao',
                'pagamento.colaborador:id,nome',
                'pagamento.tipoPagamento:id,nome',
            ])
            ->when($tab === 'pending', fn (Builder $query) => $query->where('status', PayrollPendingExtra::STATUS_PENDING))
            ->when($tab === 'finished', fn (Builder $query) => $query->where('status', PayrollPendingExtra::STATUS_FINISHED))
            ->when(! empty($validated['status']), fn (Builder $query) => $query->where('status', $validated['status']))
            ->when(! empty($validated['tipo']), fn (Builder $query) => $query->where('tipo', $validated['tipo']))
            ->when(! empty($validated['data']), fn (Builder $query) => $query->whereDate('data', $validated['data']))
            ->when(! empty($validated['unidade_id']), fn (Builder $query) => $query->where('unidade_id', (int) $validated['unidade_id']))
            ->when(! empty($validated['search']), function (Builder $query) use ($validated): void {
                $term = '%'.str_replace(['%', '_'], ['\%', '\_'], (string) $validated['search']).'%';
                $query->where('descricao', 'like', $term);
            })
            ->orderByRaw("CASE WHEN status = ? AND date(data) <= date('now', '-7 day') THEN 0 ELSE 1 END", [PayrollPendingExtra::STATUS_PENDING])
            ->orderBy('data')
            ->orderByDesc('id');

        $rows = $query->paginate(200);

        $rows->getCollection()->transform(fn (PayrollPendingExtra $item): array => $this->serialize($item));

        $summaryQuery = $this->queryForUser($request);
        $overdueCount = (clone $summaryQuery)
            ->where('status', PayrollPendingExtra::STATUS_PENDING)
            ->whereDate('data', '<=', now()->subDays(7)->toDateString())
            ->count();

        return response()->json([
            'data' => $rows->items(),
            'current_page' => $rows->currentPage(),
            'last_page' => $rows->lastPage(),
            'total' => $rows->total(),
            'summary' => [
                'pending' => (clone $summaryQuery)->where('status', PayrollPendingExtra::STATUS_PENDING)->count(),
                'finished' => (clone $summaryQuery)->where('status', PayrollPendingExtra::STATUS_FINISHED)->count(),
                'overdue' => $overdueCount,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($this->canWrite($request), 403);

        $data = $this->validatedPayload($request);
        $data['autor_id'] = (int) $request->user()->id;

        $item = PayrollPendingExtra::query()->create($data);

        return response()->json(['data' => $this->serialize($item->fresh([
            'unidade:id,nome,slug',
            'pagamento:id,colaborador_id,tipo_pagamento_id,valor,data_pagamento,descricao',
            'pagamento.colaborador:id,nome',
            'pagamento.tipoPagamento:id,nome',
        ]))], 201);
    }

    public function update(Request $request, PayrollPendingExtra $payrollPendingExtra): JsonResponse
    {
        abort_unless($this->canWrite($request), 403);
        $this->authorizeRecord($request, $payrollPendingExtra);

        $payrollPendingExtra->update($this->validatedPayload($request, partial: true));

        return response()->json(['data' => $this->serialize($payrollPendingExtra->refresh()->load([
            'unidade:id,nome,slug',
            'pagamento:id,colaborador_id,tipo_pagamento_id,valor,data_pagamento,descricao',
            'pagamento.colaborador:id,nome',
            'pagamento.tipoPagamento:id,nome',
        ]))]);
    }

    public function destroy(Request $request, PayrollPendingExtra $payrollPendingExtra): JsonResponse
    {
        abort_unless($this->canWrite($request), 403);
        $this->authorizeRecord($request, $payrollPendingExtra);

        $payrollPendingExtra->delete();

        return response()->json([], 204);
    }

    private function validatedPayload(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'data' => [$required, 'date'],
            'unidade_id' => ['nullable', 'integer', 'exists:unidades,id'],
            'descricao' => [$required, 'string', 'max:255'],
            'tipo' => [$required, Rule::in($this->types())],
            'status' => [$required, Rule::in($this->statuses())],
            'pagamento_id' => ['nullable', 'integer', 'exists:pagamentos,id'],
        ]);
    }

    private function serialize(?PayrollPendingExtra $item): array
    {
        abort_if(! $item, 404);

        $daysOpen = $item->data ? (int) $item->data->copy()->startOfDay()->diffInDays(now()->startOfDay(), false) : 0;
        $isOverdue = $item->status === PayrollPendingExtra::STATUS_PENDING && $daysOpen >= 7;

        return [
            'id' => $item->id,
            'data' => $item->data?->toDateString(),
            'unidade_id' => $item->unidade_id,
            'unidade' => $item->unidade,
            'descricao' => $item->descricao,
            'tipo' => $item->tipo,
            'status' => $item->status,
            'pagamento_id' => $item->pagamento_id,
            'pagamento' => $item->pagamento,
            'autor_id' => $item->autor_id,
            'days_open' => max(0, $daysOpen),
            'is_overdue' => $isOverdue,
            'created_at' => $item->created_at?->toIso8601String(),
            'updated_at' => $item->updated_at?->toIso8601String(),
        ];
    }

    private function queryForUser(Request $request): Builder
    {
        $query = PayrollPendingExtra::query();
        $user = $request->user();

        if (! $user?->isMasterAdmin()) {
            $query->where('autor_id', $user?->id);
        }

        if ($user?->dataScopeFor('payroll') === 'units') {
            $query->whereIn('unidade_id', $user->allowedUnitIdsFor('payroll') ?: [0]);
        }

        return $query;
    }

    private function authorizeRecord(Request $request, PayrollPendingExtra $item): void
    {
        $user = $request->user();

        if (! $user?->isMasterAdmin() && $item->autor_id !== $user?->id) {
            abort(403);
        }

        if ($user?->dataScopeFor('payroll') === 'units' && ! in_array((int) $item->unidade_id, $user->allowedUnitIdsFor('payroll'), true)) {
            abort(403);
        }
    }

    private function canView(Request $request): bool
    {
        $user = $request->user();

        return (bool) ($user?->isAdmin()
            || $user?->isMasterAdmin()
            || $user?->hasPermission('sidebar.payroll.list.view')
            || $user?->hasPermission('payroll.dashboard.view'));
    }

    private function canWrite(Request $request): bool
    {
        $user = $request->user();

        return (bool) ($user?->isAdmin() || $user?->isMasterAdmin());
    }

    private function types(): array
    {
        return [
            PayrollPendingExtra::TYPE_SATURDAY,
            PayrollPendingExtra::TYPE_HOLIDAY,
            PayrollPendingExtra::TYPE_MAINTENANCE,
            PayrollPendingExtra::TYPE_TRANSFER,
            PayrollPendingExtra::TYPE_SPOT,
        ];
    }

    private function statuses(): array
    {
        return [
            PayrollPendingExtra::STATUS_PENDING,
            PayrollPendingExtra::STATUS_FINISHED,
        ];
    }
}
