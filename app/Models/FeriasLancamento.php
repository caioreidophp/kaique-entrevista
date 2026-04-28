<?php

namespace App\Models;

use App\Support\TransportCache;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class FeriasLancamento extends Model
{
    use HasFactory, LogsActivity;

    protected $table = 'ferias_lancamentos';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'colaborador_id',
        'unidade_id',
        'funcao_id',
        'autor_id',
        'tipo',
        'com_abono',
        'dias_ferias',
        'data_inicio',
        'data_fim',
        'periodo_aquisitivo_inicio',
        'periodo_aquisitivo_fim',
        'observacoes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'tipo' => 'string',
            'com_abono' => 'boolean',
            'dias_ferias' => 'integer',
            'data_inicio' => 'date',
            'data_fim' => 'date',
            'periodo_aquisitivo_inicio' => 'date',
            'periodo_aquisitivo_fim' => 'date',
            'observacoes' => 'string',
        ];
    }

    protected static function booted(): void
    {
        $bumpCaches = static function (): void {
            TransportCache::bumpMany(['vacations', 'home']);
        };

        static::saved($bumpCaches);
        static::deleted($bumpCaches);
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function unidade(): BelongsTo
    {
        return $this->belongsTo(Unidade::class);
    }

    public function funcao(): BelongsTo
    {
        return $this->belongsTo(Funcao::class);
    }

    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'autor_id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly([
                'colaborador_id',
                'unidade_id',
                'funcao_id',
                'tipo',
                'com_abono',
                'dias_ferias',
                'data_inicio',
                'data_fim',
                'periodo_aquisitivo_inicio',
                'periodo_aquisitivo_fim',
                'observacoes',
            ])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('ferias')
            ->setDescriptionForEvent(fn (string $eventName) => match ($eventName) {
                'created' => 'Lancamento de ferias criado',
                'updated' => 'Lancamento de ferias atualizado',
                'deleted' => 'Lancamento de ferias removido',
                default => $eventName,
            });
    }
}
