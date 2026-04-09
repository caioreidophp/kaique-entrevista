<?php

namespace App\Models;

use App\Enums\CandidateInterest;
use App\Enums\GuepStatus;
use App\Enums\HrStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class DriverInterview extends Model
{
    use HasFactory, LogsActivity, SoftDeletes;

    protected static function booted(): void
    {
        static::deleting(function (DriverInterview $interview): void {
            $interview->onboarding()?->delete();

            foreach ([
                'candidate_photo_path',
                'cnh_attachment_path',
                'work_card_attachment_path',
                'curriculum_path',
            ] as $pathField) {
                $path = (string) ($interview->{$pathField} ?? '');

                if ($path !== '') {
                    Storage::disk('public')->delete($path);
                }
            }
        });
    }

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'author_id',
        'full_name',
        'preferred_name',
        'birth_date',
        'phone',
        'email',
        'city',
        'cargo_pretendido',
        'hiring_unidade_id',
        'curriculum_id',
        'marital_status',
        'has_children',
        'children_situation',
        'cpf',
        'rg',
        'cnh_number',
        'cnh_category',
        'cnh_expiration_date',
        'candidate_photo_path',
        'candidate_photo_original_name',
        'cnh_attachment_path',
        'cnh_attachment_original_name',
        'work_card_attachment_path',
        'work_card_attachment_original_name',
        'curriculum_path',
        'curriculum_original_name',
        'ear',
        'last_company',
        'last_role',
        'last_city',
        'last_period_start',
        'last_period_end',
        'last_exit_type',
        'last_exit_reason',
        'last_company_observation',
        'previous_company',
        'previous_role',
        'previous_city',
        'previous_period_start',
        'previous_period_end',
        'previous_exit_type',
        'previous_exit_reason',
        'previous_company_observation',
        'other_company',
        'other_role',
        'other_city',
        'other_period_start',
        'other_period_end',
        'other_exit_reason',
        'relevant_experience',
        'truck_types_operated',
        'night_shift_experience',
        'live_animals_transport_experience',
        'accident_history',
        'accident_details',
        'schedule_availability',
        'start_availability_date',
        'start_availability_note',
        'knows_company_contact',
        'contact_name',
        'expectations_about_company',
        'last_salary',
        'salary_expectation',
        'salary_observation',
        'posture_communication',
        'perceived_experience',
        'general_observations',
        'candidate_interest',
        'availability_matches',
        'overall_score',
        'hr_status',
        'hr_rejection_reason',
        'guep_status',
        'foi_contratado',
        'colaborador_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'has_children' => 'boolean',
            'ear' => 'boolean',
            'night_shift_experience' => 'boolean',
            'live_animals_transport_experience' => 'boolean',
            'accident_history' => 'boolean',
            'knows_company_contact' => 'boolean',
            'availability_matches' => 'boolean',
            'cpf' => 'encrypted',
            'rg' => 'encrypted',
            'cnh_number' => 'encrypted',
            'last_period_start' => 'date',
            'last_period_end' => 'date',
            'previous_period_start' => 'date',
            'previous_period_end' => 'date',
            'other_period_start' => 'date',
            'other_period_end' => 'date',
            'birth_date' => 'date',
            'start_availability_date' => 'date',
            'cnh_expiration_date' => 'date',
            'last_salary' => 'decimal:2',
            'salary_expectation' => 'decimal:2',
            'overall_score' => 'float',
            'foi_contratado' => 'boolean',
            'candidate_interest' => CandidateInterest::class,
            'hr_status' => HrStatus::class,
            'guep_status' => GuepStatus::class,
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function colaborador(): BelongsTo
    {
        return $this->belongsTo(Colaborador::class);
    }

    public function hiringUnidade(): BelongsTo
    {
        return $this->belongsTo(Unidade::class, 'hiring_unidade_id');
    }

    public function curriculum(): BelongsTo
    {
        return $this->belongsTo(InterviewCurriculum::class, 'curriculum_id');
    }

    public function onboarding(): HasOne
    {
        return $this->hasOne(Onboarding::class);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['full_name', 'city', 'children_situation', 'last_company', 'previous_company', 'other_company', 'hr_status', 'guep_status', 'overall_score', 'candidate_interest'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $eventName) => match ($eventName) {
                'created' => 'Entrevista criada',
                'updated' => 'Entrevista atualizada',
                'deleted' => 'Entrevista excluída',
                default => $eventName,
            });
    }
}
