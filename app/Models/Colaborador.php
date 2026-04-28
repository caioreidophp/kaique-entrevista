<?php

namespace App\Models;

use App\Support\TransportCache;
use Carbon\CarbonImmutable;
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
        'adiantamento_salarial',
        'cpf',
        'cpf_hash',
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
        'cnh_attachment_path',
        'cnh_attachment_original_name',
        'work_card_attachment_path',
        'work_card_attachment_original_name',
    ];

    /**
     * @var array<int, string>
     */
    protected $appends = [
        'foto_3x4_url',
        'cnh_attachment_url',
        'work_card_attachment_url',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'ativo' => 'boolean',
            'adiantamento_salarial' => 'boolean',
            'cpf' => 'encrypted',
            'rg' => 'encrypted',
            'cnh' => 'encrypted',
            'validade_cnh' => 'date',
            'validade_exame_toxicologico' => 'date',
            'data_nascimento' => 'date',
            'data_admissao' => 'date',
            'data_demissao' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (self $colaborador): void {
            $colaborador->sexo = 'M';

            $currentCpf = $colaborador->cpf;
            $normalizedCpf = preg_replace('/\D+/', '', (string) ($currentCpf ?? '')) ?: null;

            if ($currentCpf !== $normalizedCpf) {
                $colaborador->cpf = $normalizedCpf;
            }

            $colaborador->cpf_hash = $normalizedCpf ? hash('sha256', $normalizedCpf) : null;
        });

        static::deleting(function (self $colaborador): void {
            foreach ([
                $colaborador->foto_3x4_path,
                $colaborador->cnh_attachment_path,
                $colaborador->work_card_attachment_path,
            ] as $path) {
                $normalizedPath = trim((string) $path);

                if ($normalizedPath !== '') {
                    Storage::disk('public')->delete($normalizedPath);
                }
            }
        });

        static::updated(function (self $colaborador): void {
            if (! $colaborador->wasChanged('data_admissao')) {
                return;
            }

            if (! $colaborador->data_admissao) {
                return;
            }

            self::recalculateVacationAcquisitionPeriods($colaborador);
        });

        $bumpCaches = static function (): void {
            TransportCache::bumpMany(['master-data', 'registry', 'home', 'payroll', 'vacations', 'programming', 'fines']);
        };

        static::saved($bumpCaches);
        static::deleted($bumpCaches);
    }

    private static function recalculateVacationAcquisitionPeriods(self $colaborador): void
    {
        $admissao = CarbonImmutable::parse($colaborador->data_admissao->toDateString());

        $lancamentos = FeriasLancamento::query()
            ->where('colaborador_id', (int) $colaborador->id)
            ->orderBy('data_inicio')
            ->orderBy('id')
            ->get(['id']);

        foreach ($lancamentos as $index => $lancamento) {
            $periodoInicio = $admissao->addYearsNoOverflow($index);
            $periodoFim = $periodoInicio->addYear()->subDay();

            FeriasLancamento::query()
                ->whereKey((int) $lancamento->id)
                ->update([
                    'periodo_aquisitivo_inicio' => $periodoInicio->toDateString(),
                    'periodo_aquisitivo_fim' => $periodoFim->toDateString(),
                ]);
        }
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

    public function pensoes(): HasMany
    {
        return $this->hasMany(PensaoColaborador::class);
    }

    public function feriasLancamentos(): HasMany
    {
        return $this->hasMany(FeriasLancamento::class, 'colaborador_id');
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

        $path = ltrim($this->foto_3x4_path, '/');
        $version = $this->updated_at?->timestamp ?? time();

        return '/storage/'.$path.'?v='.$version;
    }

    public function getCnhAttachmentUrlAttribute(): ?string
    {
        if (! $this->cnh_attachment_path) {
            return null;
        }

        return '/storage/'.ltrim((string) $this->cnh_attachment_path, '/');
    }

    public function getWorkCardAttachmentUrlAttribute(): ?string
    {
        if (! $this->work_card_attachment_path) {
            return null;
        }

        return '/storage/'.ltrim((string) $this->work_card_attachment_path, '/');
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
