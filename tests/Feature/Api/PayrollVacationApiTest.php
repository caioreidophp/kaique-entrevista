<?php

namespace Tests\Feature\Api;

use App\Models\Colaborador;
use App\Models\FeriasLancamento;
use App\Models\Funcao;
use App\Models\Unidade;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayrollVacationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_vacation_endpoints_require_authentication(): void
    {
        $this->getJson('/api/payroll/vacations/dashboard')->assertUnauthorized();
        $this->getJson('/api/payroll/vacations')->assertUnauthorized();
        $this->postJson('/api/payroll/vacations', [])->assertUnauthorized();
    }

    public function test_admin_can_create_and_list_vacation_launches(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $colaborador = $this->createColaborador(cpf: '91919191919');

        Sanctum::actingAs($admin);

        $payload = [
            'colaborador_id' => $colaborador->id,
            'com_abono' => false,
            'data_inicio' => now()->startOfMonth()->toDateString(),
            'periodo_aquisitivo_inicio' => now()->subYear()->startOfMonth()->toDateString(),
            'periodo_aquisitivo_fim' => now()->subYear()->endOfMonth()->toDateString(),
        ];

        $this->postJson('/api/payroll/vacations', $payload)
            ->assertCreated()
            ->assertJsonPath('data.colaborador_id', $colaborador->id)
            ->assertJsonPath('data.autor_id', $admin->id)
            ->assertJsonPath('data.dias_ferias', 30);

        $this->assertDatabaseHas('ferias_lancamentos', [
            'colaborador_id' => $colaborador->id,
            'autor_id' => $admin->id,
            'dias_ferias' => 30,
        ]);

        $this->getJson('/api/payroll/vacations/launched')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.colaborador_id', $colaborador->id);

        $this->getJson('/api/payroll/vacations/dashboard')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'ferias_vencidas',
                    'ferias_a_vencer',
                    'limite_proximos_4_meses',
                    'limite_proximos_2_meses',
                    'ferias_programadas_30_dias',
                    'lancamentos_ano_atual',
                    'percentual_com_abono',
                    'percentual_sem_abono',
                    'taxa_vencidas_sobre_ativos',
                ],
            ]);
    }

    public function test_master_admin_can_access_any_collaborator_vacation_history(): void
    {
        $master = User::factory()->masterAdmin()->create();
        $author = User::factory()->create(['role' => 'admin']);
        $colaborador = $this->createColaborador(cpf: '81818181818');

        FeriasLancamento::query()->create([
            'colaborador_id' => $colaborador->id,
            'unidade_id' => $colaborador->unidade_id,
            'funcao_id' => $colaborador->funcao_id,
            'autor_id' => $author->id,
            'com_abono' => true,
            'dias_ferias' => 20,
            'data_inicio' => now()->subMonths(2)->startOfMonth()->toDateString(),
            'data_fim' => now()->subMonths(2)->startOfMonth()->addDays(19)->toDateString(),
            'periodo_aquisitivo_inicio' => now()->subYears(2)->startOfMonth()->toDateString(),
            'periodo_aquisitivo_fim' => now()->subYear()->endOfMonth()->toDateString(),
        ]);

        Sanctum::actingAs($master);

        $this->getJson('/api/payroll/vacations/collaborators/'.$colaborador->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.dias_ferias', 20)
            ->assertJsonPath('data.0.com_abono', true);
    }

    public function test_usuario_role_is_forbidden_on_vacation_management_endpoints(): void
    {
        $usuario = User::factory()->create(['role' => 'usuario']);
        $colaborador = $this->createColaborador(cpf: '71717171717');
        $lancamento = FeriasLancamento::query()->create([
            'colaborador_id' => $colaborador->id,
            'unidade_id' => $colaborador->unidade_id,
            'funcao_id' => $colaborador->funcao_id,
            'autor_id' => User::factory()->create(['role' => 'admin'])->id,
            'com_abono' => false,
            'dias_ferias' => 30,
            'data_inicio' => now()->startOfMonth()->toDateString(),
            'data_fim' => now()->startOfMonth()->addDays(29)->toDateString(),
            'periodo_aquisitivo_inicio' => now()->subYear()->startOfMonth()->toDateString(),
            'periodo_aquisitivo_fim' => now()->subYear()->endOfMonth()->toDateString(),
        ]);

        Sanctum::actingAs($usuario);

        $this->getJson('/api/payroll/vacations/dashboard')->assertForbidden();
        $this->getJson('/api/payroll/vacations')->assertForbidden();
        $this->getJson('/api/payroll/vacations/candidates')->assertForbidden();
        $this->getJson('/api/payroll/vacations/launched')->assertForbidden();
        $this->getJson('/api/payroll/vacations/collaborators/'.$colaborador->id)->assertForbidden();

        $payload = [
            'colaborador_id' => $colaborador->id,
            'com_abono' => false,
            'data_inicio' => now()->startOfMonth()->toDateString(),
            'periodo_aquisitivo_inicio' => now()->subYear()->startOfMonth()->toDateString(),
            'periodo_aquisitivo_fim' => now()->subYear()->endOfMonth()->toDateString(),
        ];

        $this->postJson('/api/payroll/vacations', $payload)->assertForbidden();
        $this->putJson('/api/payroll/vacations/'.$lancamento->id, $payload)->assertForbidden();
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
            'data_admissao' => now()->subYears(2)->toDateString(),
        ]);
    }
}
