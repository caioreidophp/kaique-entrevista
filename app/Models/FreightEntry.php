<?php

namespace App\Models;

use App\Support\TransportCache;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
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
        'km_terceiros',
        'frete_terceiros',
        'viagens_terceiros',
        'aves_terceiros',
        'frete_liquido',
        'cargas_liq',
        'aves_liq',
        'kaique',
        'vdm',
        'frete_programado',
        'km_programado',
        'cargas_programadas',
        'aves_programadas',
        'cargas_canceladas_escaladas',
        'nao_escaladas',
        'placas',
        'obs',
        'programado_frete',
        'programado_viagens',
        'programado_aves',
        'programado_km',
        'kaique_geral_frete',
        'kaique_geral_viagens',
        'kaique_geral_aves',
        'kaique_geral_km',
        'terceiros_frete',
        'terceiros_viagens',
        'terceiros_aves',
        'terceiros_km',
        'abatedouro_frete',
        'abatedouro_viagens',
        'abatedouro_aves',
        'abatedouro_km',
        'canceladas_sem_escalar_frete',
        'canceladas_sem_escalar_viagens',
        'canceladas_sem_escalar_aves',
        'canceladas_sem_escalar_km',
        'canceladas_escaladas_frete',
        'canceladas_escaladas_viagens',
        'canceladas_escaladas_aves',
        'canceladas_escaladas_km',
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
            'km_terceiros' => 'decimal:2',
            'frete_terceiros' => 'decimal:2',
            'frete_liquido' => 'decimal:2',
            'kaique' => 'decimal:2',
            'vdm' => 'decimal:2',
            'frete_programado' => 'decimal:2',
            'km_programado' => 'decimal:2',
            'programado_frete' => 'decimal:2',
            'programado_km' => 'decimal:2',
            'kaique_geral_frete' => 'decimal:2',
            'kaique_geral_km' => 'decimal:2',
            'terceiros_frete' => 'decimal:2',
            'terceiros_km' => 'decimal:2',
            'abatedouro_frete' => 'decimal:2',
            'abatedouro_km' => 'decimal:2',
            'canceladas_sem_escalar_frete' => 'decimal:2',
            'canceladas_sem_escalar_km' => 'decimal:2',
            'canceladas_escaladas_frete' => 'decimal:2',
            'canceladas_escaladas_km' => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        $bumpCaches = static function (): void {
            TransportCache::bumpMany(['freight', 'home']);
        };

        static::saved($bumpCaches);
        static::deleted($bumpCaches);
    }

    public function unidade(): BelongsTo
    {
        return $this->belongsTo(Unidade::class);
    }

    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'autor_id');
    }

    public function canceledLoads(): HasMany
    {
        return $this->hasMany(FreightCanceledLoad::class, 'freight_entry_id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly([
                'data',
                'unidade_id',
                'veiculos',
                'programado_frete',
                'programado_viagens',
                'programado_aves',
                'programado_km',
                'kaique_geral_frete',
                'kaique_geral_viagens',
                'kaique_geral_aves',
                'kaique_geral_km',
                'terceiros_frete',
                'terceiros_viagens',
                'terceiros_aves',
                'terceiros_km',
                'abatedouro_frete',
                'abatedouro_viagens',
                'abatedouro_aves',
                'abatedouro_km',
                'canceladas_sem_escalar_frete',
                'canceladas_sem_escalar_viagens',
                'canceladas_sem_escalar_aves',
                'canceladas_sem_escalar_km',
                'canceladas_escaladas_frete',
                'canceladas_escaladas_viagens',
                'canceladas_escaladas_aves',
                'canceladas_escaladas_km',
            ])
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
