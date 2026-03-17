<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FreightSpotEntry extends Model
{
    use HasFactory;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'data',
        'unidade_origem_id',
        'autor_id',
        'frete_spot',
        'cargas',
        'aves',
        'km_rodado',
        'obs',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'data' => 'date',
            'frete_spot' => 'decimal:2',
            'km_rodado' => 'decimal:2',
        ];
    }

    public function unidadeOrigem(): BelongsTo
    {
        return $this->belongsTo(Unidade::class, 'unidade_origem_id');
    }

    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'autor_id');
    }
}
