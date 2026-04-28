<?php

namespace App\Models;

use App\Support\TransportCache;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class FreightSpotEntry extends Model
{
    use HasFactory, LogsActivity;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'data',
        'unidade_origem_id',
        'autor_id',
        'frete_spot',
        'cargas',
        'aves',
        'km_rodado',
        'obs',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'data' => 'date',
            'frete_spot' => 'decimal:2',
            'km_rodado' => 'decimal:2',
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

    public function unidadeOrigem(): BelongsTo
    {
        return $this->belongsTo(Unidade::class, 'unidade_origem_id');
    }

    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'autor_id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly([
                'data',
                'unidade_origem_id',
                'frete_spot',
                'cargas',
                'aves',
                'km_rodado',
                'obs',
            ])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('frete-spot')
            ->setDescriptionForEvent(fn (string $eventName) => match ($eventName) {
                'created' => 'Frete spot criado',
                'updated' => 'Frete spot atualizado',
                'deleted' => 'Frete spot removido',
                default => $eventName,
            });
    }
}
