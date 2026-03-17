<?php

namespace App\Models;

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

    public function unidade(): BelongsTo
    {
        return $this->belongsTo(Unidade::class);
    }
}
