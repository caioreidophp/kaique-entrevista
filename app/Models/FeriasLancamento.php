<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeriasLancamento extends Model
{
    use HasFactory;

    protected $table = 'ferias_lancamentos';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'colaborador_id',
        'unidade_id',
        'funcao_id',
        'autor_id',
        'com_abono',
        'dias_ferias',
        'data_inicio',
        'data_fim',
        'periodo_aquisitivo_inicio',
        'periodo_aquisitivo_fim',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'com_abono' => 'boolean',
            'dias_ferias' => 'integer',
            'data_inicio' => 'date',
            'data_fim' => 'date',
            'periodo_aquisitivo_inicio' => 'date',
            'periodo_aquisitivo_fim' => 'date',
        ];
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
}
