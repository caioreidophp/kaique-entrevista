<?php

namespace App\Http\Resources;

use App\Models\OnboardingItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OnboardingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $items = $this->relationLoaded('items')
            ? $this->items
            : collect();

        $requiredItems = $items->filter(fn (OnboardingItem $item): bool => $item->required);
        $requiredTotal = $requiredItems->count();
        $requiredApproved = $requiredItems->filter(
            fn (OnboardingItem $item): bool => $item->status === 'aprovado',
        )->count();
        $overdueCount = $requiredItems->filter(function (OnboardingItem $item): bool {
            if (! $item->due_date) {
                return false;
            }

            return $item->due_date->isPast() && $item->status !== 'aprovado';
        })->count();

        return [
            'id' => $this->id,
            'driver_interview_id' => $this->driver_interview_id,
            'colaborador_id' => $this->colaborador_id,
            'responsavel_user_id' => $this->responsavel_user_id,
            'responsavel_name' => $this->whenLoaded('responsavel', fn (): ?string => $this->responsavel?->name),
            'status' => $this->status,
            'started_at' => $this->started_at?->toISOString(),
            'concluded_at' => $this->concluded_at?->toISOString(),
            'required_total' => $requiredTotal,
            'required_approved' => $requiredApproved,
            'overdue_count' => $overdueCount,
            'interview' => $this->whenLoaded('interview', function (): ?array {
                if (! $this->interview) {
                    return null;
                }

                return [
                    'id' => $this->interview->id,
                    'full_name' => $this->interview->full_name,
                    'author_id' => $this->interview->author_id,
                ];
            }),
            'colaborador' => $this->whenLoaded('colaborador', function (): ?array {
                if (! $this->colaborador) {
                    return null;
                }

                return [
                    'id' => $this->colaborador->id,
                    'nome' => $this->colaborador->nome,
                    'unidade_id' => $this->colaborador->unidade_id,
                    'unidade_nome' => $this->colaborador->unidade?->nome,
                ];
            }),
            'items' => OnboardingItemResource::collection($this->whenLoaded('items')),
            'events' => $this->whenLoaded('events', fn () => $this->events->map(function ($event): array {
                return [
                    'id' => $event->id,
                    'event_type' => $event->event_type,
                    'from_value' => $event->from_value,
                    'to_value' => $event->to_value,
                    'payload' => $event->payload,
                    'performed_by' => $event->performed_by,
                    'performed_by_name' => $event->user?->name,
                    'onboarding_item_id' => $event->onboarding_item_id,
                    'created_at' => $event->created_at?->toISOString(),
                ];
            })->values()),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
