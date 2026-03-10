<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class TipoPagamento extends Model
{
    use HasFactory, LogsActivity, SoftDeletes;

    protected $table = 'tipos_pagamento';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'nome',
        'gera_encargos',
        'categoria',
        'forma_pagamento',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'gera_encargos' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('cadastro')
            ->setDescriptionForEvent(fn (string $eventName) => match ($eventName) {
                'created' => 'Tipo de pagamento criado',
                'updated' => 'Tipo de pagamento atualizado',
                'deleted' => 'Tipo de pagamento excluido',
                default => $eventName,
            });
    }
}
