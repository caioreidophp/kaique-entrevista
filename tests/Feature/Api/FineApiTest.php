<?php

namespace Tests\Feature\Api;

use App\Models\Colaborador;
use App\Models\Funcao;
use App\Models\Multa;
use App\Models\MultaInfracao;
use App\Models\MultaOrgaoAutuador;
use App\Models\PlacaFrota;
use App\Models\Unidade;
use App\Models\User;
use App\Models\UserAccessScope;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FineApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_fine_scope_filters_reference_and_blocks_other_unit_record(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unidadePermitida = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $unidadeBloqueada = Unidade::query()->create(['nome' => 'Tatui', 'slug' => 'tatui']);
        $funcao = Funcao::query()->create(['nome' => 'Motorista', 'ativo' => true]);
        $infracao = MultaInfracao::query()->create(['nome' => 'Excesso de velocidade', 'ativo' => true]);
        $orgao = MultaOrgaoAutuador::query()->create(['nome' => 'DER', 'ativo' => true]);

        $placaPermitida = PlacaFrota::query()->create([
            'placa' => 'ABC1D23',
            'unidade_id' => $unidadePermitida->id,
        ]);

        $placaBloqueada = PlacaFrota::query()->create([
            'placa' => 'XYZ9K88',
            'unidade_id' => $unidadeBloqueada->id,
        ]);

        $motoristaPermitido = Colaborador::query()->create([
            'unidade_id' => $unidadePermitida->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Motorista Permitido',
            'ativo' => true,
            'cpf' => '11122233344',
        ]);

        $motoristaBloqueado = Colaborador::query()->create([
            'unidade_id' => $unidadeBloqueada->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Motorista Bloqueado',
            'ativo' => true,
            'cpf' => '55566677788',
        ]);

        $multaPermitida = Multa::query()->create([
            'data' => '2026-04-10',
            'hora' => '08:00',
            'tipo_registro' => 'multa',
            'unidade_id' => $unidadePermitida->id,
            'placa_frota_id' => $placaPermitida->id,
            'multa_infracao_id' => $infracao->id,
            'multa_orgao_autuador_id' => $orgao->id,
            'colaborador_id' => $motoristaPermitido->id,
            'descricao' => 'Permitida',
            'numero_auto_infracao' => 'A1',
            'indicado_condutor' => true,
            'culpa' => 'motorista',
            'valor' => 150.50,
            'tipo_valor' => 'normal',
            'vencimento' => '2026-05-10',
            'status' => 'aguardando_motorista',
            'descontar' => true,
            'autor_id' => $admin->id,
        ]);

        $multaBloqueada = Multa::query()->create([
            'data' => '2026-04-11',
            'hora' => '09:00',
            'tipo_registro' => 'multa',
            'unidade_id' => $unidadeBloqueada->id,
            'placa_frota_id' => $placaBloqueada->id,
            'multa_infracao_id' => $infracao->id,
            'multa_orgao_autuador_id' => $orgao->id,
            'colaborador_id' => $motoristaBloqueado->id,
            'descricao' => 'Bloqueada',
            'numero_auto_infracao' => 'B2',
            'indicado_condutor' => true,
            'culpa' => 'motorista',
            'valor' => 200.00,
            'tipo_valor' => 'normal',
            'vencimento' => '2026-05-11',
            'status' => 'aguardando_motorista',
            'descontar' => true,
            'autor_id' => $admin->id,
        ]);

        UserAccessScope::query()->create([
            'user_id' => $admin->id,
            'module_key' => 'fines',
            'data_scope' => 'units',
            'allowed_unit_ids' => [$unidadePermitida->id],
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/fines?tipo_registro=multa')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $multaPermitida->id);

        $this->getJson('/api/fines/reference')
            ->assertOk()
            ->assertJsonCount(1, 'unidades')
            ->assertJsonCount(1, 'placas')
            ->assertJsonCount(1, 'motoristas')
            ->assertJsonPath('unidades.0.id', $unidadePermitida->id);

        $this->getJson('/api/fines/dashboard?data_inicio=2026-04-01&data_fim=2026-04-30')
            ->assertOk()
            ->assertJsonPath('totals.quantidade', 1)
            ->assertJsonPath('totals.valor_medio', 150.5)
            ->assertJsonPath('totals.top_placa.label', 'ABC1D23');

        $this->getJson('/api/fines/'.$multaBloqueada->id)
            ->assertForbidden();
    }

    public function test_fine_store_can_require_approval_and_create_after_token_consumption(): void
    {
        config()->set('transport_features.financial_double_approval', true);
        config()->set('transport_features.financial_fine_approval', true);
        config()->set('transport_features.financial_fine_approval_threshold', 100);

        $requester = User::factory()->create(['role' => 'admin']);
        $approver = User::factory()->masterAdmin()->create();
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $funcao = Funcao::query()->create(['nome' => 'Motorista', 'ativo' => true]);
        $infracao = MultaInfracao::query()->create(['nome' => 'Direcao perigosa', 'ativo' => true]);
        $orgao = MultaOrgaoAutuador::query()->create(['nome' => 'DER', 'ativo' => true]);
        $placa = PlacaFrota::query()->create([
            'placa' => 'QWE1R23',
            'unidade_id' => $unidade->id,
        ]);
        $motorista = Colaborador::query()->create([
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Motorista Fluxo',
            'ativo' => true,
            'cpf' => '33322211100',
        ]);

        $payload = [
            'tipo_registro' => 'multa',
            'data' => '2026-04-10',
            'hora' => '08:15',
            'placa_frota_id' => $placa->id,
            'multa_infracao_id' => $infracao->id,
            'descricao' => 'Validacao de fluxo de aprovacao',
            'numero_auto_infracao' => 'AUTO-900',
            'multa_orgao_autuador_id' => $orgao->id,
            'colaborador_id' => $motorista->id,
            'indicado_condutor' => true,
            'culpa' => 'motorista',
            'valor' => '550,00',
            'tipo_valor' => 'normal',
            'vencimento' => '2026-05-10',
            'status' => 'aguardando_motorista',
            'descontar' => true,
        ];

        Sanctum::actingAs($requester);

        $approvalResponse = $this->postJson('/api/fines', $payload)
            ->assertStatus(202)
            ->assertJsonPath('approval_required', true);

        $approvalId = (int) $approvalResponse->json('approval_id');
        $this->assertGreaterThan(0, $approvalId);

        Sanctum::actingAs($approver);

        $approved = $this->postJson('/api/payroll/approvals/'.$approvalId.'/approve', [])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $token = (string) $approved->json('execution_token');
        $this->assertNotSame('', $token);

        Sanctum::actingAs($requester);

        $this->postJson('/api/fines', [
            ...$payload,
            'financial_approval_token' => $token,
        ])
            ->assertCreated()
            ->assertJsonPath('data.unidade_id', $unidade->id);

        $this->assertDatabaseHas('multas', [
            'unidade_id' => $unidade->id,
            'placa_frota_id' => $placa->id,
            'colaborador_id' => $motorista->id,
            'status' => 'aguardando_motorista',
            'descontar' => true,
        ]);
    }
}
