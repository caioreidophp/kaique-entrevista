<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class FinancialApproval extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'request_uuid',
        'action_key',
        'request_hash',
        'status',
        'summary',
        'requester_id',
        'approver_id',
        'execution_token',
        'token_expires_at',
        'reviewed_at',
        'consumed_at',
        'expires_at',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'summary' => 'array',
            'token_expires_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'consumed_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_id');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly([
                'action_key',
                'status',
                'requester_id',
                'approver_id',
                'token_expires_at',
                'reviewed_at',
                'consumed_at',
                'expires_at',
                'reason',
            ])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('aprovacao-financeira')
            ->setDescriptionForEvent(fn (string $eventName) => match ($eventName) {
                'created' => 'Solicitacao financeira criada',
                'updated' => 'Solicitacao financeira atualizada',
                'deleted' => 'Solicitacao financeira removida',
                default => $eventName,
            });
    }
}
