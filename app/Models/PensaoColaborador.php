<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PensaoColaborador extends Model
{
    use HasFactory;

    protected $table = 'pensoes_colaboradores';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'colaborador_id',
        'unidade_id',
        'autor_id',
        'nome_beneficiaria',
        'cpf_beneficiaria',
        'valor',
        'nome_banco',
        'numero_banco',
        'numero_agencia',
        'tipo_conta',
        'numero_conta',
        'tipo_chave_pix',
        'chave_pix',
        'observacao',
        'ativo',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'valor' => 'decimal:2',
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
