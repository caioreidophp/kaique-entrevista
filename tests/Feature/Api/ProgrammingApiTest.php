<?php

namespace Tests\Feature\Api;

use App\Models\Colaborador;
use App\Models\Funcao;
use App\Models\PlacaFrota;
use App\Models\ProgramacaoViagem;
use App\Models\Unidade;
use App\Models\User;
use App\Models\UserAccessScope;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class ProgrammingApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_programming_endpoints_require_authentication(): void
    {
        $this->getJson('/api/programming/dashboard')->assertUnauthorized();
        $this->postJson('/api/programming/import-base', [])->assertUnauthorized();
        $this->postJson('/api/programming/assignments', [])->assertUnauthorized();
    }

    public function test_admin_can_import_programming_base_and_assign_scale(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unit = Unidade::query()->create([
            'nome' => 'Atibaia',
            'slug' => 'atibaia',
        ]);
        $function = Funcao::query()->create([
            'nome' => 'Motorista',
            'descricao' => 'Motorista de frota',
            'ativo' => true,
        ]);

        $driver = Colaborador::query()->create([
            'unidade_id' => $unit->id,
            'funcao_id' => $function->id,
            'nome' => 'Motorista Teste',
            'cpf' => '00000000001',
            'cnh' => '123456789',
            'ativo' => true,
        ]);

        $truck = PlacaFrota::query()->create([
            'placa' => 'ABC1D23',
            'unidade_id' => $unit->id,
        ]);

        Sanctum::actingAs($admin);

        $xlsx = $this->buildProgrammingSpreadsheetBinary($unit->nome);

        $importFile = UploadedFile::fake()->createWithContent('programacao.xlsx', $xlsx);

        $this->postJson('/api/programming/import-base', [
            'file' => $importFile,
            'unidade_id' => $unit->id,
        ])
            ->assertOk()
            ->assertJsonPath('total_criadas', 1)
            ->assertJsonPath('total_atualizadas', 0);

        $trip = ProgramacaoViagem::query()->first();

        $this->assertNotNull($trip);

        $tripDate = substr((string) ProgramacaoViagem::query()->whereKey($trip?->id)->value('data_viagem'), 0, 10);

        $this->assertNotNull($tripDate);

        $this->getJson('/api/programming/dashboard?unidade_id='.$unit->id.'&data='.$tripDate)
            ->assertOk()
            ->assertJsonPath('summary.trips_assigned', 0);

        $this->postJson('/api/programming/assignments', [
            'programacao_viagem_id' => $trip?->id,
            'colaborador_id' => $driver->id,
            'placa_frota_id' => $truck->id,
            'hora_inicio_prevista' => '08:00',
            'hora_fim_prevista' => '17:00',
        ])
            ->assertCreated()
            ->assertJsonPath('data.colaborador_id', $driver->id)
            ->assertJsonPath('data.placa_frota_id', $truck->id);

        $this->assertDatabaseHas('programacao_escalas', [
            'programacao_viagem_id' => $trip?->id,
            'colaborador_id' => $driver->id,
            'placa_frota_id' => $truck->id,
        ]);

        $this->getJson('/api/programming/dashboard?unidade_id='.$unit->id.'&data='.$tripDate)
            ->assertOk()
            ->assertJsonPath('summary.trips_assigned', 1)
            ->assertJsonPath('summary.assignment_rate', 100);
    }

    public function test_assignment_rejects_interjornada_lower_than_eleven_hours(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unit = Unidade::query()->create([
            'nome' => 'Atibaia',
            'slug' => 'atibaia',
        ]);
        $function = Funcao::query()->create([
            'nome' => 'Motorista',
            'descricao' => 'Motorista de frota',
            'ativo' => true,
        ]);

        $driver = Colaborador::query()->create([
            'unidade_id' => $unit->id,
            'funcao_id' => $function->id,
            'nome' => 'Motorista Interjornada',
            'cpf' => '00000000011',
            'cnh' => '99887766',
            'ativo' => true,
        ]);

        $truck = PlacaFrota::query()->create([
            'placa' => 'ABC1D23',
            'unidade_id' => $unit->id,
        ]);

        $tripDay4 = ProgramacaoViagem::query()->create([
            'data_viagem' => '2026-04-04',
            'unidade_id' => $unit->id,
            'codigo_viagem' => 'V-400',
            'origem' => 'Atibaia',
            'destino' => 'Campinas',
            'hora_inicio_prevista' => '14:00',
            'hora_fim_prevista' => '22:00',
            'jornada_horas_prevista' => 8,
            'autor_id' => $admin->id,
        ]);

        $tripDay5 = ProgramacaoViagem::query()->create([
            'data_viagem' => '2026-04-05',
            'unidade_id' => $unit->id,
            'codigo_viagem' => 'V-500',
            'origem' => 'Atibaia',
            'destino' => 'Jundiai',
            'hora_inicio_prevista' => '08:30',
            'hora_fim_prevista' => '16:30',
            'jornada_horas_prevista' => 8,
            'autor_id' => $admin->id,
        ]);

        Sanctum::actingAs($admin);

        $this->postJson('/api/programming/assignments', [
            'programacao_viagem_id' => $tripDay4->id,
            'colaborador_id' => $driver->id,
            'placa_frota_id' => $truck->id,
        ])->assertCreated();

        $this->postJson('/api/programming/assignments', [
            'programacao_viagem_id' => $tripDay5->id,
            'colaborador_id' => $driver->id,
            'placa_frota_id' => $truck->id,
        ])
            ->assertStatus(422)
            ->assertJsonPath('interjornada_alert.is_violated', true);
    }

    public function test_programming_scope_limits_dashboard_and_import_to_allowed_units(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unidadePermitida = Unidade::query()->create([
            'nome' => 'Atibaia',
            'slug' => 'atibaia',
        ]);
        $unidadeBloqueada = Unidade::query()->create([
            'nome' => 'Campinas',
            'slug' => 'campinas',
        ]);

        ProgramacaoViagem::query()->create([
            'data_viagem' => '2026-04-10',
            'unidade_id' => $unidadePermitida->id,
            'codigo_viagem' => 'OK-1',
            'origem' => 'A',
            'destino' => 'B',
            'hora_inicio_prevista' => '08:00',
            'hora_fim_prevista' => '16:00',
            'jornada_horas_prevista' => 8,
            'autor_id' => $admin->id,
        ]);

        ProgramacaoViagem::query()->create([
            'data_viagem' => '2026-04-10',
            'unidade_id' => $unidadeBloqueada->id,
            'codigo_viagem' => 'NO-1',
            'origem' => 'C',
            'destino' => 'D',
            'hora_inicio_prevista' => '09:00',
            'hora_fim_prevista' => '17:00',
            'jornada_horas_prevista' => 8,
            'autor_id' => $admin->id,
        ]);

        UserAccessScope::query()->create([
            'user_id' => $admin->id,
            'module_key' => 'programming',
            'data_scope' => 'units',
            'allowed_unit_ids' => [$unidadePermitida->id],
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/programming/dashboard?data=2026-04-10')
            ->assertOk()
            ->assertJsonCount(1, 'unidades')
            ->assertJsonPath('unidades.0.id', $unidadePermitida->id)
            ->assertJsonPath('summary.trips_total', 1);

        $xlsx = $this->buildProgrammingSpreadsheetBinary($unidadeBloqueada->nome);

        $this->postJson('/api/programming/import-base', [
            'file' => UploadedFile::fake()->createWithContent('programacao-bloqueada.xlsx', $xlsx),
            'unidade_id' => $unidadeBloqueada->id,
        ])->assertForbidden();
    }

    private function buildProgrammingSpreadsheetBinary(string $unitName): string
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();

        $sheet->setCellValue('A1', 'Data');
        $sheet->setCellValue('B1', 'Unidade');
        $sheet->setCellValue('C1', 'Origem');
        $sheet->setCellValue('D1', 'Destino');
        $sheet->setCellValue('E1', 'Viagem');
        $sheet->setCellValue('F1', 'Jornada');
        $sheet->setCellValue('G1', 'Observacoes');
        $sheet->setCellValue('H1', 'Inicio');
        $sheet->setCellValue('I1', 'Fim');

        $sheet->setCellValue('A2', '2026-04-03');
        $sheet->setCellValue('B2', $unitName);
        $sheet->setCellValue('C2', 'Jundiai');
        $sheet->setCellValue('D2', 'Campinas');
        $sheet->setCellValue('E2', 'V-100');
        $sheet->setCellValue('F2', 8.5);
        $sheet->setCellValue('G2', 'Viagem base importada para teste');
        $sheet->setCellValue('H2', '08:00');
        $sheet->setCellValue('I2', '17:00');

        ob_start();
        (new Xlsx($spreadsheet))->save('php://output');

        return (string) ob_get_clean();
    }
}
