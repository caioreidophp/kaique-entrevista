<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WebhookDelivery extends Model
{
    use HasFactory;

    protected $fillable = [
        'outbound_webhook_id',
        'event_name',
        'attempt',
        'is_success',
        'http_status',
        'signature',
        'payload',
        'response_body',
        'error_message',
        'delivered_at',
        'next_retry_at',
        'dead_lettered_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'is_success' => 'boolean',
            'delivered_at' => 'datetime',
            'next_retry_at' => 'datetime',
            'dead_lettered_at' => 'datetime',
        ];
    }

    public function webhook(): BelongsTo
    {
        return $this->belongsTo(OutboundWebhook::class, 'outbound_webhook_id');
    }
}
