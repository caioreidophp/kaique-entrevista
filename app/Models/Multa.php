<?php

namespace App\Models;

use App\Support\TransportCache;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Multa extends Model
{
    use HasFactory;

    protected $table = 'multas';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'data',
        'hora',
        'tipo_registro',
        'unidade_id',
        'placa_frota_id',
        'multa_infracao_id',
        'multa_orgao_autuador_id',
        'colaborador_id',
        'descricao',
        'numero_auto_infracao',
        'indicado_condutor',
        'culpa',
        'valor',
        'tipo_valor',
        'vencimento',
        'status',
        'descontar',
        'autor_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'data' => 'date',
            'hora' => 'string',
            'valor' => 'decimal:2',
            'vencimento' => 'date',
            'indicado_condutor' => 'boolean',
            'descontar' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        $bumpCaches = static function (): void {
            TransportCache::bumpMany(['fines', 'home']);
        };

        static::saved($bumpCaches);
        static::deleted($bumpCaches);
    }

    public function unidade(): BelongsTo
    {
        return $this->belongsTo(Unidade::class);
    }

    public function placaFrota(): BelongsTo
    {
        return $this->belongsTo(PlacaFrota::class);
    }

    public function infracao(): BelongsTo
    {
        return $this->belongsTo(MultaInfracao::class, 'multa_infracao_id');
    }

    public function orgaoAutuador(): BelongsTo
    {
        return $this->belongsTo(MultaOrgaoAutuador::class, 'multa_orgao_autuador_id');
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'autor_id');
    }
}
