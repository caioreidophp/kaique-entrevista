<?php

namespace App\Support;

use App\Models\FinancialApproval;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class FinancialApprovalService
{
    public function enabled(): bool
    {
        return (bool) config('transport_features.financial_double_approval', true);
    }

    public function requiresPayrollLaunchApproval(User $requester, array $payload): bool
    {
        if (! $this->enabled()) {
            return false;
        }

        if ($requester->isMasterAdmin()) {
            return false;
        }

        $summary = $this->buildPayrollLaunchSummary($payload);
        $thresholdValue = (float) config('transport_features.financial_double_approval_threshold', 15000);
        $thresholdPeople = (int) config('transport_features.financial_double_approval_people_threshold', 25);

        return $summary['total_valor'] >= $thresholdValue
            || $summary['total_colaboradores'] >= $thresholdPeople;
    }

    public function buildPayrollLaunchSummary(array $payload): array
    {
        $rows = collect((array) ($payload['pagamentos'] ?? []));

        $total = 0.0;
        $selectedCount = 0;

        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }

            $selected = (bool) ($row['selected'] ?? false);
            $legacyValue = (float) ($row['valor'] ?? 0);
            $valuesByType = collect((array) ($row['valores_por_tipo'] ?? []))
                ->sum(fn ($value): float => (float) $value);
            $valuesPensao = collect((array) ($row['valores_pensao'] ?? []))
                ->sum(fn ($value): float => (float) $value);

            $rowTotal = max($legacyValue, 0) + max((float) $valuesByType, 0) + max((float) $valuesPensao, 0);

            if ($selected || $rowTotal > 0) {
                $selectedCount++;
            }

            $total += $rowTotal;
        }

        return [
            'total_valor' => round($total, 2),
            'total_colaboradores' => $selectedCount,
            'unidade_id' => (int) ($payload['unidade_id'] ?? 0),
            'data_pagamento' => (string) ($payload['data_pagamento'] ?? ''),
            'competencia_mes' => (int) ($payload['competencia_mes'] ?? 0),
            'competencia_ano' => (int) ($payload['competencia_ano'] ?? 0),
        ];
    }

    public function requiresFineEntryApproval(User $requester, array $payload): bool
    {
        if (! $this->enabled()) {
            return false;
        }

        if (! (bool) config('transport_features.financial_fine_approval', true)) {
            return false;
        }

        if ($requester->isMasterAdmin()) {
            return false;
        }

        $summary = $this->buildFineEntrySummary($payload);
        $thresholdValue = (float) config('transport_features.financial_fine_approval_threshold', 1000);
        $requiresByValue = (float) ($summary['total_valor'] ?? 0) >= $thresholdValue;
        $requiresDriverDiscount = (bool) config('transport_features.financial_fine_driver_discount_approval', true)
            && (bool) ($summary['desconto_motorista'] ?? false);

        return $requiresByValue || $requiresDriverDiscount;
    }

    public function buildFineEntrySummary(array $payload): array
    {
        $valor = round(max((float) ($payload['valor'] ?? 0), 0), 2);
        $colaboradorId = (int) ($payload['colaborador_id'] ?? 0);

        return [
            'total_valor' => $valor,
            'total_colaboradores' => $colaboradorId > 0 ? 1 : 0,
            'unidade_id' => (int) ($payload['unidade_id'] ?? 0),
            'unidade_nome' => isset($payload['unidade_nome']) ? (string) $payload['unidade_nome'] : null,
            'tipo_registro' => (string) ($payload['tipo_registro'] ?? 'multa'),
            'status' => (string) ($payload['status'] ?? ''),
            'desconto_motorista' => ((string) ($payload['culpa'] ?? 'empresa') === 'motorista')
                && (bool) ($payload['descontar'] ?? false),
        ];
    }

    public function requiresVacationEntryApproval(User $requester, array $payload): bool
    {
        if (! $this->enabled()) {
            return false;
        }

        if (! (bool) config('transport_features.financial_vacation_approval', true)) {
            return false;
        }

        if ($requester->isMasterAdmin()) {
            return false;
        }

        $summary = $this->buildVacationEntrySummary($payload);
        $daysThreshold = max((int) config('transport_features.financial_vacation_approval_days_threshold', 30), 1);
        $requiresByDays = (int) ($summary['dias_ferias'] ?? 0) >= $daysThreshold;
        $requiresPastEntry = (bool) config('transport_features.financial_vacation_approval_for_past', true)
            && (string) ($summary['tipo'] ?? '') === 'passada';

        return $requiresByDays || $requiresPastEntry;
    }

    public function buildVacationEntrySummary(array $payload): array
    {
        $diasFerias = (int) ($payload['dias_ferias'] ?? 0);

        return [
            'total_valor' => 0.0,
            'total_colaboradores' => 1,
            'unidade_id' => (int) ($payload['unidade_id'] ?? 0),
            'unidade_nome' => isset($payload['unidade_nome']) ? (string) $payload['unidade_nome'] : null,
            'tipo' => (string) ($payload['tipo'] ?? ''),
            'dias_ferias' => $diasFerias,
            'com_abono' => (bool) ($payload['com_abono'] ?? false),
            'data_inicio' => (string) ($payload['data_inicio'] ?? ''),
            'data_fim' => (string) ($payload['data_fim'] ?? ''),
        ];
    }

    public function buildRequestHash(array $payload): string
    {
        $normalized = Arr::sortRecursive($payload);

        return hash('sha256', (string) json_encode($normalized));
    }

    public function requestOrReusePendingApproval(User $requester, string $actionKey, string $requestHash, array $summary): FinancialApproval
    {
        $requiredApprovals = $this->requiredApprovalsForSummary($summary);

        $existing = FinancialApproval::query()
            ->where('status', 'pending')
            ->where('requester_id', $requester->id)
            ->where('action_key', $actionKey)
            ->where('request_hash', $requestHash)
            ->where(function ($query): void {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->latest('id')
            ->first();

        if ($existing) {
            if ((int) $existing->required_approvals !== $requiredApprovals) {
                $existing->update([
                    'required_approvals' => $requiredApprovals,
                ]);
            }

            return $existing;
        }

        return FinancialApproval::query()->create([
            'request_uuid' => (string) Str::uuid(),
            'action_key' => $actionKey,
            'request_hash' => $requestHash,
            'status' => 'pending',
            'required_approvals' => $requiredApprovals,
            'approved_steps' => 0,
            'summary' => $summary,
            'approval_history' => [],
            'requester_id' => $requester->id,
            'expires_at' => now()->addHours(8),
        ]);
    }

    public function approve(FinancialApproval $approval, User $approver): FinancialApproval
    {
        $history = collect((array) ($approval->approval_history ?? []))
            ->filter(fn ($row): bool => is_array($row))
            ->values()
            ->all();

        $history[] = [
            'approver_id' => (int) $approver->id,
            'approver_name' => (string) $approver->name,
            'approved_at' => now()->toISOString(),
            'step' => count($history) + 1,
        ];

        $requiredApprovals = max((int) ($approval->required_approvals ?? 1), 1);
        $approvedSteps = count($history);
        $isFinal = $approvedSteps >= $requiredApprovals;

        $approval->update([
            'status' => $isFinal ? 'approved' : 'pending',
            'approver_id' => $approver->id,
            'approved_steps' => $approvedSteps,
            'approval_history' => $history,
            'reviewed_at' => now(),
            'execution_token' => $isFinal ? Str::random(64) : null,
            'token_expires_at' => $isFinal
                ? now()->addMinutes((int) config('transport_features.financial_double_approval_token_ttl', 15))
                : null,
            'reason' => null,
        ]);

        return $approval->refresh();
    }

    public function reject(FinancialApproval $approval, User $approver, ?string $reason = null): FinancialApproval
    {
        $approval->update([
            'status' => 'rejected',
            'approver_id' => $approver->id,
            'approved_steps' => 0,
            'reviewed_at' => now(),
            'execution_token' => null,
            'token_expires_at' => null,
            'reason' => $reason,
        ]);

        return $approval->refresh();
    }

    public function consumeExecutionToken(User $requester, string $token, string $requestHash): ?FinancialApproval
    {
        $approval = FinancialApproval::query()
            ->where('requester_id', $requester->id)
            ->where('status', 'approved')
            ->where('execution_token', $token)
            ->where('request_hash', $requestHash)
            ->where(function ($query): void {
                $query->whereNull('token_expires_at')->orWhere('token_expires_at', '>', now());
            })
            ->latest('id')
            ->first();

        if (! $approval) {
            return null;
        }

        $approval->update([
            'status' => 'consumed',
            'consumed_at' => now(),
        ]);

        return $approval->refresh();
    }

    private function requiredApprovalsForSummary(array $summary): int
    {
        $totalValor = (float) ($summary['total_valor'] ?? 0);
        $totalColaboradores = (int) ($summary['total_colaboradores'] ?? 0);
        $secondLevelValueThreshold = (float) config('transport_features.financial_multistep_second_level_threshold', 50000);
        $secondLevelPeopleThreshold = (int) config('transport_features.financial_multistep_second_level_people_threshold', 60);

        if ($totalValor >= $secondLevelValueThreshold || $totalColaboradores >= $secondLevelPeopleThreshold) {
            return 2;
        }

        return 1;
    }
}
