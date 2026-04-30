<?php

namespace App\Support;

use App\Models\AutomatedReminderDelivery;
use App\Models\AutomatedReminderRule;
use App\Models\Colaborador;
use App\Models\FeriasLancamento;
use App\Models\OperationalTask;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Throwable;

class AutomatedReminderService
{
    /**
     * @return array<string, mixed>
     */
    public function runActiveRules(): array
    {
        if (! (bool) config('transport_features.automated_reminders', true)) {
            return [
                'processed_rules' => 0,
                'attempted' => 0,
                'sent' => 0,
                'failed' => 0,
                'skipped' => 0,
                'rules' => [],
            ];
        }

        $rules = AutomatedReminderRule::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->get();

        $summary = [
            'processed_rules' => 0,
            'attempted' => 0,
            'sent' => 0,
            'failed' => 0,
            'skipped' => 0,
            'rules' => [],
        ];

        foreach ($rules as $rule) {
            $result = $this->runRule($rule);
            $summary['processed_rules']++;
            $summary['attempted'] += (int) ($result['attempted'] ?? 0);
            $summary['sent'] += (int) ($result['sent'] ?? 0);
            $summary['failed'] += (int) ($result['failed'] ?? 0);
            $summary['skipped'] += (int) ($result['skipped'] ?? 0);
            $summary['rules'][] = $result;
        }

        return $summary;
    }

    /**
     * @return array<string, mixed>
     */
    public function runRule(AutomatedReminderRule $rule): array
    {
        $payload = $this->buildRulePayload($rule);

        $result = [
            'rule_id' => (int) $rule->id,
            'rule_name' => (string) $rule->name,
            'trigger_key' => (string) $rule->trigger_key,
            'channel' => (string) $rule->channel,
            'attempted' => 0,
            'sent' => 0,
            'failed' => 0,
            'skipped' => 0,
        ];

        if ($payload === null) {
            $rule->forceFill(['last_run_at' => now()])->save();
            $result['skipped'] = 1;
            $result['reason'] = 'no_actionable_items';

            return $result;
        }

        $recipients = collect(is_array($rule->recipients) ? $rule->recipients : [])
            ->map(fn ($item): string => trim((string) $item))
            ->filter(fn (string $item): bool => $item !== '')
            ->unique()
            ->values();

        if ($recipients->isEmpty()) {
            $this->logDelivery(
                rule: $rule,
                recipient: '-',
                subject: $payload['subject'],
                message: $payload['message'],
                status: 'failed',
                triggerContext: $payload['context'],
                errorMessage: 'Rule has no recipients configured.',
            );

            $rule->forceFill(['last_run_at' => now()])->save();
            $result['failed'] = 1;

            return $result;
        }

        foreach ($recipients as $recipient) {
            $result['attempted']++;

            $deliveryResult = $rule->channel === 'whatsapp'
                ? $this->sendWhatsApp($rule, $recipient, $payload['subject'], $payload['message'], $payload['context'])
                : $this->sendEmail($recipient, $payload['subject'], $payload['message']);

            $this->logDelivery(
                rule: $rule,
                recipient: $recipient,
                subject: $payload['subject'],
                message: $payload['message'],
                status: $deliveryResult['status'],
                triggerContext: $payload['context'],
                errorMessage: $deliveryResult['error_message'] ?? null,
                httpStatus: $deliveryResult['http_status'] ?? null,
                providerResponse: $deliveryResult['provider_response'] ?? null,
            );

            if (($deliveryResult['status'] ?? 'failed') === 'sent') {
                $result['sent']++;
            } else {
                $result['failed']++;
            }
        }

        $rule->forceFill(['last_run_at' => now()])->save();

        app(OutboundWebhookService::class)->dispatch('system.reminders.executed', [
            'rule_id' => (int) $rule->id,
            'rule_name' => (string) $rule->name,
            'trigger_key' => (string) $rule->trigger_key,
            'channel' => (string) $rule->channel,
            'attempted' => (int) $result['attempted'],
            'sent' => (int) $result['sent'],
            'failed' => (int) $result['failed'],
            'executed_at' => now()->toISOString(),
        ]);

        return $result;
    }

    /**
     * @return array{subject: string, message: string, context: array<string, mixed>}|null
     */
    private function buildRulePayload(AutomatedReminderRule $rule): ?array
    {
        return match ($rule->trigger_key) {
            'vacations_due' => $this->buildVacationsDuePayload($rule),
            'task_sla_overdue' => $this->buildTaskSlaPayload($rule),
            default => null,
        };
    }

    /**
     * @return array{subject: string, message: string, context: array<string, mixed>}|null
     */
    private function buildVacationsDuePayload(AutomatedReminderRule $rule): ?array
    {
        $thresholdDays = max(1, min(180, (int) $rule->threshold_days));
        $today = CarbonImmutable::today();
        $limitDate = $today->addDays($thresholdDays);

        $activeCollaborators = Colaborador::query()
            ->where('ativo', true)
            ->whereNotNull('data_admissao')
            ->with('unidade:id,nome')
            ->get(['id', 'nome', 'unidade_id', 'data_admissao']);

        $latestPeriodEndByCollaborator = FeriasLancamento::query()
            ->whereIn('colaborador_id', $activeCollaborators->pluck('id')->all())
            ->selectRaw('colaborador_id, MAX(periodo_aquisitivo_fim) as base_fim')
            ->groupBy('colaborador_id')
            ->pluck('base_fim', 'colaborador_id');

        $dueRows = [];
        $overdue = 0;
        $dueSoon = 0;

        foreach ($activeCollaborators as $colaborador) {
            $admissionDate = $colaborador->data_admissao?->toDateString();
            if (! $admissionDate) {
                continue;
            }

            $baseDate = (string) ($latestPeriodEndByCollaborator->get($colaborador->id) ?? $admissionDate);
            $deadline = CarbonImmutable::parse($baseDate)->addYear()->addMonths(11);

            if (! $deadline->betweenIncluded($today->subYears(10), $limitDate)) {
                continue;
            }

            $daysRemaining = $today->diffInDays($deadline, false);
            if ($daysRemaining < 0) {
                $overdue++;
            } else {
                $dueSoon++;
            }

            $dueRows[] = [
                'colaborador_id' => (int) $colaborador->id,
                'colaborador_nome' => (string) $colaborador->nome,
                'unidade_nome' => (string) ($colaborador->unidade->nome ?? 'Sem unidade'),
                'deadline' => $deadline->toDateString(),
                'days_remaining' => $daysRemaining,
            ];
        }

        if ($dueRows === []) {
            return null;
        }

        usort($dueRows, fn (array $a, array $b): int => ((int) $a['days_remaining']) <=> ((int) $b['days_remaining']));
        $sample = array_slice($dueRows, 0, 8);

        $subject = 'Lembrete operacional: ferias com prazo critico';
        $messageLines = [
            $rule->message_prefix ? trim((string) $rule->message_prefix) : null,
            "Total monitorado: ".count($dueRows),
            "Vencidas: {$overdue}",
            "Vencendo em ate {$thresholdDays} dias: {$dueSoon}",
            '',
            'Casos mais proximos:',
        ];

        foreach ($sample as $row) {
            $messageLines[] = "- {$row['colaborador_nome']} ({$row['unidade_nome']}) prazo {$row['deadline']} | dias {$row['days_remaining']}";
        }

        $message = implode("\n", array_values(array_filter($messageLines, fn ($line): bool => $line !== null)));

        return [
            'subject' => $subject,
            'message' => $message,
            'context' => [
                'trigger_key' => 'vacations_due',
                'threshold_days' => $thresholdDays,
                'totals' => [
                    'monitored' => count($dueRows),
                    'overdue' => $overdue,
                    'due_soon' => $dueSoon,
                ],
                'sample' => $sample,
            ],
        ];
    }

    /**
     * @return array{subject: string, message: string, context: array<string, mixed>}|null
     */
    private function buildTaskSlaPayload(AutomatedReminderRule $rule): ?array
    {
        $thresholdDays = max(1, min(30, (int) $rule->threshold_days));
        $now = now();
        $limit = now()->addDays($thresholdDays);

        $tasks = OperationalTask::query()
            ->with('unidade:id,nome')
            ->whereIn('status', ['open', 'in_progress'])
            ->whereNotNull('due_at')
            ->where('due_at', '<=', $limit)
            ->orderBy('due_at')
            ->get(['id', 'title', 'priority', 'status', 'due_at', 'unidade_id']);

        if ($tasks->isEmpty()) {
            return null;
        }

        $overdue = $tasks->filter(fn (OperationalTask $task): bool => (string) $task->due_at < $now->toDateTimeString())->count();
        $dueSoon = $tasks->count() - $overdue;

        $sample = $tasks->take(8)->map(function (OperationalTask $task): array {
            return [
                'task_id' => (int) $task->id,
                'title' => (string) $task->title,
                'priority' => (string) $task->priority,
                'status' => (string) $task->status,
                'unidade_nome' => (string) ($task->unidade->nome ?? 'Sem unidade'),
                'due_at' => $task->due_at?->toISOString(),
            ];
        })->values()->all();

        $subject = 'Lembrete operacional: tarefas com SLA em risco';
        $messageLines = [
            $rule->message_prefix ? trim((string) $rule->message_prefix) : null,
            "Tarefas monitoradas (ate {$thresholdDays} dias): ".$tasks->count(),
            "SLA vencido: {$overdue}",
            "Vencendo no periodo: {$dueSoon}",
            '',
            'Itens prioritarios:',
        ];

        foreach ($sample as $row) {
            $messageLines[] = "- {$row['title']} ({$row['unidade_nome']}) prioridade {$row['priority']}";
        }

        $message = implode("\n", array_values(array_filter($messageLines, fn ($line): bool => $line !== null)));

        return [
            'subject' => $subject,
            'message' => $message,
            'context' => [
                'trigger_key' => 'task_sla_overdue',
                'threshold_days' => $thresholdDays,
                'totals' => [
                    'monitored' => $tasks->count(),
                    'overdue' => $overdue,
                    'due_soon' => $dueSoon,
                ],
                'sample' => $sample,
            ],
        ];
    }

    /**
     * @return array{status: string, error_message?: string, http_status?: int, provider_response?: string}
     */
    private function sendEmail(string $recipient, string $subject, string $message): array
    {
        try {
            Mail::raw($message, function ($mail) use ($recipient, $subject): void {
                $mail->to($recipient)->subject($subject);
            });

            return ['status' => 'sent'];
        } catch (Throwable $exception) {
            return [
                'status' => 'failed',
                'error_message' => mb_substr($exception->getMessage(), 0, 1000),
            ];
        }
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array{status: string, error_message?: string, http_status?: int, provider_response?: string}
     */
    private function sendWhatsApp(
        AutomatedReminderRule $rule,
        string $recipient,
        string $subject,
        string $message,
        array $context,
    ): array {
        $url = trim((string) ($rule->webhook_url ?? ''));

        if ($url === '') {
            return [
                'status' => 'failed',
                'error_message' => 'Rule without webhook_url for WhatsApp channel.',
            ];
        }

        try {
            $response = Http::timeout(12)
                ->acceptJson()
                ->post($url, [
                    'to' => $recipient,
                    'subject' => $subject,
                    'message' => $message,
                    'context' => $context,
                ]);

            return [
                'status' => $response->successful() ? 'sent' : 'failed',
                'http_status' => $response->status(),
                'provider_response' => mb_substr((string) $response->body(), 0, 2000),
                'error_message' => $response->successful() ? null : 'HTTP '.$response->status(),
            ];
        } catch (Throwable $exception) {
            return [
                'status' => 'failed',
                'error_message' => mb_substr($exception->getMessage(), 0, 1000),
            ];
        }
    }

    /**
     * @param  array<string, mixed>  $triggerContext
     */
    private function logDelivery(
        AutomatedReminderRule $rule,
        string $recipient,
        string $subject,
        string $message,
        string $status,
        array $triggerContext,
        ?string $errorMessage = null,
        ?int $httpStatus = null,
        ?string $providerResponse = null,
    ): void {
        AutomatedReminderDelivery::query()->create([
            'automated_reminder_rule_id' => (int) $rule->id,
            'trigger_key' => (string) $rule->trigger_key,
            'channel' => (string) $rule->channel,
            'recipient' => $recipient,
            'status' => $status,
            'subject' => $subject,
            'message' => $message,
            'http_status' => $httpStatus,
            'provider_response' => $providerResponse,
            'error_message' => $errorMessage,
            'context' => $triggerContext,
            'dispatched_at' => now(),
        ]);
    }
}
