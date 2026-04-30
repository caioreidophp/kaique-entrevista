<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AutomatedReminderRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'trigger_key',
        'channel',
        'recipients',
        'threshold_days',
        'webhook_url',
        'message_prefix',
        'is_active',
        'last_run_at',
        'created_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'recipients' => 'array',
            'threshold_days' => 'integer',
            'is_active' => 'boolean',
            'last_run_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(AutomatedReminderDelivery::class, 'automated_reminder_rule_id');
    }
}

