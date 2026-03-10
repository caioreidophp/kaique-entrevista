<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DriverInterviewListResource extends JsonResource
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
            'author_id' => $this->author_id,
            'full_name' => $this->full_name,
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
            'hr_status' => $this->hr_status?->value,
            'hr_rejection_reason' => $this->hr_rejection_reason,
            'guep_status' => $this->guep_status?->value,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
