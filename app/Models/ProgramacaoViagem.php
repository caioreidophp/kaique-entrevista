<?php

namespace App\Models;

use App\Support\TransportCache;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ProgramacaoViagem extends Model
{
    use HasFactory;

    protected $table = 'programacao_viagens';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'data_viagem',
        'unidade_id',
        'codigo_viagem',
        'origem',
        'destino',
        'aviario',
        'cidade',
        'distancia_km',
        'equipe',
        'aves',
        'numero_carga',
        'hora_inicio_prevista',
        'hora_carregamento_prevista',
        'hora_fim_prevista',
        'jornada_horas_prevista',
        'observacoes',
        'import_lote',
        'ordem_importacao',
        'autor_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'data_viagem' => 'date',
            'distancia_km' => 'decimal:2',
            'aves' => 'integer',
            'jornada_horas_prevista' => 'decimal:2',
            'ordem_importacao' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        $bumpCaches = static function (): void {
            TransportCache::bumpMany(['programming', 'home']);
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

    public function escala(): HasOne
    {
        return $this->hasOne(ProgramacaoEscala::class, 'programacao_viagem_id');
    }
}
