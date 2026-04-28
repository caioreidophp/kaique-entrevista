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

        $this->getJson('/api/fines/'.$multaBloqueada->id)
            ->assertForbidden();
    }
}
