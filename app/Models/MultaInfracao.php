<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MultaInfracao extends Model
{
    use HasFactory;

    protected $table = 'multa_infracoes';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'nome',
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

    public function multas(): HasMany
    {
        return $this->hasMany(Multa::class, 'multa_infracao_id');
    }
}
