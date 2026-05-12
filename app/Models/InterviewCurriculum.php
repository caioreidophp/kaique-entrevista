<?php

namespace App\Models;

use App\Enums\InterviewCurriculumStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class InterviewCurriculum extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'interview_curriculums';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'author_id',
        'full_name',
        'phone',
        'role_name',
        'unit_name',
        'observacao',
        'interview_date',
        'interview_time',
        'discard_reason',
        'treatment_notes',
        'treated_at',
        'treated_by',
        'confirmed_interview_date',
        'confirmed_interview_time',
        'confirmation_notes',
        'document_path',
        'document_original_name',
        'cnh_attachment_path',
        'cnh_attachment_original_name',
        'work_card_attachment_path',
        'work_card_attachment_original_name',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => InterviewCurriculumStatus::class,
            'interview_date' => 'date',
            'treated_at' => 'datetime',
            'confirmed_interview_date' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::deleting(function (InterviewCurriculum $curriculum): void {
            $paths = [
                trim((string) $curriculum->document_path),
                trim((string) $curriculum->cnh_attachment_path),
                trim((string) $curriculum->work_card_attachment_path),
            ];

            foreach ($paths as $path) {
                if ($path !== '') {
                    Storage::disk('public')->delete($path);
                }
            }
        });
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function treatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'treated_by');
    }

    public function interviews(): HasMany
    {
        return $this->hasMany(DriverInterview::class, 'curriculum_id');
    }

    public function linkedInterview(): HasOne
    {
        return $this->hasOne(DriverInterview::class, 'curriculum_id')->latest('id');
    }
}
