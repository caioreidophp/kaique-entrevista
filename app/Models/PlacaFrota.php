<?php

namespace App\Models;

use App\Support\TransportCache;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlacaFrota extends Model
{
    use HasFactory;

    protected $table = 'placas_frota';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'placa',
        'unidade_id',
    ];

    protected static function booted(): void
    {
        $bumpCaches = static function (): void {
            TransportCache::bumpMany(['master-data', 'registry', 'programming', 'fines']);
        };

        static::saved($bumpCaches);
        static::deleted($bumpCaches);
    }

    public function unidade(): BelongsTo
    {
        return $this->belongsTo(Unidade::class);
    }
}
