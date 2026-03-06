<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class FreightEntry extends Model
{
    use HasFactory, LogsActivity;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'data',
        'unidade_id',
        'autor_id',
        'frete_total',
        'cargas',
        'aves',
        'veiculos',
        'km_rodado',
        'frete_terceiros',
        'viagens_terceiros',
        'aves_terceiros',
        'frete_liquido',
        'cargas_liq',
        'aves_liq',
        'kaique',
        'vdm',
        'frete_programado',
        'cargas_programadas',
        'aves_programadas',
        'cargas_canceladas_escaladas',
        'nao_escaladas',
        'placas',
        'obs',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'data' => 'date',
            'frete_total' => 'decimal:2',
            'km_rodado' => 'decimal:2',
            'frete_terceiros' => 'decimal:2',
            'frete_liquido' => 'decimal:2',
            'kaique' => 'decimal:2',
            'vdm' => 'decimal:2',
            'frete_programado' => 'decimal:2',
        ];
    }

    public function unidade(): BelongsTo
    {
        return $this->belongsTo(Unidade::class);
    }

    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'autor_id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['data', 'unidade_id', 'frete_total', 'frete_liquido', 'cargas', 'aves', 'veiculos', 'km_rodado'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('frete')
            ->setDescriptionForEvent(fn (string $eventName) => match ($eventName) {
                'created' => 'Lançamento de frete criado',
                'updated' => 'Lançamento de frete atualizado',
                'deleted' => 'Lançamento de frete excluído',
                default => $eventName,
            });
    }
}
