<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Aviario extends Model
{
    use HasFactory;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'nome',
        'cidade',
        'km',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'km' => 'decimal:2',
        ];
    }
}
