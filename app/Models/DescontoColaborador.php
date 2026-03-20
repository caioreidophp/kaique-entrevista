<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DescontoColaborador extends Model
{
    use HasFactory;

    protected $table = 'descontos_colaboradores';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'colaborador_id',
        'unidade_id',
        'autor_id',
        'descricao',
        'tipo_saida',
        'tipo_saida_prioridades',
        'forma_pagamento',
        'valor',
        'parcelado',
        'total_parcelas',
        'parcela_atual',
        'data_referencia',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'valor' => 'decimal:2',
            'parcelado' => 'boolean',
            'tipo_saida_prioridades' => 'array',
            'data_referencia' => 'date',
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

    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'autor_id');
    }
}
