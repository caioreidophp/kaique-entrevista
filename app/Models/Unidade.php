<?php

namespace App\Models;

use App\Support\TransportCache;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Unidade extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'nome',
        'slug',
    ];

    protected static function booted(): void
    {
        $bumpCaches = static function (): void {
            TransportCache::bumpMany(['master-data', 'home', 'registry', 'payroll', 'freight', 'programming', 'fines', 'vacations']);
        };

        static::saved($bumpCaches);
        static::deleted($bumpCaches);
    }

    public function colaboradores(): HasMany
    {
        return $this->hasMany(Colaborador::class);
    }

    public function pagamentos(): HasMany
    {
        return $this->hasMany(Pagamento::class);
    }
}
