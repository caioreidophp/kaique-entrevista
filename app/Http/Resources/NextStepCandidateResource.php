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
            'cpf' => $this->cpf,
            'email' => $this->email,
            'phone' => $this->phone,
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
