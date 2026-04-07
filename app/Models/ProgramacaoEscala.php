<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProgramacaoEscala extends Model
{
    use HasFactory;

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
}
