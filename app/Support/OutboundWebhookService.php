<?php

namespace App\Support;

use App\Jobs\DeliverOutboundWebhookJob;
use App\Models\OutboundWebhook;
use App\Models\WebhookDelivery;

class OutboundWebhookService
{
    public function dispatch(string $eventName, array $payload): void
    {
        if (! (bool) config('transport_features.outbound_webhooks', true)) {
            return;
        }

        $hooks = OutboundWebhook::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->get();

        foreach ($hooks as $hook) {
            if (! $hook->supportsEvent($eventName)) {
                continue;
            }

            $this->queueDelivery($hook, $eventName, $payload);
        }
    }

    public function queueDelivery(OutboundWebhook $hook, string $eventName, array $payload): WebhookDelivery
    {
        $delivery = WebhookDelivery::query()->create([
            'outbound_webhook_id' => (int) $hook->id,
            'event_name' => $eventName,
            'attempt' => 1,
            'is_success' => false,
            'payload' => $payload,
        ]);

        DeliverOutboundWebhookJob::dispatch((int) $delivery->id);

        return $delivery;
    }
}
