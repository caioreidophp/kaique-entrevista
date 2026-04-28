<?php

namespace App\Models;

use App\Support\TransportCache;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserAccessScope extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'module_key',
        'data_scope',
        'allowed_unit_ids',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'allowed_unit_ids' => 'array',
            'metadata' => 'array',
        ];
    }

    protected static function booted(): void
    {
        $bumpScopes = static function (): void {
            TransportCache::bumpMany(['permissions', 'home']);
        };

        static::saved($bumpScopes);
        static::deleted($bumpScopes);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
