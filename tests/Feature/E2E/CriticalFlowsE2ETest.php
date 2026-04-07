<?php

namespace Tests\Feature\E2E;

use App\Models\Colaborador;
use App\Models\Funcao;
use App\Models\TipoPagamento;
use App\Models\Unidade;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('e2e')]
class CriticalFlowsE2ETest extends TestCase
{
    use RefreshDatabase;

    public function test_critical_end_to_end_flows_work_with_authenticated_token(): void
    {
        $password = 'Secret@12345';

        $user = User::factory()->create([
            'role' => 'master_admin',
            'email' => 'master.e2e@example.com',
            'password' => Hash::make($password),
        ]);

        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $funcao = Funcao::query()->create(['nome' => 'Motorista']);
        $tipoPagamento = TipoPagamento::query()->create([
            'nome' => 'Salário',
            'categoria' => 'salario',
            'forma_pagamento' => 'conta',
            'gera_encargos' => true,
        ]);

        $colaborador = Colaborador::query()->create([
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Adair Souza',
            'ativo' => true,
            'cpf' => '12345678901',
            'data_admissao' => '2025-01-10',
        ]);

        $login = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => $password,
        ])->assertOk();

        $token = (string) $login->json('token');

        $api = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ]);

        $api->postJson('/api/freight/entries', [
            'data' => '2026-04-01',
            'unidade_id' => $unidade->id,
            'frete_total' => 12000,
            'cargas' => 12,
            'aves' => 1800,
            'veiculos' => 3,
            'km_rodado' => 11000,
            'frete_terceiros' => 500,
            'viagens_terceiros' => 1,
            'aves_terceiros' => 120,
        ], [
            'Idempotency-Key' => 'e2e-freight-20260401',
        ])->assertCreated();

        $api->postJson('/api/payroll/pagamentos', [
            'colaborador_id' => $colaborador->id,
            'tipo_pagamento_id' => $tipoPagamento->id,
            'competencia_mes' => 4,
            'competencia_ano' => 2026,
            'valor' => 3500,
            'descricao' => 'Salário mensal E2E',
            'data_pagamento' => '2026-04-05',
        ])->assertCreated();

        $api->postJson('/api/payroll/vacations', [
            'colaborador_id' => $colaborador->id,
            'tipo' => 'confirmado',
            'com_abono' => true,
            'dias_ferias' => 20,
            'data_inicio' => '2026-05-01',
            'data_fim' => '2026-05-20',
            'periodo_aquisitivo_inicio' => '2025-01-10',
            'periodo_aquisitivo_fim' => '2026-01-09',
        ], [
            'Idempotency-Key' => 'e2e-vacation-20260501',
        ])->assertCreated();

        $api->getJson('/api/home')->assertOk();
        $api->getJson('/api/freight/dashboard-page?competencia_mes=4&competencia_ano=2026')->assertOk();
        $api->getJson('/api/payroll/dashboard-page?competencia_mes=4&competencia_ano=2026')->assertOk();
        $api->getJson('/api/payroll/vacations/dashboard')->assertOk();
        $api->getJson('/api/system/observability')->assertOk();
        $api->getJson('/api/system/queue')->assertOk();
    }
}
