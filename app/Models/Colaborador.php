<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Colaborador extends Model
{
    use HasFactory, LogsActivity, SoftDeletes;

    protected $table = 'colaboradores';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'unidade_id',
        'funcao_id',
        'user_id',
        'nome',
        'apelido',
        'sexo',
        'ativo',
        'cpf',
        'rg',
        'cnh',
        'validade_cnh',
        'validade_exame_toxicologico',
        'data_nascimento',
        'data_admissao',
        'data_demissao',
        'telefone',
        'email',
        'endereco_completo',
        'dados_bancarios_1',
        'cep',
        'logradouro',
        'numero_endereco',
        'complemento',
        'bairro',
        'cidade_uf',
        'dados_bancarios_2',
        'chave_pix',
        'nome_banco',
        'numero_banco',
        'numero_agencia',
        'tipo_conta',
        'numero_conta',
        'tipo_chave_pix',
        'banco_salario',
        'numero_agencia_salario',
        'numero_conta_salario',
        'conta_pagamento',
        'cartao_beneficio',
        'foto_3x4_path',
    ];

    /**
     * @var array<int, string>
     */
    protected $appends = [
        'foto_3x4_url',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'ativo' => 'boolean',
            'validade_cnh' => 'date',
            'validade_exame_toxicologico' => 'date',
            'data_nascimento' => 'date',
            'data_admissao' => 'date',
            'data_demissao' => 'date',
        ];
    }

    public function unidade(): BelongsTo
    {
        return $this->belongsTo(Unidade::class);
    }

    public function funcao(): BelongsTo
    {
        return $this->belongsTo(Funcao::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function pagamentos(): HasMany
    {
        return $this->hasMany(Pagamento::class);
    }

    public function descontos(): HasMany
    {
        return $this->hasMany(DescontoColaborador::class);
    }

    public function emprestimos(): HasMany
    {
        return $this->hasMany(EmprestimoColaborador::class);
    }

    public function entrevistas(): HasMany
    {
        return $this->hasMany(DriverInterview::class);
    }

    public function onboardings(): HasMany
    {
        return $this->hasMany(Onboarding::class);
    }

    public function getFoto3x4UrlAttribute(): ?string
    {
        if (! $this->foto_3x4_path) {
            return null;
        }

        return Storage::disk('public')->url($this->foto_3x4_path);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['nome', 'cpf', 'ativo', 'unidade_id', 'funcao_id', 'data_admissao', 'data_demissao'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('cadastro')
            ->setDescriptionForEvent(fn (string $eventName) => match ($eventName) {
                'created' => 'Colaborador cadastrado',
                'updated' => 'Colaborador atualizado',
                'deleted' => 'Colaborador excluído',
                default => $eventName,
            });
    }
}
