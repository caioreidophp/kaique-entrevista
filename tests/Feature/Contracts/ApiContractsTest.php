<?php

namespace Tests\Feature\Contracts;

use App\Models\Colaborador;
use App\Models\FreightEntry;
use App\Models\Funcao;
use App\Models\Pagamento;
use App\Models\TipoPagamento;
use App\Models\Unidade;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('contract')]
class ApiContractsTest extends TestCase
{
    use RefreshDatabase;

    public function test_freight_dashboard_page_contract_remains_stable(): void
    {
        $user = User::factory()->create(['role' => 'master_admin']);
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);

        FreightEntry::query()->create([
            'data' => '2026-04-01',
            'unidade_id' => $unidade->id,
            'autor_id' => $user->id,
            'frete_total' => 1000,
            'cargas' => 2,
            'aves' => 100,
            'veiculos' => 1,
            'km_rodado' => 1500,
            'frete_terceiros' => 0,
            'viagens_terceiros' => 0,
            'aves_terceiros' => 0,
            'frete_liquido' => 1000,
            'cargas_liq' => 2,
            'aves_liq' => 100,
            'kaique' => 0,
            'vdm' => 0,
            'frete_programado' => 0,
            'cargas_programadas' => 0,
            'aves_programadas' => 0,
            'cargas_canceladas_escaladas' => 0,
            'nao_escaladas' => 0,
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/freight/dashboard-page?competencia_mes=4&competencia_ano=2026')
            ->assertOk()
            ->assertJsonStructure([
                'units' => [['id', 'nome']],
                'dashboard' => [
                    'competencia_mes',
                    'competencia_ano',
                    'kpis' => ['total_lancamentos', 'total_frete', 'total_km'],
                    'alerts',
                    'por_unidade',
                    'lancamentos_recentes',
                ],
                'entries' => ['data', 'current_page', 'last_page', 'total'],
            ]);
    }

    public function test_payroll_dashboard_page_contract_remains_stable(): void
    {
        $user = User::factory()->create(['role' => 'master_admin']);
        $unidade = Unidade::query()->create(['nome' => 'Jarinu', 'slug' => 'jarinu']);
        $funcao = Funcao::query()->create(['nome' => 'Motorista']);
        $tipo = TipoPagamento::query()->create([
            'nome' => 'Salário',
            'categoria' => 'salario',
            'forma_pagamento' => 'conta',
            'gera_encargos' => true,
        ]);

        $colaborador = Colaborador::query()->create([
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Carlos da Silva',
            'ativo' => true,
            'cpf' => '12345678901',
            'data_admissao' => '2025-01-01',
        ]);

        Pagamento::query()->create([
            'colaborador_id' => $colaborador->id,
            'unidade_id' => $unidade->id,
            'autor_id' => $user->id,
            'tipo_pagamento_id' => $tipo->id,
            'competencia_mes' => 4,
            'competencia_ano' => 2026,
            'valor' => 3500,
            'descricao' => 'Salário',
            'data_pagamento' => '2026-04-05',
            'lancado_em' => now(),
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/payroll/dashboard-page?competencia_mes=4&competencia_ano=2026')
            ->assertOk()
            ->assertJsonStructure([
                'dashboard' => [
                    'competencia_mes',
                    'competencia_ano',
                    'colaboradores_pagos_mes',
                    'total_pagamentos_lancados',
                    'total_a_pagar_mes_atual',
                    'totais_por_unidade',
                    'totais_por_tipo',
                    'pagamentos_recentes',
                ],
                'summary' => [
                    'competencia_mes',
                    'competencia_ano',
                    'total_lancamentos',
                    'total_colaboradores',
                    'total_valor',
                    'por_unidade',
                ],
            ]);
    }

    public function test_vacation_dashboard_contract_remains_stable(): void
    {
        $user = User::factory()->create(['role' => 'master_admin']);
        $unidade = Unidade::query()->create(['nome' => 'Atibaia', 'slug' => 'atibaia']);
        $funcao = Funcao::query()->create(['nome' => 'Ajudante']);

        Colaborador::query()->create([
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'nome' => 'João Pereira',
            'ativo' => true,
            'cpf' => '98765432109',
            'data_admissao' => '2024-01-10',
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/payroll/vacations/dashboard')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'ferias_vencidas',
                    'ferias_a_vencer',
                    'faixa_a_vencer',
                    'faixa_liberada',
                    'faixa_atencao',
                    'faixa_urgente',
                    'taxa_liberadas_sobre_ativos',
                    'ferias_vigentes',
                    'timeline',
                ],
            ]);
    }
}
