<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AutomatedReminderDelivery extends Model
{
    use HasFactory;

    protected $fillable = [
        'automated_reminder_rule_id',
        'trigger_key',
        'channel',
        'recipient',
        'status',
        'subject',
        'message',
        'http_status',
        'provider_response',
        'error_message',
        'context',
        'dispatched_at',
    ];

    protected function casts(): array
    {
        return [
            'context' => 'array',
            'dispatched_at' => 'datetime',
        ];
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(AutomatedReminderRule::class, 'automated_reminder_rule_id');
    }
}

