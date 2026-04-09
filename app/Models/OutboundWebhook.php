<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OutboundWebhook extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'target_url',
        'signing_secret',
        'events',
        'timeout_seconds',
        'max_attempts',
        'is_active',
        'last_triggered_at',
        'failed_deliveries_count',
        'created_by_user_id',
    ];

    protected $hidden = [
        'signing_secret',
    ];

    protected function casts(): array
    {
        return [
            'events' => 'array',
            'is_active' => 'boolean',
            'last_triggered_at' => 'datetime',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(WebhookDelivery::class);
    }

    public function supportsEvent(string $eventName): bool
    {
        $events = is_array($this->events) ? $this->events : [];

        if ($events === [] || in_array('*', $events, true)) {
            return true;
        }

        return in_array($eventName, $events, true);
    }
}
