<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecordComment extends Model
{
    use HasFactory;

    protected $fillable = [
        'module_key',
        'record_id',
        'body',
        'mentioned_user_ids',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'record_id' => 'integer',
            'mentioned_user_ids' => 'array',
        ];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
