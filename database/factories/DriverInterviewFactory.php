<?php

namespace Database\Factories;

use App\Enums\CandidateInterest;
use App\Enums\GuepStatus;
use App\Enums\HrStatus;
use App\Models\DriverInterview;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DriverInterview>
 */
class DriverInterviewFactory extends Factory
{
    protected $model = DriverInterview::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $hrStatus = fake()->randomElement(HrStatus::cases());
        $rgPrefix = (string) fake()->numerify('#########');
        $rgSuffix = strtoupper(fake()->randomElement([
            (string) fake()->numberBetween(0, 9),
            fake()->randomLetter(),
        ]));

        $guepStatus = $hrStatus === HrStatus::Reprovado
            ? GuepStatus::NaoFazer
            : fake()->randomElement([
                GuepStatus::AFazer,
                GuepStatus::Aguardando,
                GuepStatus::Aprovado,
                GuepStatus::Reprovado,
            ]);

        return [
            'author_id' => User::factory(),
            'user_id' => fn (array $attributes): int => $attributes['author_id'],
            'full_name' => fake()->name(),
            'preferred_name' => fake()->firstName(),
            'phone' => (string) fake()->numerify('###########'),
            'email' => fake()->unique()->safeEmail(),
            'city' => fake()->city(),
            'hiring_unidade_id' => null,
            'marital_status' => fake()->randomElement(['solteiro', 'casado', 'divorciado']),
            'has_children' => fake()->boolean(),
            'cpf' => (string) fake()->numerify('###########'),
            'rg' => "{$rgPrefix}{$rgSuffix}",
            'cnh_number' => (string) fake()->numerify('#########'),
            'cnh_category' => strtoupper(fake()->lexify('??')),
            'cnh_expiration_date' => fake()->dateTimeBetween('+6 months', '+5 years')->format('Y-m-d'),
            'ear' => fake()->boolean(),
            'last_company' => fake()->company(),
            'last_role' => 'Motorista',
            'last_city' => fake()->city(),
            'last_period_start' => '2023-01-01',
            'last_period_end' => '2024-12-01',
            'last_exit_reason' => 'Mudança de cidade',
            'previous_company' => fake()->company(),
            'previous_role' => 'Motorista',
            'previous_city' => fake()->city(),
            'previous_period_start' => '2021-01-01',
            'previous_period_end' => '2022-12-31',
            'previous_exit_reason' => 'Fim de contrato',
            'relevant_experience' => fake()->paragraph(),
            'truck_types_operated' => 'Truck, carreta e bitrem',
            'night_shift_experience' => fake()->boolean(),
            'live_animals_transport_experience' => fake()->boolean(),
            'accident_history' => false,
            'accident_details' => null,
            'schedule_availability' => 'Escala 12x36',
            'start_availability_date' => fake()->dateTimeBetween('now', '+30 days')->format('Y-m-d'),
            'knows_company_contact' => false,
            'contact_name' => null,
            'expectations_about_company' => fake()->sentence(),
            'last_salary' => fake()->randomFloat(2, 2200, 5000),
            'salary_expectation' => fake()->randomFloat(2, 3000, 7000),
            'posture_communication' => fake()->sentence(),
            'perceived_experience' => fake()->sentence(),
            'general_observations' => fake()->paragraph(),
            'candidate_interest' => fake()->randomElement(CandidateInterest::cases()),
            'availability_matches' => fake()->boolean(),
            'overall_score' => fake()->numberBetween(0, 10),
            'hr_status' => $hrStatus,
            'guep_status' => $guepStatus,
        ];
    }
}
