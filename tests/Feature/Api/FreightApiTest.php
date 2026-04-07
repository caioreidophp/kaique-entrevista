<?php

namespace Tests\Feature\Api;

use App\Models\FreightCanceledLoad;
use App\Models\FreightEntry;
use App\Models\Unidade;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class FreightApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_freight_endpoints_require_authentication(): void
    {
        $this->getJson('/api/freight/dashboard')->assertUnauthorized();
        $this->postJson('/api/freight/entries', [])->assertUnauthorized();
    }

    public function test_usuario_role_is_forbidden_on_freight_management_endpoints(): void
    {
        $usuario = User::factory()->create(['role' => 'usuario']);
        $unidade = Unidade::query()->create(['nome' => 'Bragança', 'slug' => 'braganca']);
        Sanctum::actingAs($usuario);

        $this->getJson('/api/freight/dashboard')->assertForbidden();
        $this->getJson('/api/freight/entries')->assertForbidden();
        $this->postJson('/api/freight/entries', [
            'data' => '2026-03-01',
            'unidade_id' => $unidade->id,
            'frete_total' => 1000,
            'cargas' => 2,
            'aves' => 100,
            'veiculos' => 1,
            'km_rodado' => 50,
            'frete_terceiros' => 0,
            'viagens_terceiros' => 0,
            'aves_terceiros' => 0,
        ])->assertForbidden();
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
            ->assertJsonPath('kpis.total_km', 300)
            ->assertJsonPath('kpis.frete_por_km', 10)
            ->assertJsonPath('kpis.aves_por_carga', 56)
            ->assertJsonPath('kpis.frete_medio', 120);

        $this->getJson('/api/freight/timeline?start_date=2026-03-01&end_date=2026-03-31')
            ->assertOk()
            ->assertJsonCount(2, 'series')
            ->assertJsonPath('series.0.points.0.data', '2026-03-01');
    }

    public function test_dashboard_alerts_include_low_and_high_km_thresholds(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);

        FreightEntry::query()->create([
            'data' => '2026-03-05',
            'unidade_id' => $unidade->id,
            'autor_id' => $admin->id,
            'frete_total' => 1500,
            'cargas' => 10,
            'aves' => 800,
            'veiculos' => 2,
            'km_rodado' => 900,
            'frete_liquido' => 1500,
            'cargas_liq' => 10,
            'aves_liq' => 800,
        ]);

        FreightEntry::query()->create([
            'data' => '2026-03-06',
            'unidade_id' => $unidade->id,
            'autor_id' => $admin->id,
            'frete_total' => 2500,
            'cargas' => 12,
            'aves' => 1000,
            'veiculos' => 3,
            'km_rodado' => 26000,
            'frete_liquido' => 2500,
            'cargas_liq' => 12,
            'aves_liq' => 1000,
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/freight/dashboard?competencia_mes=3&competencia_ano=2026')
            ->assertOk()
            ->assertJsonFragment(['key' => 'km_muito_baixo'])
            ->assertJsonFragment(['key' => 'km_muito_alto']);
    }

    public function test_timeline_rejects_ranges_larger_than_one_year(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->getJson('/api/freight/timeline?start_date=2024-01-01&end_date=2026-03-01')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Intervalo máximo permitido para a timeline é de 366 dias.');
    }

    public function test_freight_index_validates_invalid_date_format(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->getJson('/api/freight/entries?start_date=03-01-2026')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['start_date']);
    }

    public function test_store_rejects_invalid_backend_values(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unidade = Unidade::query()->create(['nome' => 'Atibaia', 'slug' => 'atibaia']);

        Sanctum::actingAs($admin);

        $this->postJson('/api/freight/entries', [
            'data' => '2026-03-03',
            'unidade_id' => $unidade->id,
            'km_rodado' => -1,
            'programado_viagens' => 0,
            'kaique_geral_viagens' => 0,
            'terceiros_viagens' => 0,
            'abatedouro_viagens' => 0,
            'canceladas_sem_escalar_viagens' => 0,
            'canceladas_escaladas_viagens' => 0,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['km_rodado', 'kaique_geral_viagens']);
    }

    public function test_can_preview_and_import_kaique_spreadsheet_with_canceled_rows(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unidade = Unidade::query()->create(['nome' => 'Jarinu', 'slug' => 'jarinu']);

        Sanctum::actingAs($admin);

        $xlsx = $this->buildKaiqueSpreadsheetBinary($unidade->nome);

        $previewFile = UploadedFile::fake()->createWithContent('frete-preview.xlsx', $xlsx);
        $this->postJson('/api/freight/entries/import-spreadsheet-preview', [
            'file' => $previewFile,
        ])
            ->assertOk()
            ->assertJsonPath('source_format', 'kaique')
            ->assertJsonPath('prefill.unidade_id', $unidade->id)
            ->assertJsonCount(1, 'cargas_canceladas_detalhes')
            ->assertJsonPath('cargas_canceladas_detalhes.0.aviario', 'AVI-30')
            ->assertJsonPath('cargas_canceladas_detalhes.0.placa', 'ABC1234');

        $importFile = UploadedFile::fake()->createWithContent('frete-import.xlsx', $xlsx);
        $this->postJson('/api/freight/entries/import-spreadsheet', [
            'file' => $importFile,
        ])
            ->assertOk()
            ->assertJsonPath('total_importados', 1)
            ->assertJsonPath('total_ignorados', 0);

        $entry = FreightEntry::query()->first();
        $this->assertNotNull($entry);
        $this->assertDatabaseHas('freight_entries', [
            'id' => $entry?->id,
            'unidade_id' => $unidade->id,
            'canceladas_escaladas_viagens' => 1,
        ]);
        $this->assertDatabaseHas('freight_canceled_loads', [
            'freight_entry_id' => $entry?->id,
            'aviario' => 'AVI-30',
            'placa' => 'ABC1234',
        ]);
    }

    public function test_can_bill_unbill_and_delete_canceled_load_batches(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $entry = FreightEntry::query()->create([
            'data' => '2026-03-10',
            'unidade_id' => $unidade->id,
            'autor_id' => $admin->id,
            'frete_total' => 100,
            'cargas' => 1,
            'aves' => 50,
            'veiculos' => 1,
            'km_rodado' => 20,
            'frete_liquido' => 100,
            'cargas_liq' => 1,
            'aves_liq' => 50,
        ]);

        $loadA = FreightCanceledLoad::query()->create([
            'freight_entry_id' => $entry->id,
            'unidade_id' => $unidade->id,
            'autor_id' => $admin->id,
            'data' => '2026-03-10',
            'placa' => 'AAA0001',
            'aviario' => 'AVI-A',
            'valor' => 120,
            'status' => 'a_receber',
        ]);

        $loadB = FreightCanceledLoad::query()->create([
            'freight_entry_id' => $entry->id,
            'unidade_id' => $unidade->id,
            'autor_id' => $admin->id,
            'data' => '2026-03-10',
            'placa' => 'BBB0002',
            'aviario' => 'AVI-B',
            'valor' => 140,
            'status' => 'a_receber',
        ]);

        Sanctum::actingAs($admin);

        $billResponse = $this->postJson('/api/freight/canceled-loads/bill', [
            'ids' => [$loadA->id, $loadB->id],
            'descricao' => 'Pagamento lote março',
            'data_pagamento' => '2026-03-15',
            'numero_nota_fiscal' => 'NF-2026-03',
        ])
            ->assertOk()
            ->assertJsonPath('updated_count', 2);

        $batchId = (int) $billResponse->json('batch_id');

        $this->assertDatabaseHas('freight_canceled_loads', [
            'id' => $loadA->id,
            'status' => 'recebida',
            'batch_id' => $batchId,
        ]);

        $this->postJson("/api/freight/canceled-loads/{$loadA->id}/unbill")
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertDatabaseHas('freight_canceled_loads', [
            'id' => $loadA->id,
            'status' => 'a_receber',
            'batch_id' => null,
        ]);

        $this->postJson("/api/freight/canceled-load-batches/{$batchId}/unbill")
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertDatabaseMissing('freight_canceled_load_batches', ['id' => $batchId]);
        $this->assertDatabaseHas('freight_canceled_loads', [
            'id' => $loadB->id,
            'status' => 'a_receber',
            'batch_id' => null,
        ]);

        $this->deleteJson("/api/freight/canceled-loads/{$loadB->id}")
            ->assertNoContent();
        $this->assertDatabaseMissing('freight_canceled_loads', ['id' => $loadB->id]);
    }

    public function test_admin_can_edit_canceled_load(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $entry = FreightEntry::query()->create([
            'data' => '2026-03-10',
            'unidade_id' => $unidade->id,
            'autor_id' => $admin->id,
            'frete_total' => 100,
            'cargas' => 1,
            'aves' => 50,
            'veiculos' => 1,
            'km_rodado' => 20,
            'frete_liquido' => 100,
            'cargas_liq' => 1,
            'aves_liq' => 50,
        ]);

        $load = FreightCanceledLoad::query()->create([
            'freight_entry_id' => $entry->id,
            'unidade_id' => $unidade->id,
            'autor_id' => $admin->id,
            'data' => '2026-03-10',
            'placa' => 'AAA0001',
            'aviario' => 'AVI-A',
            'valor' => 120,
            'status' => 'a_receber',
        ]);

        Sanctum::actingAs($admin);

        $this->putJson("/api/freight/canceled-loads/{$load->id}", [
            'data' => '2026-03-11',
            'placa' => 'abc1234',
            'aviario' => 'AVI-EDIT',
            'valor' => 250.75,
            'n_viagem' => 'NV-22',
            'obs' => 'Ajuste manual',
        ])
            ->assertOk()
            ->assertJsonPath('data.placa', 'ABC1234')
            ->assertJsonPath('data.aviario', 'AVI-EDIT')
            ->assertJsonPath('data.n_viagem', 'NV-22');

        $this->assertDatabaseHas('freight_canceled_loads', [
            'id' => $load->id,
            'placa' => 'ABC1234',
            'aviario' => 'AVI-EDIT',
            'n_viagem' => 'NV-22',
            'obs' => 'Ajuste manual',
            'valor' => 250.75,
        ]);
    }

    public function test_spot_store_parses_localized_numeric_strings(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unidade = Unidade::query()->create(['nome' => 'Jarinu', 'slug' => 'jarinu']);

        Sanctum::actingAs($admin);

        $this->postJson('/api/freight/spot-entries', [
            'data' => '2026-03-14',
            'unidade_origem_id' => $unidade->id,
            'frete_spot' => '5.240,90',
            'cargas' => '2.560',
            'aves' => '33.064',
            'km_rodado' => '1.240,5',
            'obs' => 'Teste de locale',
        ])->assertCreated();

        $entry = \App\Models\FreightSpotEntry::query()->first();

        $this->assertNotNull($entry);
        $this->assertSame(2560, (int) $entry?->cargas);
        $this->assertSame(33064, (int) $entry?->aves);
        $this->assertSame('5240.90', (string) $entry?->frete_spot);
        $this->assertSame('1240.50', (string) $entry?->km_rodado);
    }

    public function test_main_freight_endpoints_return_success_for_admin(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->getJson('/api/freight/dashboard')->assertOk();
        $this->getJson('/api/freight/entries')->assertOk();
        $this->getJson('/api/freight/spot-entries')->assertOk();
        $this->getJson('/api/freight/canceled-loads')->assertOk();
        $this->getJson('/api/freight/timeline?start_date=2026-01-01&end_date=2026-12-31')->assertOk();
    }

    public function test_admin_can_delete_freight_entry_and_it_disappears_from_database(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);

        $entry = FreightEntry::query()->create([
            'data' => '2026-03-01',
            'unidade_id' => $unidade->id,
            'autor_id' => $admin->id,
            'frete_total' => 1000,
            'cargas' => 2,
            'aves' => 100,
            'veiculos' => 1,
            'km_rodado' => 1200,
            'frete_liquido' => 1000,
            'cargas_liq' => 2,
            'aves_liq' => 100,
        ]);

        Sanctum::actingAs($admin);

        $this->deleteJson("/api/freight/entries/{$entry->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('freight_entries', [
            'id' => $entry->id,
        ]);
    }

    private function buildKaiqueSpreadsheetBinary(string $unitName): string
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();

        $sheet->setCellValue('A1', 'DATA');
        $sheet->setCellValue('B1', '2026-03-05');
        $sheet->setCellValue('B2', $unitName);
        $sheet->setCellValue('B3', 3);
        $sheet->setCellValue('B4', 900);
        $sheet->setCellValue('B5', 3);
        $sheet->setCellValue('B6', 3000);
        $sheet->setCellValue('B7', 220);
        $sheet->setCellValue('B8', 0);
        $sheet->setCellValue('B9', 0);
        $sheet->setCellValue('B10', 0);
        $sheet->setCellValue('B11', 0);
        $sheet->setCellValue('B12', 120);
        $sheet->setCellValue('B13', 1);
        $sheet->setCellValue('B14', 500);
        $sheet->setCellValue('B15', 20);
        $sheet->setCellValue('B16', 100);
        $sheet->setCellValue('B17', 1);
        $sheet->setCellValue('B18', 450);
        $sheet->setCellValue('B19', 40);
        $sheet->setCellValue('B20', 820);
        $sheet->setCellValue('B21', 2);
        $sheet->setCellValue('B22', 2500);
        $sheet->setCellValue('B23', 180);
        $sheet->setCellValue('B24', 700);
        $sheet->setCellValue('B25', 2);
        $sheet->setCellValue('B26', 2400);
        $sheet->setCellValue('B27', 170);

        $sheet->setCellValue('A30', 'AVI-30');
        $sheet->setCellValue('C30', 'ABC1234');
        $sheet->setCellValue('D30', 155.75);

        ob_start();
        (new Xlsx($spreadsheet))->save('php://output');

        return (string) ob_get_clean();
    }
}
