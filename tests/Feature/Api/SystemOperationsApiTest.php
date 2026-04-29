<?php

namespace Tests\Feature\Api;

use App\Models\AsyncOperation;
use App\Models\Colaborador;
use App\Models\DriverInterview;
use App\Models\FeriasLancamento;
use App\Models\Funcao;
use App\Models\Onboarding;
use App\Models\OnboardingItem;
use App\Models\Unidade;
use App\Models\User;
use App\Support\FinancialApprovalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Activitylog\Models\Activity;
use Tests\TestCase;

class SystemOperationsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_access_observability_and_queue_operations_endpoints(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $operation = AsyncOperation::query()->create([
            'user_id' => $admin->id,
            'category' => 'export',
            'type' => 'payroll',
            'status' => 'queued',
            'progress_percent' => 0,
            'summary' => 'Export in queue',
            'reference_type' => 'tests',
            'reference_id' => 'seed-1',
            'context' => ['unit_id' => $unidade->id],
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/home')->assertOk();

        $this->getJson('/api/system/observability')
            ->assertOk()
            ->assertJsonStructure([
                'generated_at',
                'latency' => ['routes', 'slowest_p95_ms'],
                'http' => ['total_requests_window', 'http_2xx', 'http_4xx', 'http_5xx'],
                'async_operations' => ['queued', 'processing', 'completed', 'failed', 'recent'],
                'cache' => ['permissions_version', 'home_version', 'payroll_version', 'freight_version', 'master_data_version'],
                'master_data' => ['issues'],
                'errors' => ['recent_5xx', 'recent_exceptions'],
                'alerts',
            ])
            ->assertJsonPath('async_operations.queued', 1);

        $this->getJson('/api/system/async-operations')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $operation->id);

        $this->getJson('/api/system/async-operations/'.$operation->id)
            ->assertOk()
            ->assertJsonPath('data.id', $operation->id);

        $this->getJson('/api/system/master-data/consistency')
            ->assertOk()
            ->assertJsonStructure([
                'generated_at',
                'catalog',
                'checks',
                'coverage',
            ]);

        $this->getJson('/api/system/queue')
            ->assertOk()
            ->assertJsonStructure([
                'queue_connection',
                'supports_jobs_table',
                'supports_failed_jobs',
                'pending' => ['total', 'by_queue'],
                'failed' => ['total', 'recent'],
                'actions' => ['retry_single', 'retry_all', 'forget_single', 'flush_all'],
            ]);

        $this->getJson('/api/system/queue/failed')
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'total',
            ]);
    }

    public function test_master_admin_receives_activity_log_change_summary(): void
    {
        $master = User::factory()->masterAdmin()->create();

        Activity::query()->create([
            'log_name' => 'folha',
            'description' => 'Pagamento atualizado',
            'subject_type' => User::class,
            'subject_id' => $master->id,
            'causer_type' => User::class,
            'causer_id' => $master->id,
            'event' => 'updated',
            'properties' => [
                'old' => ['status' => 'pending', 'valor' => 1200],
                'attributes' => ['status' => 'approved', 'valor' => 1500],
            ],
        ]);

        Sanctum::actingAs($master);

        $this->getJson('/api/activity-log')
            ->assertOk()
            ->assertJsonPath('data.0.change_count', 2)
            ->assertJsonPath('data.0.change_summary.0.field', 'status')
            ->assertJsonPath('data.0.change_summary.0.before', 'pending')
            ->assertJsonPath('data.0.change_summary.0.after', 'approved');
    }

    public function test_user_can_list_sessions_with_device_metadata(): void
    {
        $user = User::factory()->create();
        $currentToken = $user->createToken('Current session');
        $currentTokenModel = $currentToken->accessToken;

        $remoteToken = $user->createToken('Chrome notebook');
        $remoteTokenModel = $remoteToken->accessToken;

        $remoteTokenModel->forceFill([
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36',
            'last_activity_at' => now()->subDays(45),
        ])->save();

        $response = $this->withHeader('Authorization', 'Bearer '.$currentToken->plainTextToken)
            ->getJson('/api/settings/sessions');

        $response
            ->assertOk()
            ->assertJsonPath('current_token_id', $currentTokenModel->id);

        $remotePayload = collect($response->json('data'))
            ->firstWhere('id', $remoteTokenModel->id);

        $this->assertSame('Chrome', $remotePayload['device']['browser'] ?? null);
        $this->assertSame('Windows', $remotePayload['device']['os'] ?? null);
        $this->assertSame('desktop', $remotePayload['device']['device_type'] ?? null);
        $this->assertFalse((bool) ($remotePayload['is_current'] ?? true));
        $this->assertSame(45, $remotePayload['days_without_activity'] ?? null);
        $this->assertContains('stale', $remotePayload['risk_flags'] ?? []);
    }

    public function test_admin_can_access_new_insights_endpoints(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $funcao = Funcao::query()->create(['nome' => 'Motorista', 'ativo' => true]);
        $colaborador = Colaborador::query()->create([
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Carlos',
            'ativo' => true,
            'cpf' => '12345678901',
        ]);
        $interview = DriverInterview::factory()->create([
            'author_id' => $admin->id,
            'user_id' => $admin->id,
            'cpf' => '12345678901',
        ]);

        $onboarding = Onboarding::query()->create([
            'driver_interview_id' => $interview->id,
            'colaborador_id' => $colaborador->id,
            'responsavel_user_id' => $admin->id,
            'status' => 'em_andamento',
            'started_at' => now(),
        ]);

        OnboardingItem::query()->create([
            'onboarding_id' => $onboarding->id,
            'code' => 'doc',
            'title' => 'Documento',
            'required' => true,
            'status' => 'pendente',
            'due_date' => now()->subDay()->toDateString(),
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/insights/executive')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'interviews',
                    'payroll',
                    'freight',
                    'alerts',
                ],
            ]);

        $this->getJson('/api/insights/pending-by-unit')
            ->assertOk()
            ->assertJsonPath('data.0.unidade_id', $unidade->id)
            ->assertJsonPath('data.0.onboarding_overdue', 1);

        $this->getJson('/api/insights/data-quality')
            ->assertOk()
            ->assertJsonPath('summary.total_collaborators', 1)
            ->assertJsonPath('summary.missing_phone', 1);
    }

    public function test_master_admin_can_read_vacation_audit_diff_after_update(): void
    {
        $master = User::factory()->masterAdmin()->create();
        $admin = User::factory()->create(['role' => 'admin']);
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $funcao = Funcao::query()->create(['nome' => 'Motorista', 'ativo' => true]);
        $colaborador = Colaborador::query()->create([
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Colaborador Auditoria',
            'ativo' => true,
            'cpf' => '98765432100',
        ]);

        Sanctum::actingAs($admin);

        $lancamento = FeriasLancamento::query()->create([
            'colaborador_id' => $colaborador->id,
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'autor_id' => $admin->id,
            'tipo' => 'confirmado',
            'com_abono' => false,
            'dias_ferias' => 30,
            'data_inicio' => '2026-05-01',
            'data_fim' => '2026-05-30',
            'periodo_aquisitivo_inicio' => '2025-05-01',
            'periodo_aquisitivo_fim' => '2026-04-30',
            'observacoes' => 'Original',
        ]);

        $lancamento->update([
            'dias_ferias' => 20,
            'com_abono' => true,
            'data_fim' => '2026-05-20',
            'observacoes' => 'Atualizado',
        ]);

        Sanctum::actingAs($master);

        $response = $this->getJson('/api/activity-log?log_name=ferias&event=updated')
            ->assertOk()
            ->assertJsonPath('data.0.log_name', 'ferias')
            ->assertJsonPath('data.0.event', 'updated');

        $changes = collect($response->json('data.0.change_summary'));

        $this->assertTrue($changes->contains(fn (array $change): bool => $change['field'] === 'dias_ferias'));
        $this->assertTrue($changes->contains(fn (array $change): bool => $change['field'] === 'com_abono'));
    }

    public function test_admin_can_manage_operational_tasks_and_read_sla_summary(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $assignee = User::factory()->create(['role' => 'admin']);
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);

        Sanctum::actingAs($admin);

        $createResponse = $this->postJson('/api/operations/tasks', [
            'module_key' => 'payroll',
            'unidade_id' => $unidade->id,
            'title' => 'Revisar folha de abril',
            'description' => 'Conferir concentracao por unidade.',
            'priority' => 'high',
            'status' => 'open',
            'due_at' => now()->subHours(2)->toISOString(),
            'assigned_to' => $assignee->id,
        ])
            ->assertCreated()
            ->assertJsonPath('data.title', 'Revisar folha de abril');

        $taskId = (int) $createResponse->json('data.id');

        $this->getJson('/api/operations/tasks')
            ->assertOk()
            ->assertJsonPath('data.0.id', $taskId)
            ->assertJsonPath('data.0.sla_state', 'overdue');

        $this->getJson('/api/operations/tasks/summary')
            ->assertOk()
            ->assertJsonPath('summary.total', 1)
            ->assertJsonPath('summary.sla.overdue', 1)
            ->assertJsonPath('by_unit_risk.0.unidade_id', $unidade->id)
            ->assertJsonPath('by_unit_risk.0.overdue', 1)
            ->assertJsonPath('alerts.0.code', 'task_sla_overdue');

        $this->putJson('/api/operations/tasks/'.$taskId, [
            'status' => 'done',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'done');

        $this->assertDatabaseHas('operational_tasks', [
            'id' => $taskId,
            'status' => 'done',
        ]);

        $this->deleteJson('/api/operations/tasks/'.$taskId)
            ->assertNoContent();

        $this->assertDatabaseMissing('operational_tasks', [
            'id' => $taskId,
        ]);
    }

    public function test_financial_approval_supports_multistep_flow_for_high_value_payload(): void
    {
        config()->set('transport_features.financial_multistep_second_level_threshold', 1000);
        config()->set('transport_features.financial_multistep_second_level_people_threshold', 1);

        $requester = User::factory()->create(['role' => 'admin']);
        $approverOne = User::factory()->create(['role' => 'admin']);
        $approverTwo = User::factory()->create(['role' => 'master_admin']);

        $service = app(FinancialApprovalService::class);
        $summary = [
            'total_valor' => 5000,
            'total_colaboradores' => 3,
            'unidade_id' => 1,
            'data_pagamento' => '2026-04-29',
            'competencia_mes' => 4,
            'competencia_ano' => 2026,
        ];

        $approval = $service->requestOrReusePendingApproval(
            requester: $requester,
            actionKey: 'payroll.launch-batch',
            requestHash: hash('sha256', 'high-value-multistep'),
            summary: $summary,
        );

        $this->assertSame(2, (int) $approval->required_approvals);
        $this->assertSame(0, (int) $approval->approved_steps);
        $this->assertSame('pending', (string) $approval->status);

        $stepOne = $service->approve($approval, $approverOne);

        $this->assertSame('pending', (string) $stepOne->status);
        $this->assertSame(1, (int) $stepOne->approved_steps);
        $this->assertNull($stepOne->execution_token);

        $stepTwo = $service->approve($stepOne, $approverTwo);

        $this->assertSame('approved', (string) $stepTwo->status);
        $this->assertSame(2, (int) $stepTwo->approved_steps);
        $this->assertNotNull($stepTwo->execution_token);

        $history = collect((array) $stepTwo->approval_history);
        $this->assertCount(2, $history);
        $this->assertSame($approverOne->id, (int) ($history[0]['approver_id'] ?? 0));
        $this->assertSame($approverTwo->id, (int) ($history[1]['approver_id'] ?? 0));
    }
}
