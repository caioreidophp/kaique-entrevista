<?php

namespace App\Jobs;

use App\Models\WebhookDelivery;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Throwable;

class DeliverOutboundWebhookJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    /**
     * @var array<int, int>
     */
    public array $backoff = [30, 90, 300, 900];

    public function __construct(private readonly int $deliveryId)
    {
    }

    public function handle(): void
    {
        $delivery = WebhookDelivery::query()
            ->with('webhook')
            ->find($this->deliveryId);

        if (! $delivery || ! $delivery->webhook || ! $delivery->webhook->is_active) {
            return;
        }

        $webhook = $delivery->webhook;
        $payload = is_array($delivery->payload) ? $delivery->payload : [];
        $payloadJson = (string) json_encode($payload);
        $signature = hash_hmac('sha256', $payloadJson, (string) $webhook->signing_secret);

        $delivery->update([
            'attempt' => $this->attempts(),
            'signature' => $signature,
        ]);

        $response = Http::timeout(max((int) $webhook->timeout_seconds, 1))
            ->acceptJson()
            ->withHeaders([
                'X-Kaique-Webhook-Event' => (string) $delivery->event_name,
                'X-Kaique-Signature' => $signature,
                'X-Kaique-Delivery-Id' => (string) $delivery->id,
            ])
            ->post((string) $webhook->target_url, $payload);

        $responseBody = mb_substr((string) $response->body(), 0, 4000);

        $delivery->update([
            'http_status' => $response->status(),
            'response_body' => $responseBody,
            'error_message' => $response->successful() ? null : 'HTTP '.$response->status(),
            'is_success' => $response->successful(),
            'delivered_at' => $response->successful() ? now() : null,
            'next_retry_at' => $response->successful() ? null : now()->addSeconds(60),
        ]);

        if ($response->successful()) {
            $webhook->update([
                'last_triggered_at' => now(),
            ]);

            return;
        }

        throw new \RuntimeException('Webhook delivery failed with status '.$response->status());
    }

    public function failed(?Throwable $exception): void
    {
        $delivery = WebhookDelivery::query()->find($this->deliveryId);

        if (! $delivery) {
            return;
        }

        if (! $delivery->is_success && ! $delivery->dead_lettered_at) {
            $delivery->update([
                'dead_lettered_at' => now(),
                'error_message' => $exception ? mb_substr($exception->getMessage(), 0, 2000) : $delivery->error_message,
                'next_retry_at' => null,
            ]);

            $delivery->webhook()?->increment('failed_deliveries_count');
        }
    }
}
