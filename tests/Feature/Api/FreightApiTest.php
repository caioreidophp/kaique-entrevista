<?php

namespace Tests\Feature\Api;

use App\Models\FreightEntry;
use App\Models\Unidade;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FreightApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_freight_endpoints_require_authentication(): void
    {
        $this->getJson('/api/freight/dashboard')->assertUnauthorized();
        $this->postJson('/api/freight/entries', [])->assertUnauthorized();
    }

    public function test_admin_can_create_or_update_daily_freight_entry_once(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);

        Sanctum::actingAs($admin);

        $payload = [
            'data' => '2026-03-01',
            'unidade_id' => $unidade->id,
            'frete_total' => 10000,
            'cargas' => 10,
            'aves' => 2000,
            'veiculos' => 5,
            'km_rodado' => 1000,
            'frete_terceiros' => 1500,
            'viagens_terceiros' => 1,
            'aves_terceiros' => 150,
        ];

        $this->postJson('/api/freight/entries', $payload)
            ->assertCreated()
            ->assertJsonPath('data.frete_total', '10000.00')
            ->assertJsonPath('data.frete_liquido', '8500.00');

        $this->postJson('/api/freight/entries', [
            ...$payload,
            'frete_total' => 12000,
        ])->assertCreated();

        $this->assertDatabaseCount('freight_entries', 1);
        $this->assertDatabaseHas('freight_entries', [
            'data' => '2026-03-01 00:00:00',
            'unidade_id' => $unidade->id,
            'frete_total' => 12000,
        ]);
    }

    public function test_dashboard_and_timeline_return_expected_data(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unidadeA = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $unidadeB = Unidade::query()->create(['nome' => 'Jarinu', 'slug' => 'jarinu']);

        FreightEntry::query()->create([
            'data' => '2026-03-01',
            'unidade_id' => $unidadeA->id,
            'autor_id' => $admin->id,
            'frete_total' => 1000,
            'cargas' => 10,
            'aves' => 500,
            'veiculos' => 2,
            'km_rodado' => 100,
            'frete_terceiros' => 0,
            'viagens_terceiros' => 0,
            'aves_terceiros' => 0,
            'frete_liquido' => 1000,
            'cargas_liq' => 10,
            'aves_liq' => 500,
            'kaique' => 0,
            'vdm' => 0,
            'frete_programado' => 0,
            'cargas_programadas' => 0,
            'aves_programadas' => 0,
            'cargas_canceladas_escaladas' => 0,
            'nao_escaladas' => 0,
        ]);

        FreightEntry::query()->create([
            'data' => '2026-03-02',
            'unidade_id' => $unidadeB->id,
            'autor_id' => $admin->id,
            'frete_total' => 2000,
            'cargas' => 15,
            'aves' => 900,
            'veiculos' => 4,
            'km_rodado' => 200,
            'frete_terceiros' => 500,
            'viagens_terceiros' => 1,
            'aves_terceiros' => 100,
            'frete_liquido' => 1500,
            'cargas_liq' => 14,
            'aves_liq' => 800,
            'kaique' => 0,
            'vdm' => 0,
            'frete_programado' => 0,
            'cargas_programadas' => 0,
            'aves_programadas' => 0,
            'cargas_canceladas_escaladas' => 0,
            'nao_escaladas' => 0,
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/freight/dashboard?competencia_mes=3&competencia_ano=2026')
            ->assertOk()
            ->assertJsonPath('kpis.total_lancamentos', 2)
            ->assertJsonPath('kpis.total_frete', 3000)
            ->assertJsonPath('kpis.total_km', 300);

        $this->getJson('/api/freight/timeline?start_date=2026-03-01&end_date=2026-03-31')
            ->assertOk()
            ->assertJsonCount(2, 'series')
            ->assertJsonPath('series.0.points.0.data', '2026-03-01');
    }
}
