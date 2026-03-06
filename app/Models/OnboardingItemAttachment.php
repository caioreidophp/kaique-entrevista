<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OnboardingItemAttachment extends Model
{
    use HasFactory;

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'onboarding_item_id',
        'path',
        'original_name',
        'mime',
        'size',
        'uploaded_by',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(OnboardingItem::class, 'onboarding_item_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
