<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InterviewCurriculumResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $hasCnhAttachment = (bool) $this->cnh_attachment_path;
        $hasWorkCardAttachment = (bool) $this->work_card_attachment_path;

        $attachmentsStatus = '-';

        if ($hasCnhAttachment && $hasWorkCardAttachment) {
            $attachmentsStatus = 'CNH/CT';
        } elseif ($hasCnhAttachment) {
            $attachmentsStatus = 'CNH';
        } elseif ($hasWorkCardAttachment) {
            $attachmentsStatus = 'CT';
        }

        return [
            'id' => $this->id,
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
            'phone' => $this->phone,
            'role_name' => $this->role_name,
            'unit_name' => $this->unit_name,
            'observacao' => $this->observacao,
            'status' => $this->status?->value,
            'document_original_name' => $this->document_original_name,
            'document_url' => $this->document_path
                ? '/storage/'.ltrim((string) $this->document_path, '/')
                : null,
            'cnh_attachment_original_name' => $this->cnh_attachment_original_name,
            'cnh_attachment_url' => $this->cnh_attachment_path
                ? '/storage/'.ltrim((string) $this->cnh_attachment_path, '/')
                : null,
            'work_card_attachment_original_name' => $this->work_card_attachment_original_name,
            'work_card_attachment_url' => $this->work_card_attachment_path
                ? '/storage/'.ltrim((string) $this->work_card_attachment_path, '/')
                : null,
            'has_cnh_attachment' => $hasCnhAttachment,
            'has_work_card_attachment' => $hasWorkCardAttachment,
            'attachments_status' => $attachmentsStatus,
            'linked_interview' => $this->whenLoaded('linkedInterview', function (): ?array {
                if (! $this->linkedInterview) {
                    return null;
                }

                return [
                    'id' => $this->linkedInterview->id,
                    'full_name' => $this->linkedInterview->full_name,
                    'hr_status' => $this->linkedInterview->hr_status?->value,
                    'foi_contratado' => (bool) $this->linkedInterview->foi_contratado,
                ];
            }),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
