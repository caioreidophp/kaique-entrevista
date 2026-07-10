<?php

namespace App\Models;

use App\Models\Concerns\HidesDemoDataForRealUsers;
use App\Support\TransportCache;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class PayrollPendingExtra extends Model
{
    use HasFactory, HidesDemoDataForRealUsers, LogsActivity;

    public const STATUS_PENDING = 'pendente';

    public const STATUS_FINISHED = 'finalizada';

    public const TYPE_SATURDAY = 'sabado';

    public const TYPE_HOLIDAY = 'feriado';

    public const TYPE_MAINTENANCE = 'manutencao';

    public const TYPE_TRANSFER = 'transferencia';

    public const TYPE_SPOT = 'spot';

    protected $fillable = [
        'data',
        'unidade_id',
        'descricao',
        'tipo',
        'status',
        'pagamento_id',
        'autor_id',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'date',
        ];
    }

    protected static function booted(): void
    {
        $bumpCaches = static function (): void {
            TransportCache::bumpMany(['payroll', 'home']);
        };

        static::saved($bumpCaches);
        static::deleted($bumpCaches);
    }

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    public function unidade(): BelongsTo
    {
        return $this->belongsTo(Unidade::class);
    }

    public function pagamento(): BelongsTo
    {
        return $this->belongsTo(Pagamento::class);
    }

    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'autor_id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['data', 'unidade_id', 'descricao', 'tipo', 'status', 'pagamento_id'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('folha')
            ->setDescriptionForEvent(fn (string $eventName) => match ($eventName) {
                'created' => 'Diaria/extra pendente criada',
                'updated' => 'Diaria/extra pendente atualizada',
                'deleted' => 'Diaria/extra pendente excluida',
                default => $eventName,
            });
    }
}
