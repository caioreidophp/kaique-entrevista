<?php

namespace Tests\Feature\Api;

use App\Models\FreightEntry;
use App\Models\Colaborador;
use App\Models\DriverInterview;
use App\Models\Funcao;
use App\Models\Pagamento;
use App\Models\TipoPagamento;
use App\Models\Unidade;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BobAssistantApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_get_bob_help_message(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->postJson('/api/bob/chat', [
            'message' => 'ajuda',
        ])
            ->assertOk()
            ->assertJsonPath('intent', 'help')
            ->assertJsonStructure(['reply']);
    }

    public function test_admin_can_launch_freight_using_bob_text_command(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);

        Sanctum::actingAs($admin);

        $this->postJson('/api/bob/chat', [
            'message' => 'lancar frete data 01/03/2026 unidade Amparo frete 12000 cargas 12 aves 1800 veiculos 3 km 11000 terceiros frete 500 terceiros viagens 1 terceiros aves 120',
        ])
            ->assertOk()
            ->assertJsonPath('intent', 'launch_freight');

        $this->assertDatabaseHas('freight_entries', [
            'data' => '2026-03-01 00:00:00',
            'unidade_id' => $unidade->id,
            'autor_id' => $admin->id,
            'frete_total' => 12000,
            'km_rodado' => 11000,
            'cargas' => 12,
            'aves' => 1800,
        ]);

        $entry = FreightEntry::query()->first();
        $this->assertNotNull($entry);
        $this->assertSame('11500.00', $entry->frete_liquido);
    }

    public function test_usuario_cannot_use_bob_endpoint(): void
    {
        $usuario = User::factory()->create(['role' => 'usuario']);
        Sanctum::actingAs($usuario);

        $this->postJson('/api/bob/chat', [
            'message' => 'ajuda',
        ])->assertForbidden();

        $this->getJson('/api/bob/history')->assertForbidden();
        $this->deleteJson('/api/bob/history')->assertForbidden();
    }

    public function test_admin_can_load_bob_history_after_chat(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->postJson('/api/bob/chat', [
            'message' => 'ajuda',
        ])->assertOk();

        $response = $this->getJson('/api/bob/history')
            ->assertOk()
            ->assertJsonStructure([
                'messages' => [
                    ['id', 'role', 'content', 'created_at'],
                ],
            ]);

        $messages = $response->json('messages');
        $this->assertCount(2, $messages);
        $this->assertSame('user', $messages[0]['role']);
        $this->assertSame('bob', $messages[1]['role']);
        $this->assertDatabaseCount('bob_assistant_messages', 2);
    }

    public function test_admin_can_clear_bob_history(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->postJson('/api/bob/chat', [
            'message' => 'ajuda',
        ])->assertOk();

        $this->assertSame(2, DB::table('bob_assistant_messages')->where('user_id', $admin->id)->count());

        $this->deleteJson('/api/bob/history')->assertNoContent();

        $this->assertSame(0, DB::table('bob_assistant_messages')->where('user_id', $admin->id)->count());
    }

    public function test_admin_can_get_vacation_due_for_collaborator(): void
    {
        Carbon::setTestNow('2026-03-25 10:00:00');

        $admin = User::factory()->create(['role' => 'admin']);
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $funcao = Funcao::query()->create(['nome' => 'Motorista']);

        Colaborador::query()->create([
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Adair Souza',
            'ativo' => true,
            'cpf' => '12345678901',
            'data_admissao' => '2024-01-10',
        ]);

        Sanctum::actingAs($admin);

        $this->postJson('/api/bob/chat', [
            'message' => 'quando vai vencer as ferias do adair souza',
        ])
            ->assertOk()
            ->assertJsonPath('intent', 'vacation_due')
            ->assertJsonFragment(['intent' => 'vacation_due']);

        Carbon::setTestNow();
    }

    public function test_admin_can_get_payroll_summary(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $funcao = Funcao::query()->create(['nome' => 'Motorista Folha']);
        $tipo = TipoPagamento::query()->create([
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
            'cpf' => '22233344455',
            'data_admissao' => '2025-01-10',
        ]);

        Pagamento::query()->create([
            'colaborador_id' => $colaborador->id,
            'unidade_id' => $unidade->id,
            'autor_id' => $admin->id,
            'tipo_pagamento_id' => $tipo->id,
            'competencia_mes' => 3,
            'competencia_ano' => 2026,
            'valor' => 3500,
            'descricao' => 'Salário mensal',
        ]);

        Sanctum::actingAs($admin);

        $this->postJson('/api/bob/chat', [
            'message' => 'resumo pagamentos março 2026',
        ])
            ->assertOk()
            ->assertJsonPath('intent', 'payroll_summary');
    }

    public function test_admin_can_get_interview_summary(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        DriverInterview::factory()->create([
            'author_id' => $admin->id,
            'user_id' => $admin->id,
            'full_name' => 'Candidato A',
            'hr_status' => 'aprovado',
            'guep_status' => 'aprovado',
        ]);

        DriverInterview::factory()->create([
            'author_id' => $admin->id,
            'user_id' => $admin->id,
            'full_name' => 'Candidato B',
            'hr_status' => 'em_analise',
            'guep_status' => 'a_fazer',
        ]);

        $this->postJson('/api/bob/chat', [
            'message' => 'resumo entrevistas',
        ])
            ->assertOk()
            ->assertJsonPath('intent', 'interview_summary');
    }
}
