<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class OperationalTask extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'module_key',
        'unidade_id',
        'title',
        'description',
        'priority',
        'status',
        'due_at',
        'started_at',
        'completed_at',
        'created_by',
        'assigned_to',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'due_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function unidade(): BelongsTo
    {
        return $this->belongsTo(Unidade::class, 'unidade_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly([
                'module_key',
                'unidade_id',
                'title',
                'description',
                'priority',
                'status',
                'due_at',
                'started_at',
                'completed_at',
                'created_by',
                'assigned_to',
            ])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('operational-task')
            ->setDescriptionForEvent(fn (string $eventName) => match ($eventName) {
                'created' => 'Tarefa operacional criada',
                'updated' => 'Tarefa operacional atualizada',
                'deleted' => 'Tarefa operacional removida',
                default => $eventName,
            });
    }
}
