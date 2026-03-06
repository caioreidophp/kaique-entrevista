<?php

namespace App\Support;

use App\Models\DriverInterview;
use App\Models\Onboarding;
use App\Models\OnboardingEvent;
use App\Models\OnboardingItem;
use App\Models\User;
use Illuminate\Support\Carbon;

class OnboardingService
{
    /**
     * @var array<int, array{code: string, title: string, required: bool, due_days: int}>
     */
    private const DEFAULT_ITEMS = [
        ['code' => 'exames_status', 'title' => 'Exames', 'required' => true, 'due_days' => 0],

        ['code' => 'doc_cnh', 'title' => 'CNH', 'required' => true, 'due_days' => 0],
        ['code' => 'doc_rg', 'title' => 'RG', 'required' => true, 'due_days' => 0],
        ['code' => 'doc_comprovacao_endereco', 'title' => 'Comprovação de endereço', 'required' => true, 'due_days' => 0],
        ['code' => 'doc_cpf', 'title' => 'CPF', 'required' => true, 'due_days' => 0],
        ['code' => 'doc_filhos', 'title' => 'Documentos dos filhos', 'required' => true, 'due_days' => 0],
        ['code' => 'doc_informacoes_registro', 'title' => 'Informações para registro', 'required' => true, 'due_days' => 0],

        ['code' => 'curso_conducao_segura_responsavel', 'title' => 'Condução segura e responsável', 'required' => true, 'due_days' => 0],
        ['code' => 'curso_identificacao_riscos', 'title' => 'Identificação de riscos', 'required' => true, 'due_days' => 0],
        ['code' => 'curso_gestao_risco_prevencao_tombamento', 'title' => 'Gestão de risco e prevenção de tombamento', 'required' => true, 'due_days' => 0],
        ['code' => 'curso_seguranca_operacional_agropecuario', 'title' => 'Segurança operacional (agropecuário)', 'required' => true, 'due_days' => 0],

        ['code' => 'outro_integracao_seara', 'title' => 'Integração Seara', 'required' => true, 'due_days' => 0],
        ['code' => 'outro_treinamento_kaique', 'title' => 'Treinamento Kaique', 'required' => true, 'due_days' => 0],
        ['code' => 'outro_conta_salario', 'title' => 'Conta salário', 'required' => true, 'due_days' => 0],
        ['code' => 'outro_foto', 'title' => 'Foto', 'required' => true, 'due_days' => 0],
    ];

    public function createForInterview(DriverInterview $interview, ?User $actor = null): Onboarding
    {
        $created = false;

        $onboarding = Onboarding::query()->firstOrCreate(
            ['driver_interview_id' => $interview->id],
            [
                'colaborador_id' => $interview->colaborador_id,
                'responsavel_user_id' => $interview->author_id,
                'status' => 'em_andamento',
                'started_at' => now(),
            ],
        );

        if ($onboarding->wasRecentlyCreated) {
            $created = true;
        }

        $this->syncTemplateItems($onboarding);

        $shouldUpdateColaborador = $interview->colaborador_id !== null
            && $onboarding->colaborador_id !== $interview->colaborador_id;

        if ($shouldUpdateColaborador) {
            $onboarding->update([
                'colaborador_id' => $interview->colaborador_id,
            ]);
        }

        if ($created) {
            $this->logEvent(
                $onboarding,
                'onboarding_created',
                null,
                null,
                [
                    'driver_interview_id' => $interview->id,
                    'colaborador_id' => $interview->colaborador_id,
                ],
                $actor,
            );
        }

        return $onboarding->refresh();
    }

    public function assignResponsible(Onboarding $onboarding, int $responsavelUserId, User $actor): Onboarding
    {
        $oldValue = $onboarding->responsavel_user_id;

        $onboarding->update([
            'responsavel_user_id' => $responsavelUserId,
        ]);

        $this->logEvent(
            $onboarding,
            'responsavel_changed',
            $oldValue ? (string) $oldValue : null,
            (string) $responsavelUserId,
            null,
            $actor,
        );

        return $onboarding->refresh();
    }

    /**
     * @param  array{status?: string, due_date?: string|null, notes?: string|null}  $data
     */
    public function updateItem(OnboardingItem $item, array $data, User $actor): OnboardingItem
    {
        $previousStatus = $item->status;

        if (array_key_exists('status', $data)) {
            $item->status = (string) $data['status'];
        }

        if (array_key_exists('due_date', $data)) {
            $item->due_date = $data['due_date'] ? Carbon::parse((string) $data['due_date'])->toDateString() : null;
        }

        if (array_key_exists('notes', $data)) {
            $item->notes = $data['notes'] !== null ? trim((string) $data['notes']) : null;
        }

        if ($item->status === 'aprovado') {
            $item->approved_by = $actor->id;
            $item->approved_at = now();
        } else {
            $item->approved_by = null;
            $item->approved_at = null;
        }

        $item->save();

        $this->logEvent(
            $item->onboarding,
            'item_updated',
            $previousStatus,
            $item->status,
            [
                'item_id' => $item->id,
                'item_code' => $item->code,
                'due_date' => $item->due_date?->toDateString(),
            ],
            $actor,
            $item,
        );

        $this->recalculateStatus($item->onboarding);

        return $item->refresh();
    }

    public function complete(Onboarding $onboarding, User $actor): Onboarding
    {
        $requiredItems = $onboarding->items()->where('required', true)->get();

        $hasPendingRequired = $requiredItems->contains(
            fn (OnboardingItem $item): bool => $item->status !== 'aprovado',
        );

        abort_if($hasPendingRequired, 422, 'Existem itens obrigatórios pendentes para concluir o onboarding.');

        $onboarding->update([
            'status' => 'concluido',
            'concluded_at' => now(),
        ]);

        $this->logEvent(
            $onboarding,
            'onboarding_completed',
            null,
            'concluido',
            null,
            $actor,
        );

        return $onboarding->refresh();
    }

    public function recalculateStatus(Onboarding $onboarding): void
    {
        $requiredItems = $onboarding->items()->where('required', true)->get();

        $hasRequiredRejected = $requiredItems->contains(
            fn (OnboardingItem $item): bool => $item->status === 'reprovado',
        );

        $allRequiredApproved = $requiredItems->count() > 0
            && $requiredItems->every(fn (OnboardingItem $item): bool => $item->status === 'aprovado');

        $nextStatus = 'em_andamento';

        if ($hasRequiredRejected) {
            $nextStatus = 'bloqueado';
        }

        if ($onboarding->status === 'concluido' && $allRequiredApproved) {
            $nextStatus = 'concluido';
        }

        $attributes = ['status' => $nextStatus];

        if ($nextStatus !== 'concluido') {
            $attributes['concluded_at'] = null;
        }

        $onboarding->update($attributes);
    }

    private function initializeDefaultItems(Onboarding $onboarding): void
    {
        foreach (self::DEFAULT_ITEMS as $item) {
            OnboardingItem::query()->create([
                'onboarding_id' => $onboarding->id,
                'code' => $item['code'],
                'title' => $item['title'],
                'required' => $item['required'],
                'status' => 'pendente',
                'due_date' => $item['due_days'] > 0
                    ? now()->addDays($item['due_days'])->toDateString()
                    : null,
            ]);
        }
    }

    public function syncTemplateItems(Onboarding $onboarding): void
    {
        $items = $onboarding->items()->get()->keyBy('code');
        $templateCodes = collect(self::DEFAULT_ITEMS)
            ->pluck('code')
            ->all();

        $onboarding->items()
            ->whereNotIn('code', $templateCodes)
            ->delete();

        foreach (self::DEFAULT_ITEMS as $template) {
            /** @var OnboardingItem|null $current */
            $current = $items->get($template['code']);

            if (! $current) {
                OnboardingItem::query()->create([
                    'onboarding_id' => $onboarding->id,
                    'code' => $template['code'],
                    'title' => $template['title'],
                    'required' => $template['required'],
                    'status' => 'pendente',
                    'due_date' => null,
                ]);

                continue;
            }

            $current->update([
                'title' => $template['title'],
                'required' => $template['required'],
            ]);
        }
    }

    /**
     * @param  array<string, mixed>|null  $payload
     */
    public function logEvent(
        Onboarding $onboarding,
        string $eventType,
        ?string $fromValue,
        ?string $toValue,
        ?array $payload,
        ?User $actor,
        ?OnboardingItem $item = null,
    ): void {
        OnboardingEvent::query()->create([
            'onboarding_id' => $onboarding->id,
            'onboarding_item_id' => $item?->id,
            'event_type' => $eventType,
            'from_value' => $fromValue,
            'to_value' => $toValue,
            'payload' => $payload,
            'performed_by' => $actor?->id,
        ]);
    }
}
