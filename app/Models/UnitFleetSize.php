<?php

namespace App\Models;

use App\Support\TransportCache;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UnitFleetSize extends Model
{
    use HasFactory;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'unidade_id',
        'reference_month',
        'fleet_size',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'reference_month' => 'date',
            'fleet_size' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        $bumpCaches = static function (): void {
            TransportCache::bumpMany(['freight', 'home', 'registry']);
        };

        static::saved($bumpCaches);
        static::deleted($bumpCaches);
    }

    public function unidade(): BelongsTo
    {
        return $this->belongsTo(Unidade::class, 'unidade_id');
    }
}
