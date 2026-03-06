<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OnboardingItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'onboarding_id' => $this->onboarding_id,
            'code' => $this->code,
            'title' => $this->title,
            'required' => (bool) $this->required,
            'status' => $this->status,
            'due_date' => $this->due_date?->toDateString(),
            'approved_by' => $this->approved_by,
            'approved_by_name' => $this->whenLoaded('approver', fn (): ?string => $this->approver?->name),
            'approved_at' => $this->approved_at?->toISOString(),
            'notes' => $this->notes,
            'attachments' => OnboardingItemAttachmentResource::collection(
                $this->whenLoaded('attachments'),
            ),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
