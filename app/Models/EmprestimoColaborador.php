<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmprestimoColaborador extends Model
{
    use HasFactory;

    protected $table = 'emprestimos_colaboradores';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'colaborador_id',
        'unidade_id',
        'autor_id',
        'descricao',
        'valor_total',
        'valor_parcela',
        'total_parcelas',
        'parcelas_pagas',
        'data_inicio',
        'ativo',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'valor_total' => 'decimal:2',
            'valor_parcela' => 'decimal:2',
            'data_inicio' => 'date',
            'ativo' => 'boolean',
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
