<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OnboardingItemAttachmentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'original_name' => $this->original_name,
            'mime' => $this->mime,
            'size' => $this->size,
            'uploaded_by' => $this->uploaded_by,
            'uploaded_by_name' => $this->whenLoaded('uploader', fn (): ?string => $this->uploader?->name),
            'created_at' => $this->created_at?->toISOString(),
            'download_url' => route('api.onboarding.attachments.download', [
                'onboardingItemAttachment' => $this->id,
            ]),
        ];
    }
}
