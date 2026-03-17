<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NextStepCandidateResource extends JsonResource
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
            'full_name' => $this->full_name,
            'preferred_name' => $this->preferred_name,
            'cpf' => $this->cpf,
            'rg' => $this->rg,
            'cnh_number' => $this->cnh_number,
            'cnh_expiration_date' => $this->cnh_expiration_date,
            'email' => $this->email,
            'phone' => $this->phone,
            'cargo_pretendido' => $this->cargo_pretendido,
            'hiring_unidade_id' => $this->hiring_unidade_id,
            'start_availability_date' => $this->start_availability_date,
            'marital_status' => $this->marital_status,
            'hr_status' => $this->hr_status?->value,
            'foi_contratado' => (bool) $this->foi_contratado,
            'colaborador_id' => $this->colaborador_id,
            'onboarding_id' => $this->onboarding?->id,
            'onboarding_status' => $this->onboarding?->status,
            'created_at' => $this->created_at?->toISOString(),
            'documents' => [
                'checklist' => [
                    'preview_url' => route('api.next-steps.documents.preview', [
                        'driverInterview' => $this->id,
                        'document' => 'checklist',
                    ]),
                    'pdf_url' => route('api.next-steps.documents.pdf', [
                        'driverInterview' => $this->id,
                        'document' => 'checklist',
                    ]),
                    'download_url' => route('api.next-steps.documents.pdf', [
                        'driverInterview' => $this->id,
                        'document' => 'checklist',
                        'download' => 1,
                    ]),
                ],
                'raca-etnia' => [
                    'preview_url' => route('api.next-steps.documents.preview', [
                        'driverInterview' => $this->id,
                        'document' => 'raca-etnia',
                    ]),
                    'pdf_url' => route('api.next-steps.documents.pdf', [
                        'driverInterview' => $this->id,
                        'document' => 'raca-etnia',
                    ]),
                    'download_url' => route('api.next-steps.documents.pdf', [
                        'driverInterview' => $this->id,
                        'document' => 'raca-etnia',
                        'download' => 1,
                    ]),
                ],
            ],
        ];
    }
}
