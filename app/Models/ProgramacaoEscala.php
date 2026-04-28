<?php

namespace App\Models;

use App\Support\TransportCache;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class ProgramacaoEscala extends Model
{
    use HasFactory, LogsActivity;

    protected $table = 'programacao_escalas';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'programacao_viagem_id',
        'colaborador_id',
        'placa_frota_id',
        'autor_id',
        'observacoes',
    ];

    protected static function booted(): void
    {
        $bumpCaches = static function (): void {
            TransportCache::bumpMany(['programming', 'home']);
        };

        static::saved($bumpCaches);
        static::deleted($bumpCaches);
    }

    public function viagem(): BelongsTo
    {
        return $this->belongsTo(ProgramacaoViagem::class, 'programacao_viagem_id');
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function placaFrota(): BelongsTo
    {
        return $this->belongsTo(PlacaFrota::class);
    }

    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'autor_id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly([
                'programacao_viagem_id',
                'colaborador_id',
                'placa_frota_id',
                'observacoes',
            ])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('programacao')
            ->setDescriptionForEvent(fn (string $eventName) => match ($eventName) {
                'created' => 'Escala de viagem criada',
                'updated' => 'Escala de viagem atualizada',
                'deleted' => 'Escala de viagem removida',
                default => $eventName,
            });
    }
}
