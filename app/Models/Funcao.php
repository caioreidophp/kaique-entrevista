<?php

namespace App\Models;

use App\Support\TransportCache;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Funcao extends Model
{
    use HasFactory, LogsActivity, SoftDeletes;

    protected $table = 'funcoes';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'nome',
        'descricao',
        'ativo',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'ativo' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        parent::booted();

        $bumpCaches = static function (): void {
            TransportCache::bumpMany(['master-data', 'registry', 'home', 'vacations']);
        };

        static::saved($bumpCaches);
        static::deleted($bumpCaches);
    }

    public function colaboradores(): HasMany
    {
        return $this->hasMany(Colaborador::class);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('cadastro')
            ->setDescriptionForEvent(fn (string $eventName) => match ($eventName) {
                'created' => 'Função criada',
                'updated' => 'Função atualizada',
                'deleted' => 'Função excluída',
                default => $eventName,
            });
    }
}
