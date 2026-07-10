<?php

namespace App\Models;

use App\Models\Concerns\HidesDemoDataForRealUsers;
use App\Support\TransportCache;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class FreightDisplacement extends Model
{
    use HasFactory, HidesDemoDataForRealUsers, LogsActivity;

    public const STATUS_PENDENTE = 'pendente';
    public const STATUS_CALCULADO = 'calculado';
    public const STATUS_AGUARDANDO_PAGAMENTO = 'aguardando_pagamento';
    public const STATUS_PAGO = 'pago';

    /**
     * @var array<int, string>
     */
    public const STATUSES = [
        self::STATUS_PENDENTE,
        self::STATUS_CALCULADO,
        self::STATUS_AGUARDANDO_PAGAMENTO,
        self::STATUS_PAGO,
    ];

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'data',
        'descricao',
        'unidade_veiculos_id',
        'quantidade_caminhoes',
        'placas',
        'origem',
        'destino',
        'km_aproximado',
        'valor_aproximado',
        'unidade_pagadora_id',
        'status',
        'freight_spot_entry_id',
        'autor_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'data' => 'date',
            'km_aproximado' => 'decimal:2',
            'valor_aproximado' => 'decimal:2',
            'quantidade_caminhoes' => 'integer',
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

    public function unidadeVeiculos(): BelongsTo
    {
        return $this->belongsTo(Unidade::class, 'unidade_veiculos_id');
    }

    public function unidadePagadora(): BelongsTo
    {
        return $this->belongsTo(Unidade::class, 'unidade_pagadora_id');
    }

    public function spotEntry(): BelongsTo
    {
        return $this->belongsTo(FreightSpotEntry::class, 'freight_spot_entry_id');
    }

    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'autor_id');
    }

    public function isPaid(): bool
    {
        return $this->status === self::STATUS_PAGO;
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly([
                'data',
                'descricao',
                'unidade_veiculos_id',
                'quantidade_caminhoes',
                'placas',
                'origem',
                'destino',
                'km_aproximado',
                'valor_aproximado',
                'unidade_pagadora_id',
                'status',
                'freight_spot_entry_id',
            ])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('frete-deslocamento')
            ->setDescriptionForEvent(fn (string $eventName) => match ($eventName) {
                'created' => 'Deslocamento criado',
                'updated' => 'Deslocamento atualizado',
                'deleted' => 'Deslocamento removido',
                default => $eventName,
            });
    }
}
