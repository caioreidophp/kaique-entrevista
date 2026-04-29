<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OperationalTask;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OperationalTaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('operations.tasks.view'), 403);

        $perPage = min(max((int) $request->integer('per_page', 25), 1), 100);
        $query = OperationalTask::query()
            ->with([
                'unidade:id,nome',
                'creator:id,name',
                'assignee:id,name',
            ])
            ->latest('id');

        $this->applyVisibilityScope($query, $request);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->string('status'));
        }

        if ($request->filled('priority')) {
            $query->where('priority', (string) $request->string('priority'));
        }

        if ($request->filled('module_key')) {
            $query->where('module_key', (string) $request->string('module_key'));
        }

        if ($request->filled('unidade_id')) {
            $unidadeId = (int) $request->integer('unidade_id');
            abort_unless($request->user()?->canAccessUnit('operations', $unidadeId), 403);
            $query->where('unidade_id', $unidadeId);
        }

        if ($request->filled('assigned_to')) {
            $query->where('assigned_to', (int) $request->integer('assigned_to'));
        }

        if ($request->filled('due_from')) {
            $query->whereDate('due_at', '>=', (string) $request->string('due_from'));
        }

        if ($request->filled('due_to')) {
            $query->whereDate('due_at', '<=', (string) $request->string('due_to'));
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));

            if ($search !== '') {
                $query->where(function (Builder $builder) use ($search): void {
                    $builder->where('title', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            }
        }

        $paginated = $query->paginate($perPage)->withQueryString();

        return response()->json([
            'data' => collect($paginated->items())
                ->map(fn (OperationalTask $task): array => $this->serializeTask($task))
                ->values(),
            'current_page' => $paginated->currentPage(),
            'last_page' => $paginated->lastPage(),
            'per_page' => $paginated->perPage(),
            'total' => $paginated->total(),
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('operations.tasks.view'), 403);

        $query = OperationalTask::query();
        $this->applyVisibilityScope($query, $request);

        $allTasks = (clone $query)->get([
            'id',
            'unidade_id',
            'priority',
            'status',
            'due_at',
            'assigned_to',
        ]);

        $byStatus = [
            'open' => $allTasks->where('status', 'open')->count(),
            'in_progress' => $allTasks->where('status', 'in_progress')->count(),
            'done' => $allTasks->where('status', 'done')->count(),
            'canceled' => $allTasks->where('status', 'canceled')->count(),
        ];

        $now = now();
        $next24h = now()->addHours(24);
        $next72h = now()->addHours(72);

        $openTasks = $allTasks->filter(
            fn (OperationalTask $task): bool => in_array($task->status, ['open', 'in_progress'], true),
        );

        $slaByTaskId = [];

        foreach ($openTasks as $task) {
            $slaByTaskId[(int) $task->id] = $this->resolveSlaStateForTask(
                $task,
                $now,
                $next24h,
                $next72h,
            );
        }

        $sla = [
            'overdue' => collect($slaByTaskId)->filter(fn (string $state): bool => $state === 'overdue')->count(),
            'due_24h' => collect($slaByTaskId)->filter(fn (string $state): bool => $state === 'due_24h')->count(),
            'due_72h' => collect($slaByTaskId)->filter(fn (string $state): bool => $state === 'due_72h')->count(),
            'without_due_date' => collect($slaByTaskId)->filter(fn (string $state): bool => $state === 'without_due_date')->count(),
        ];

        $byUnit = OperationalTask::query()
            ->selectRaw('unidade_id, COUNT(*) as total')
            ->whereIn('id', $allTasks->pluck('id')->all())
            ->groupBy('unidade_id')
            ->with('unidade:id,nome')
            ->get()
            ->map(fn (OperationalTask $task): array => [
                'unidade_id' => $task->unidade_id,
                'unidade_nome' => $task->unidade?->nome ?? 'Sem unidade',
                'total' => (int) ($task->total ?? 0),
            ])
            ->sortByDesc('total')
            ->values();

        $byUnitRisk = $openTasks
            ->groupBy(fn (OperationalTask $task): string => (string) ($task->unidade_id ?? 'none'))
            ->map(function ($tasksByUnit, string $groupKey) use ($slaByTaskId): array {
                $rows = collect($tasksByUnit);
                /** @var OperationalTask|null $first */
                $first = $rows->first();

                $overdue = $rows->filter(
                    fn (OperationalTask $task): bool => ($slaByTaskId[(int) $task->id] ?? 'on_track') === 'overdue',
                )->count();
                $due24h = $rows->filter(
                    fn (OperationalTask $task): bool => ($slaByTaskId[(int) $task->id] ?? 'on_track') === 'due_24h',
                )->count();
                $critical = $rows->where('priority', 'critical')->count();
                $high = $rows->where('priority', 'high')->count();
                $total = $rows->count();
                $riskScore = ($overdue * 5) + ($due24h * 3) + ($critical * 2) + $high + (int) ceil($total / 3);

                return [
                    'unidade_id' => $groupKey === 'none' ? null : (int) $groupKey,
                    'unidade_nome' => $first?->unidade?->nome ?? 'Sem unidade',
                    'total_open' => $total,
                    'overdue' => $overdue,
                    'due_24h' => $due24h,
                    'critical' => $critical,
                    'high' => $high,
                    'risk_score' => $riskScore,
                ];
            })
            ->sortByDesc('risk_score')
            ->values();

        $highPriorityOpen = $openTasks
            ->whereIn('priority', ['high', 'critical'])
            ->count();

        $alerts = [];
        if ($sla['overdue'] > 0) {
            $alerts[] = [
                'severity' => 'critical',
                'code' => 'task_sla_overdue',
                'title' => 'SLA vencido em tarefas operacionais',
                'message' => "Existem {$sla['overdue']} tarefa(s) com SLA vencido.",
                'count' => $sla['overdue'],
            ];
        }

        if ($sla['due_24h'] > 0) {
            $alerts[] = [
                'severity' => 'warning',
                'code' => 'task_sla_due_24h',
                'title' => 'SLA vencendo em 24h',
                'message' => "{$sla['due_24h']} tarefa(s) vencem nas proximas 24h.",
                'count' => $sla['due_24h'],
            ];
        }

        if ($highPriorityOpen > 0) {
            $alerts[] = [
                'severity' => 'warning',
                'code' => 'high_priority_tasks_open',
                'title' => 'Pendencias de alta prioridade',
                'message' => "{$highPriorityOpen} tarefa(s) de alta prioridade seguem em aberto.",
                'count' => $highPriorityOpen,
            ];
        }

        $topRiskUnit = $byUnitRisk->first();
        if (is_array($topRiskUnit) && ((int) ($topRiskUnit['risk_score'] ?? 0)) >= 8) {
            $alerts[] = [
                'severity' => 'warning',
                'code' => 'unit_operational_bottleneck',
                'title' => 'Gargalo operacional por unidade',
                'message' => "{$topRiskUnit['unidade_nome']} lidera risco operacional no momento.",
                'count' => (int) ($topRiskUnit['risk_score'] ?? 0),
            ];
        }

        return response()->json([
            'generated_at' => now()->toISOString(),
            'summary' => [
                'total' => $allTasks->count(),
                'by_status' => $byStatus,
                'sla' => $sla,
                'high_priority_open' => $highPriorityOpen,
            ],
            'by_unit' => $byUnit,
            'by_unit_risk' => $byUnitRisk,
            'alerts' => $alerts,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('operations.tasks.manage'), 403);

        $validated = $request->validate([
            'module_key' => ['nullable', 'string', 'max:50'],
            'unidade_id' => ['nullable', 'integer', 'exists:unidades,id'],
            'title' => ['required', 'string', 'max:180'],
            'description' => ['nullable', 'string', 'max:4000'],
            'priority' => ['nullable', 'in:low,normal,high,critical'],
            'status' => ['nullable', 'in:open,in_progress,done,canceled'],
            'due_at' => ['nullable', 'date'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'metadata' => ['nullable', 'array'],
        ]);

        $unidadeId = isset($validated['unidade_id']) ? (int) $validated['unidade_id'] : null;

        if ($unidadeId !== null) {
            abort_unless($request->user()?->canAccessUnit('operations', $unidadeId), 403);
        }

        $status = (string) ($validated['status'] ?? 'open');
        $task = OperationalTask::query()->create([
            'module_key' => trim((string) ($validated['module_key'] ?? 'operations')) ?: 'operations',
            'unidade_id' => $unidadeId,
            'title' => trim((string) $validated['title']),
            'description' => isset($validated['description']) ? trim((string) $validated['description']) : null,
            'priority' => (string) ($validated['priority'] ?? 'normal'),
            'status' => $status,
            'due_at' => $validated['due_at'] ?? null,
            'assigned_to' => isset($validated['assigned_to']) ? (int) $validated['assigned_to'] : (int) $request->user()->id,
            'created_by' => (int) $request->user()->id,
            'metadata' => is_array($validated['metadata'] ?? null) ? $validated['metadata'] : null,
            'started_at' => $status === 'in_progress' ? now() : null,
            'completed_at' => $status === 'done' ? now() : null,
        ]);

        return response()->json([
            'message' => 'Tarefa criada com sucesso.',
            'data' => $this->serializeTask($task->load(['unidade:id,nome', 'creator:id,name', 'assignee:id,name'])),
        ], 201);
    }

    public function update(Request $request, OperationalTask $operationalTask): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('operations.tasks.manage'), 403);
        $this->authorizeTaskVisibility($request, $operationalTask);

        $validated = $request->validate([
            'module_key' => ['sometimes', 'string', 'max:50'],
            'unidade_id' => ['nullable', 'integer', 'exists:unidades,id'],
            'title' => ['sometimes', 'string', 'max:180'],
            'description' => ['nullable', 'string', 'max:4000'],
            'priority' => ['sometimes', 'in:low,normal,high,critical'],
            'status' => ['sometimes', 'in:open,in_progress,done,canceled'],
            'due_at' => ['nullable', 'date'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'metadata' => ['nullable', 'array'],
        ]);

        if (array_key_exists('unidade_id', $validated) && $validated['unidade_id'] !== null) {
            abort_unless($request->user()?->canAccessUnit('operations', (int) $validated['unidade_id']), 403);
        }

        $operationalTask->fill([
            'module_key' => array_key_exists('module_key', $validated)
                ? (trim((string) $validated['module_key']) ?: 'operations')
                : $operationalTask->module_key,
            'unidade_id' => array_key_exists('unidade_id', $validated)
                ? ($validated['unidade_id'] !== null ? (int) $validated['unidade_id'] : null)
                : $operationalTask->unidade_id,
            'title' => array_key_exists('title', $validated)
                ? trim((string) $validated['title'])
                : $operationalTask->title,
            'description' => array_key_exists('description', $validated)
                ? (isset($validated['description']) ? trim((string) $validated['description']) : null)
                : $operationalTask->description,
            'priority' => array_key_exists('priority', $validated)
                ? (string) $validated['priority']
                : $operationalTask->priority,
            'status' => array_key_exists('status', $validated)
                ? (string) $validated['status']
                : $operationalTask->status,
            'due_at' => array_key_exists('due_at', $validated)
                ? $validated['due_at']
                : $operationalTask->due_at,
            'assigned_to' => array_key_exists('assigned_to', $validated)
                ? ($validated['assigned_to'] !== null ? (int) $validated['assigned_to'] : null)
                : $operationalTask->assigned_to,
            'metadata' => array_key_exists('metadata', $validated)
                ? (is_array($validated['metadata']) ? $validated['metadata'] : null)
                : $operationalTask->metadata,
        ]);

        if ($operationalTask->status === 'in_progress' && $operationalTask->started_at === null) {
            $operationalTask->started_at = now();
        }

        if ($operationalTask->status === 'done' && $operationalTask->completed_at === null) {
            $operationalTask->completed_at = now();
        }

        if (in_array($operationalTask->status, ['open', 'canceled'], true)) {
            $operationalTask->completed_at = $operationalTask->status === 'canceled'
                ? ($operationalTask->completed_at ?? now())
                : null;
        }

        $operationalTask->save();

        return response()->json([
            'message' => 'Tarefa atualizada com sucesso.',
            'data' => $this->serializeTask($operationalTask->refresh()->load(['unidade:id,nome', 'creator:id,name', 'assignee:id,name'])),
        ]);
    }

    public function destroy(Request $request, OperationalTask $operationalTask): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('operations.tasks.manage'), 403);
        $this->authorizeTaskVisibility($request, $operationalTask);

        $operationalTask->delete();

        return response()->json([], 204);
    }

    private function applyVisibilityScope(Builder $query, Request $request): void
    {
        $user = $request->user();

        if (! $user || $user->isMasterAdmin()) {
            return;
        }

        $scope = $user->dataScopeFor('operations');

        if ($scope === 'units') {
            $allowedUnitIds = $user->allowedUnitIdsFor('operations');

            if ($allowedUnitIds === []) {
                $query->whereRaw('1 = 0');

                return;
            }

            $query->whereIn('unidade_id', $allowedUnitIds);

            return;
        }

        if ($scope === 'own') {
            $query->where(function (Builder $builder) use ($user): void {
                $builder->where('created_by', $user->id)
                    ->orWhere('assigned_to', $user->id);
            });
        }
    }

    private function authorizeTaskVisibility(Request $request, OperationalTask $task): void
    {
        $user = $request->user();

        if (! $user || $user->isMasterAdmin()) {
            return;
        }

        $scope = $user->dataScopeFor('operations');

        if ($scope === 'units') {
            abort_unless($task->unidade_id !== null && $user->canAccessUnit('operations', (int) $task->unidade_id), 403);

            return;
        }

        if ($scope === 'own') {
            abort_unless((int) $task->created_by === (int) $user->id || (int) ($task->assigned_to ?? 0) === (int) $user->id, 403);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeTask(OperationalTask $task): array
    {
        $now = now();
        $next24h = now()->addHours(24);
        $next72h = now()->addHours(72);

        $slaState = $this->resolveSlaStateForTask($task, $now, $next24h, $next72h);

        return [
            'id' => (int) $task->id,
            'module_key' => (string) $task->module_key,
            'unidade_id' => $task->unidade_id !== null ? (int) $task->unidade_id : null,
            'unidade_nome' => $task->unidade?->nome,
            'title' => (string) $task->title,
            'description' => $task->description,
            'priority' => (string) $task->priority,
            'status' => (string) $task->status,
            'due_at' => $task->due_at?->toISOString(),
            'started_at' => $task->started_at?->toISOString(),
            'completed_at' => $task->completed_at?->toISOString(),
            'created_by' => (int) $task->created_by,
            'created_by_name' => $task->creator?->name,
            'assigned_to' => $task->assigned_to !== null ? (int) $task->assigned_to : null,
            'assigned_to_name' => $task->assignee?->name,
            'metadata' => $task->metadata,
            'created_at' => $task->created_at?->toISOString(),
            'updated_at' => $task->updated_at?->toISOString(),
            'sla_state' => $slaState,
        ];
    }

    private function resolveSlaStateForTask(
        OperationalTask $task,
        \Carbon\CarbonInterface $now,
        \Carbon\CarbonInterface $next24h,
        \Carbon\CarbonInterface $next72h,
    ): string {
        if (! in_array($task->status, ['open', 'in_progress'], true)) {
            return 'closed';
        }

        if ($task->due_at === null) {
            return 'without_due_date';
        }

        if ($task->due_at->lt($now)) {
            return 'overdue';
        }

        if ($task->due_at->betweenIncluded($now, $next24h)) {
            return 'due_24h';
        }

        if ($task->due_at->betweenIncluded($next24h, $next72h)) {
            return 'due_72h';
        }

        return 'on_track';
    }
}
