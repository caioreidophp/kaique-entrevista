<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Pagamento extends Model
{
    use HasFactory, LogsActivity;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'colaborador_id',
        'unidade_id',
        'autor_id',
        'competencia_mes',
        'competencia_ano',
        'valor',
        'observacao',
        'lancado_em',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'competencia_mes' => 'integer',
            'competencia_ano' => 'integer',
            'valor' => 'decimal:2',
            'lancado_em' => 'datetime',
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

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['colaborador_id', 'unidade_id', 'competencia_mes', 'competencia_ano', 'valor', 'observacao'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('folha')
            ->setDescriptionForEvent(fn (string $eventName) => match ($eventName) {
                'created' => 'Pagamento lançado',
                'updated' => 'Pagamento atualizado',
                'deleted' => 'Pagamento excluído',
                default => $eventName,
            });
    }
}
