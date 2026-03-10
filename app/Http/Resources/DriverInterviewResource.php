<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DriverInterviewResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'author_id' => $this->author_id,
            'author' => $this->whenLoaded('author', function (): ?array {
                if (! $this->author) {
                    return null;
                }

                return [
                    'id' => $this->author->id,
                    'name' => $this->author->name,
                    'email' => $this->author->email,
                ];
            }),

            'full_name' => $this->full_name,
            'preferred_name' => $this->preferred_name,
            'phone' => $this->phone,
            'email' => $this->email,
            'city' => $this->city,
            'cargo_pretendido' => $this->cargo_pretendido,
            'hiring_unidade_id' => $this->hiring_unidade_id,
            'hiring_unidade' => $this->whenLoaded('hiringUnidade', function (): ?array {
                if (! $this->hiringUnidade) {
                    return null;
                }

                return [
                    'id' => $this->hiringUnidade->id,
                    'nome' => $this->hiringUnidade->nome,
                    'slug' => $this->hiringUnidade->slug,
                ];
            }),
            'marital_status' => $this->marital_status,
            'has_children' => $this->has_children,
            'children_situation' => $this->children_situation,

            'cpf' => $this->cpf,
            'rg' => $this->rg,
            'cnh_number' => $this->cnh_number,
            'cnh_category' => $this->cnh_category,
            'cnh_expiration_date' => $this->cnh_expiration_date?->format('Y-m-d'),
            'ear' => $this->ear,

            'last_company' => $this->last_company,
            'last_role' => $this->last_role,
            'last_city' => $this->last_city,
            'last_period_start' => $this->last_period_start?->format('Y-m-d'),
            'last_period_end' => $this->last_period_end?->format('Y-m-d'),
            'last_exit_type' => $this->last_exit_type,
            'last_exit_reason' => $this->last_exit_reason,
            'last_company_observation' => $this->last_company_observation,

            'previous_company' => $this->previous_company,
            'previous_role' => $this->previous_role,
            'previous_city' => $this->previous_city,
            'previous_period_start' => $this->previous_period_start?->format('Y-m-d'),
            'previous_period_end' => $this->previous_period_end?->format('Y-m-d'),
            'previous_exit_type' => $this->previous_exit_type,
            'previous_exit_reason' => $this->previous_exit_reason,
            'previous_company_observation' => $this->previous_company_observation,
            'other_company' => $this->other_company,
            'other_role' => $this->other_role,
            'other_city' => $this->other_city,
            'other_period_start' => $this->other_period_start?->format('Y-m-d'),
            'other_period_end' => $this->other_period_end?->format('Y-m-d'),
            'other_exit_reason' => $this->other_exit_reason,
            'relevant_experience' => $this->relevant_experience,

            'truck_types_operated' => $this->truck_types_operated,
            'night_shift_experience' => $this->night_shift_experience,
            'live_animals_transport_experience' => $this->live_animals_transport_experience,
            'accident_history' => $this->accident_history,
            'accident_details' => $this->accident_details,

            'schedule_availability' => $this->schedule_availability,
            'start_availability_date' => $this->start_availability_date?->format('Y-m-d'),
            'start_availability_note' => $this->start_availability_note,
            'knows_company_contact' => $this->knows_company_contact,
            'contact_name' => $this->contact_name,
            'expectations_about_company' => $this->expectations_about_company,

            'last_salary' => (float) $this->last_salary,
            'salary_expectation' => (float) $this->salary_expectation,
            'salary_observation' => $this->salary_observation,

            'posture_communication' => $this->posture_communication,
            'perceived_experience' => $this->perceived_experience,
            'general_observations' => $this->general_observations,
            'candidate_interest' => $this->candidate_interest?->value,
            'availability_matches' => $this->availability_matches,
            'overall_score' => $this->overall_score,
            'hr_status' => $this->hr_status?->value,
            'hr_rejection_reason' => $this->hr_rejection_reason,
            'guep_status' => $this->guep_status?->value,

            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'deleted_at' => $this->deleted_at?->toISOString(),
        ];
    }
}
