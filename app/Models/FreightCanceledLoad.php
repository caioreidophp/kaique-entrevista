<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FreightCanceledLoad extends Model
{
    use HasFactory;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'freight_entry_id',
        'batch_id',
        'unidade_id',
        'autor_id',
        'data',
        'placa',
        'aviario',
        'valor',
        'n_viagem',
        'obs',
        'status',
        'data_pagamento',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'data' => 'date',
            'valor' => 'decimal:2',
            'data_pagamento' => 'date',
        ];
    }

    public function freightEntry(): BelongsTo
    {
        return $this->belongsTo(FreightEntry::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(FreightCanceledLoadBatch::class, 'batch_id');
    }

    public function unidade(): BelongsTo
    {
        return $this->belongsTo(Unidade::class);
    }

    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'autor_id');
    }
}
