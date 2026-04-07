<?php

namespace Database\Factories;

use App\Enums\InterviewCurriculumStatus;
use App\Models\InterviewCurriculum;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<InterviewCurriculum>
 */
class InterviewCurriculumFactory extends Factory
{
    protected $model = InterviewCurriculum::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $candidate = fake()->name();

        return [
            'author_id' => User::factory(),
            'full_name' => $candidate,
            'phone' => fake()->numerify('(11) 9####-####'),
            'role_name' => 'Motorista',
            'unit_name' => 'Amparo',
            'document_path' => 'interview-curriculums/fake/'.$this->faker->uuid().'.pdf',
            'document_original_name' => 'curriculo-'.Str::slug($candidate).'.pdf',
            'status' => InterviewCurriculumStatus::Pendente,
        ];
    }
}
