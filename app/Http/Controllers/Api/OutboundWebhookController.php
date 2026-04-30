<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OutboundWebhook;
use App\Models\WebhookDelivery;
use App\Support\OutboundWebhookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class OutboundWebhookController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $since24h = now()->subDay();

        $hooks = OutboundWebhook::query()
            ->with('createdBy:id,name,email')
            ->withCount('deliveries')
            ->withCount([
                'deliveries as deliveries_last_24h' => fn ($query) => $query->where('created_at', '>=', $since24h),
                'deliveries as deliveries_success_last_24h' => fn ($query) => $query
                    ->where('created_at', '>=', $since24h)
                    ->where('is_success', true),
                'deliveries as deliveries_failed_last_24h' => fn ($query) => $query
                    ->where('created_at', '>=', $since24h)
                    ->where('is_success', false),
            ])
            ->orderBy('name')
            ->get();

        $summary = [
            'hooks_total' => $hooks->count(),
            'active_hooks' => $hooks->where('is_active', true)->count(),
            'deliveries_last_24h' => (int) WebhookDelivery::query()
                ->where('created_at', '>=', $since24h)
                ->count(),
            'failed_last_24h' => (int) WebhookDelivery::query()
                ->where('created_at', '>=', $since24h)
                ->where('is_success', false)
                ->count(),
        ];

        return response()->json([
            'data' => $hooks,
            'summary' => $summary,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'target_url' => ['required', 'url', 'max:2048'],
            'signing_secret' => ['nullable', 'string', 'min:16', 'max:255'],
            'events' => ['nullable', 'array'],
            'events.*' => ['string', 'max:120'],
            'timeout_seconds' => ['nullable', 'integer', 'min:2', 'max:60'],
            'max_attempts' => ['nullable', 'integer', 'min:1', 'max:10'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $hook = OutboundWebhook::query()->create([
            'name' => (string) $validated['name'],
            'target_url' => (string) $validated['target_url'],
            'signing_secret' => (string) ($validated['signing_secret'] ?? Str::random(48)),
            'events' => $validated['events'] ?? ['*'],
            'timeout_seconds' => (int) ($validated['timeout_seconds'] ?? 10),
            'max_attempts' => (int) ($validated['max_attempts'] ?? 5),
            'is_active' => (bool) ($validated['is_active'] ?? true),
            'created_by_user_id' => (int) $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Webhook cadastrado com sucesso.',
            'data' => $hook->load('createdBy:id,name,email'),
        ], 201);
    }

    public function update(Request $request, OutboundWebhook $outboundWebhook): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'target_url' => ['nullable', 'url', 'max:2048'],
            'signing_secret' => ['nullable', 'string', 'min:16', 'max:255'],
            'events' => ['nullable', 'array'],
            'events.*' => ['string', 'max:120'],
            'timeout_seconds' => ['nullable', 'integer', 'min:2', 'max:60'],
            'max_attempts' => ['nullable', 'integer', 'min:1', 'max:10'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $outboundWebhook->update($validated);

        return response()->json([
            'message' => 'Webhook atualizado com sucesso.',
            'data' => $outboundWebhook->refresh()->load('createdBy:id,name,email'),
        ]);
    }

    public function destroy(Request $request, OutboundWebhook $outboundWebhook): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $outboundWebhook->delete();

        return response()->json([
            'message' => 'Webhook removido com sucesso.',
        ]);
    }

    public function deliveries(Request $request, OutboundWebhook $outboundWebhook): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $rows = $outboundWebhook->deliveries()
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        return response()->json([
            'data' => $rows,
        ]);
    }

    public function test(Request $request, OutboundWebhook $outboundWebhook, OutboundWebhookService $service): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $payload = [
            'event' => 'system.webhook.test',
            'generated_at' => now()->toISOString(),
            'triggered_by' => [
                'id' => (int) $request->user()->id,
                'name' => (string) $request->user()->name,
                'email' => (string) $request->user()->email,
            ],
        ];

        $delivery = $service->queueDelivery($outboundWebhook, 'system.webhook.test', $payload);

        return response()->json([
            'message' => 'Disparo de teste enfileirado.',
            'delivery_id' => (int) $delivery->id,
        ]);
    }

    public function retryDelivery(
        Request $request,
        OutboundWebhook $outboundWebhook,
        WebhookDelivery $webhookDelivery,
        OutboundWebhookService $service,
    ): JsonResponse {
        abort_unless($request->user()?->isMasterAdmin(), 403);
        abort_unless((int) $webhookDelivery->outbound_webhook_id === (int) $outboundWebhook->id, 404);

        if ($webhookDelivery->is_success) {
            return response()->json([
                'message' => 'Este delivery já foi entregue com sucesso.',
                'delivery_id' => (int) $webhookDelivery->id,
            ]);
        }

        $retry = $service->retryDelivery($outboundWebhook, $webhookDelivery);

        return response()->json([
            'message' => 'Reenvio enfileirado com sucesso.',
            'delivery_id' => (int) $retry->id,
            'retries_from_delivery_id' => (int) $webhookDelivery->id,
        ]);
    }

    public function retryFailed(
        Request $request,
        OutboundWebhook $outboundWebhook,
        OutboundWebhookService $service,
    ): JsonResponse {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $limit = max(1, min(80, (int) $request->integer('limit', 20)));

        $failedRows = $outboundWebhook->deliveries()
            ->where('is_success', false)
            ->whereNotNull('dead_lettered_at')
            ->latest('id')
            ->limit($limit)
            ->get();

        $queued = 0;
        foreach ($failedRows as $failedRow) {
            $service->retryDelivery($outboundWebhook, $failedRow);
            $queued++;
        }

        return response()->json([
            'message' => 'Reenvios em lote enfileirados com sucesso.',
            'queued' => $queued,
        ]);
    }
}
