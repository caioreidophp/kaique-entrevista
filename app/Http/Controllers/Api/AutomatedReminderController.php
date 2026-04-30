<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AutomatedReminderDelivery;
use App\Models\AutomatedReminderRule;
use App\Support\AutomatedReminderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AutomatedReminderController extends Controller
{
    private function ensureEnabled(): void
    {
        abort_unless((bool) config('transport_features.automated_reminders', true), 404);
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensureEnabled();
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $rules = AutomatedReminderRule::query()
            ->with('creator:id,name,email')
            ->withCount([
                'deliveries as sent_last_7d' => fn ($query) => $query
                    ->where('status', 'sent')
                    ->where('created_at', '>=', now()->subDays(7)),
                'deliveries as failed_last_7d' => fn ($query) => $query
                    ->where('status', 'failed')
                    ->where('created_at', '>=', now()->subDays(7)),
            ])
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $rules,
        ]);
    }

    public function deliveries(Request $request): JsonResponse
    {
        $this->ensureEnabled();
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $limit = max(1, min(300, (int) $request->integer('limit', 120)));
        $status = trim((string) $request->query('status', ''));
        $ruleId = $request->integer('rule_id');
        $channel = trim((string) $request->query('channel', ''));

        $query = AutomatedReminderDelivery::query()->with('rule:id,name,trigger_key,channel');

        if ($status !== '') {
            $query->where('status', $status);
        }

        if ($ruleId > 0) {
            $query->where('automated_reminder_rule_id', $ruleId);
        }

        if ($channel !== '') {
            $query->where('channel', $channel);
        }

        $rows = $query
            ->latest('id')
            ->limit($limit)
            ->get();

        return response()->json([
            'data' => $rows,
            'summary' => [
                'sent_last_24h' => AutomatedReminderDelivery::query()
                    ->where('status', 'sent')
                    ->where('created_at', '>=', now()->subDay())
                    ->count(),
                'failed_last_24h' => AutomatedReminderDelivery::query()
                    ->where('status', 'failed')
                    ->where('created_at', '>=', now()->subDay())
                    ->count(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureEnabled();
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'trigger_key' => ['required', Rule::in(['vacations_due', 'task_sla_overdue'])],
            'channel' => ['required', Rule::in(['email', 'whatsapp'])],
            'recipients' => ['required', 'array', 'min:1'],
            'recipients.*' => ['required', 'string', 'max:255'],
            'threshold_days' => ['nullable', 'integer', 'min:1', 'max:180'],
            'webhook_url' => ['nullable', 'url', 'max:2048'],
            'message_prefix' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $rule = AutomatedReminderRule::query()->create([
            'name' => (string) $validated['name'],
            'trigger_key' => (string) $validated['trigger_key'],
            'channel' => (string) $validated['channel'],
            'recipients' => array_values(array_unique(array_map(
                static fn ($item): string => trim((string) $item),
                (array) $validated['recipients'],
            ))),
            'threshold_days' => (int) ($validated['threshold_days'] ?? 30),
            'webhook_url' => isset($validated['webhook_url']) ? (string) $validated['webhook_url'] : null,
            'message_prefix' => isset($validated['message_prefix']) ? (string) $validated['message_prefix'] : null,
            'is_active' => (bool) ($validated['is_active'] ?? true),
            'created_by_user_id' => (int) $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Regra de lembrete criada com sucesso.',
            'data' => $rule->load('creator:id,name,email'),
        ], 201);
    }

    public function update(Request $request, AutomatedReminderRule $automatedReminderRule): JsonResponse
    {
        $this->ensureEnabled();
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'trigger_key' => ['nullable', Rule::in(['vacations_due', 'task_sla_overdue'])],
            'channel' => ['nullable', Rule::in(['email', 'whatsapp'])],
            'recipients' => ['nullable', 'array', 'min:1'],
            'recipients.*' => ['required', 'string', 'max:255'],
            'threshold_days' => ['nullable', 'integer', 'min:1', 'max:180'],
            'webhook_url' => ['nullable', 'url', 'max:2048'],
            'message_prefix' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (array_key_exists('recipients', $validated)) {
            $validated['recipients'] = array_values(array_unique(array_map(
                static fn ($item): string => trim((string) $item),
                (array) $validated['recipients'],
            )));
        }

        $automatedReminderRule->update($validated);

        return response()->json([
            'message' => 'Regra de lembrete atualizada com sucesso.',
            'data' => $automatedReminderRule->refresh()->load('creator:id,name,email'),
        ]);
    }

    public function destroy(Request $request, AutomatedReminderRule $automatedReminderRule): JsonResponse
    {
        $this->ensureEnabled();
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $automatedReminderRule->delete();

        return response()->json([
            'message' => 'Regra de lembrete removida com sucesso.',
        ]);
    }

    public function run(Request $request, AutomatedReminderService $service): JsonResponse
    {
        $this->ensureEnabled();
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $ruleId = (int) $request->integer('rule_id');

        if ($ruleId > 0) {
            $rule = AutomatedReminderRule::query()->findOrFail($ruleId);
            $result = $service->runRule($rule);

            return response()->json([
                'message' => 'Execucao manual concluida.',
                'data' => $result,
            ]);
        }

        $result = $service->runActiveRules();

        return response()->json([
            'message' => 'Execucao manual concluida para regras ativas.',
            'data' => $result,
        ]);
    }
}
