<?php

namespace Tests\Feature\Api;

use App\Models\Colaborador;
use App\Models\Funcao;
use App\Models\Pagamento;
use App\Models\TipoPagamento;
use App\Models\Unidade;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayrollApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_payroll_endpoints_require_authentication(): void
    {
        $this->getJson('/api/payroll/summary')->assertUnauthorized();
        $this->getJson('/api/payroll/pagamentos')->assertUnauthorized();
    }

    public function test_usuario_role_is_forbidden_on_payroll_management_endpoints(): void
    {
        $usuario = User::factory()->create(['role' => 'usuario']);
        $colaborador = $this->createColaborador(cpf: '90909090909');
        Sanctum::actingAs($usuario);

        $this->getJson('/api/payroll/summary')->assertForbidden();
        $this->getJson('/api/payroll/dashboard')->assertForbidden();
        $this->getJson('/api/payroll/pagamentos')->assertForbidden();
        $this->postJson('/api/payroll/pagamentos', [
            'colaborador_id' => $colaborador->id,
            'competencia_mes' => 2,
            'competencia_ano' => 2026,
            'valor' => 1000,
        ])->assertForbidden();
    }

    public function test_admin_can_create_pagamento_and_unidade_is_derived_from_colaborador(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $colaborador = $this->createColaborador();

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/payroll/pagamentos', [
            'colaborador_id' => $colaborador->id,
            'competencia_mes' => 2,
            'competencia_ano' => 2026,
            'valor' => 3200.50,
            'observacao' => 'Pagamento mensal',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.colaborador_id', $colaborador->id)
            ->assertJsonPath('data.unidade_id', $colaborador->unidade_id)
            ->assertJsonPath('data.autor_id', $admin->id)
            ->assertJsonPath('data.competencia_mes', 2)
            ->assertJsonPath('data.competencia_ano', 2026);

        $this->assertDatabaseHas('pagamentos', [
            'colaborador_id' => $colaborador->id,
            'unidade_id' => $colaborador->unidade_id,
            'autor_id' => $admin->id,
            'competencia_mes' => 2,
            'competencia_ano' => 2026,
        ]);
    }

    public function test_cannot_create_duplicate_pagamento_for_same_competencia_and_colaborador(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $colaborador = $this->createColaborador();

        Pagamento::query()->create([
            'colaborador_id' => $colaborador->id,
            'unidade_id' => $colaborador->unidade_id,
            'autor_id' => $admin->id,
            'competencia_mes' => 2,
            'competencia_ano' => 2026,
            'valor' => 1000,
            'lancado_em' => now(),
        ]);

        Sanctum::actingAs($admin);

        $this->postJson('/api/payroll/pagamentos', [
            'colaborador_id' => $colaborador->id,
            'competencia_mes' => 2,
            'competencia_ano' => 2026,
            'valor' => 2000,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('colaborador_id');
    }

    public function test_admin_can_only_view_own_pagamentos(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $otherAdmin = User::factory()->create(['role' => 'admin']);

        $colaborador = $this->createColaborador();

        Pagamento::query()->create([
            'colaborador_id' => $colaborador->id,
            'unidade_id' => $colaborador->unidade_id,
            'autor_id' => $admin->id,
            'competencia_mes' => 2,
            'competencia_ano' => 2026,
            'valor' => 1100,
            'lancado_em' => now(),
        ]);

        $otherPayment = Pagamento::query()->create([
            'colaborador_id' => $this->createColaborador(cpf: '11111111111')->id,
            'unidade_id' => $colaborador->unidade_id,
            'autor_id' => $otherAdmin->id,
            'competencia_mes' => 2,
            'competencia_ano' => 2026,
            'valor' => 2100,
            'lancado_em' => now(),
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/payroll/pagamentos')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->getJson("/api/payroll/pagamentos/{$otherPayment->id}")
            ->assertForbidden();
    }

    public function test_master_admin_can_filter_pagamentos_by_author(): void
    {
        $master = User::factory()->masterAdmin()->create();
        $authorA = User::factory()->create(['role' => 'admin']);
        $authorB = User::factory()->create(['role' => 'admin']);

        $colaboradorA = $this->createColaborador(cpf: '22222222222');
        $colaboradorB = $this->createColaborador(cpf: '33333333333');

        Pagamento::query()->create([
            'colaborador_id' => $colaboradorA->id,
            'unidade_id' => $colaboradorA->unidade_id,
            'autor_id' => $authorA->id,
            'competencia_mes' => 2,
            'competencia_ano' => 2026,
            'valor' => 1500,
            'lancado_em' => now(),
        ]);

        Pagamento::query()->create([
            'colaborador_id' => $colaboradorB->id,
            'unidade_id' => $colaboradorB->unidade_id,
            'autor_id' => $authorB->id,
            'competencia_mes' => 2,
            'competencia_ano' => 2026,
            'valor' => 2500,
            'lancado_em' => now(),
        ]);

        Sanctum::actingAs($master);

        $this->getJson("/api/payroll/pagamentos?autor_id={$authorA->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.autor_id', $authorA->id);
    }

    public function test_summary_returns_month_aggregates(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $colaboradorA = $this->createColaborador(cpf: '44444444444');
        $colaboradorB = $this->createColaborador(cpf: '55555555555');

        Pagamento::query()->create([
            'colaborador_id' => $colaboradorA->id,
            'unidade_id' => $colaboradorA->unidade_id,
            'autor_id' => $admin->id,
            'competencia_mes' => 2,
            'competencia_ano' => 2026,
            'valor' => 1200,
            'lancado_em' => now(),
        ]);

        Pagamento::query()->create([
            'colaborador_id' => $colaboradorB->id,
            'unidade_id' => $colaboradorB->unidade_id,
            'autor_id' => $admin->id,
            'competencia_mes' => 2,
            'competencia_ano' => 2026,
            'valor' => 1800,
            'lancado_em' => now(),
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/payroll/summary?competencia_mes=2&competencia_ano=2026')
            ->assertOk()
            ->assertJsonPath('total_lancamentos', 2)
            ->assertJsonPath('total_colaboradores', 2)
            ->assertJsonPath('total_valor', 3000);
    }

    public function test_dashboard_endpoint_returns_expected_metrics(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $colaborador = $this->createColaborador(cpf: '66666666666');

        Pagamento::query()->create([
            'colaborador_id' => $colaborador->id,
            'unidade_id' => $colaborador->unidade_id,
            'autor_id' => $admin->id,
            'competencia_mes' => (int) now()->month,
            'competencia_ano' => (int) now()->year,
            'valor' => 2000,
            'lancado_em' => now(),
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/payroll/dashboard')
            ->assertOk()
            ->assertJsonPath('total_pagamentos_lancados', 1)
            ->assertJsonPath('total_a_pagar_mes_atual', 2000);
    }

    public function test_can_load_launch_candidates_and_launch_batch(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $colaborador = $this->createColaborador(cpf: '77777777777');

        Sanctum::actingAs($admin);

        $this->getJson('/api/payroll/launch-candidates?unidade_id='.$colaborador->unidade_id.'&competencia_mes=2&competencia_ano=2026')
            ->assertOk()
            ->assertJsonPath('data.0.id', $colaborador->id);

        $this->postJson('/api/payroll/launch-batch', [
            'unidade_id' => $colaborador->unidade_id,
            'competencia_mes' => 2,
            'competencia_ano' => 2026,
            'pagamentos' => [
                [
                    'colaborador_id' => $colaborador->id,
                    'valor' => 2500,
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('created_count', 1);
    }

    public function test_launch_batch_can_update_existing_payment_when_editing_grouped_launch(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $colaborador = $this->createColaborador(cpf: '78787878787');

        $tipo = TipoPagamento::query()->create([
            'nome' => 'Vale Transporte',
            'gera_encargos' => false,
            'categoria' => 'beneficios',
            'forma_pagamento' => 'dinheiro',
        ]);

        $existing = Pagamento::query()->create([
            'colaborador_id' => $colaborador->id,
            'unidade_id' => $colaborador->unidade_id,
            'autor_id' => $admin->id,
            'tipo_pagamento_id' => $tipo->id,
            'competencia_mes' => 3,
            'competencia_ano' => 2026,
            'valor' => 250,
            'descricao' => 'Intermediário',
            'data_pagamento' => '2026-03-10',
            'lancado_em' => now(),
        ]);

        Sanctum::actingAs($admin);

        $this->postJson('/api/payroll/launch-batch', [
            'unidade_id' => $colaborador->unidade_id,
            'descricao' => 'Intermediário',
            'data_pagamento' => '2026-03-10',
            'tipo_pagamento_ids' => [$tipo->id],
            'pagamentos' => [
                [
                    'colaborador_id' => $colaborador->id,
                    'selected' => true,
                    'valores_por_tipo' => [
                        (string) $tipo->id => '440.00',
                    ],
                    'pagamentos_existentes_por_tipo' => [
                        (string) $tipo->id => [
                            'id' => $existing->id,
                        ],
                    ],
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('created_count', 1);

        $this->assertDatabaseHas('pagamentos', [
            'id' => $existing->id,
            'valor' => 440,
            'descricao' => 'Intermediário',
        ]);

        $this->assertSame(
            1,
            Pagamento::query()
                ->where('colaborador_id', $colaborador->id)
                ->where('tipo_pagamento_id', $tipo->id)
                ->whereDate('data_pagamento', '2026-03-10')
                ->count(),
        );
    }

    public function test_report_endpoints_return_payload(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $colaborador = $this->createColaborador(cpf: '88888888888');

        Pagamento::query()->create([
            'colaborador_id' => $colaborador->id,
            'unidade_id' => $colaborador->unidade_id,
            'autor_id' => $admin->id,
            'competencia_mes' => 2,
            'competencia_ano' => 2026,
            'valor' => 1900,
            'lancado_em' => now(),
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/payroll/reports/unidade?unidade_id='.$colaborador->unidade_id.'&competencia_mes=2&competencia_ano=2026')
            ->assertOk()
            ->assertJsonPath('total_pago_mes', 1900);

        $this->getJson('/api/payroll/reports/colaborador?colaborador_id='.$colaborador->id)
            ->assertOk()
            ->assertJsonPath('colaborador.id', $colaborador->id)
            ->assertJsonPath('total_acumulado', 1900);
    }

    private function createColaborador(string $cpf = '12345678901'): Colaborador
    {
        $unidade = Unidade::query()->first() ?? Unidade::query()->create([
            'nome' => 'Amparo',
            'slug' => 'amparo',
        ]);

        $funcao = Funcao::query()->first() ?? Funcao::query()->create([
            'nome' => 'Motorista',
            'ativo' => true,
        ]);

        return Colaborador::query()->create([
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Colaborador '.$cpf,
            'ativo' => true,
            'cpf' => $cpf,
            'rg' => '123456789X',
            'telefone' => '11999999999',
        ]);
    }
}
