<?php

namespace Tests\Feature\Api;

use App\Models\Colaborador;
use App\Models\Funcao;
use App\Models\Unidade;
use App\Models\User;
use App\Models\UserAccessScope;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class RegistryApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_list_unidades_and_funcoes(): void
    {
        Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        Funcao::query()->create(['nome' => 'Motorista', 'ativo' => true]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->getJson('/api/registry/unidades')
            ->assertOk()
            ->assertJsonPath('data.0.nome', 'Amparo');

        $this->getJson('/api/registry/funcoes')
            ->assertOk()
            ->assertJsonPath('data.0.nome', 'Motorista');
    }

    public function test_admin_can_create_colaborador(): void
    {
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $funcao = Funcao::query()->create(['nome' => 'Motorista', 'ativo' => true]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $payload = [
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Carlos da Silva',
            'ativo' => true,
            'cpf' => '123.456.789-01',
            'rg' => '123456789X',
            'telefone' => '(11)99999-9999',
            'email' => 'carlos@example.com',
        ];

        $this->postJson('/api/registry/colaboradores', $payload)
            ->assertCreated()
            ->assertJsonPath('data.nome', 'Carlos da Silva')
            ->assertJsonPath('data.cpf', '12345678901');
    }

    public function test_admin_can_upload_colaborador_3x4_photo(): void
    {
        Storage::fake('public');

        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $funcao = Funcao::query()->create(['nome' => 'Motorista', 'ativo' => true]);
        $colaborador = Colaborador::query()->create([
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Carlos da Silva',
            'ativo' => true,
            'cpf' => '12345678901',
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $response = $this->post('/api/registry/colaboradores/'.$colaborador->id.'/foto-3x4', [
            'foto' => UploadedFile::fake()->image('foto-3x4.jpg', 300, 400),
        ], [
            'Accept' => 'application/json',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.id', $colaborador->id);

        $colaborador->refresh();

        $this->assertNotNull($colaborador->foto_3x4_path);
        $this->assertNotNull($colaborador->foto_3x4_url);
        Storage::disk('public')->assertExists((string) $colaborador->foto_3x4_path);
    }

    public function test_admin_can_upload_colaborador_document_attachments(): void
    {
        Storage::fake('public');

        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $funcao = Funcao::query()->create(['nome' => 'Motorista', 'ativo' => true]);
        $colaborador = Colaborador::query()->create([
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Carlos da Silva',
            'ativo' => true,
            'cpf' => '12345678901',
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $response = $this->post('/api/registry/colaboradores/'.$colaborador->id.'/attachments', [
            'cnh_attachment_file' => UploadedFile::fake()->create('cnh.pdf', 250, 'application/pdf'),
            'work_card_attachment_file' => UploadedFile::fake()->image('ct.jpg', 640, 800),
        ], [
            'Accept' => 'application/json',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.id', $colaborador->id)
            ->assertJsonPath('data.cnh_attachment_original_name', 'cnh.pdf')
            ->assertJsonPath('data.work_card_attachment_original_name', 'ct.jpg');

        $colaborador->refresh();

        $this->assertNotNull($colaborador->cnh_attachment_path);
        $this->assertNotNull($colaborador->work_card_attachment_path);

        Storage::disk('public')->assertExists((string) $colaborador->cnh_attachment_path);
        Storage::disk('public')->assertExists((string) $colaborador->work_card_attachment_path);
    }

    public function test_admin_can_delete_colaborador(): void
    {
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $funcao = Funcao::query()->create(['nome' => 'Motorista', 'ativo' => true]);
        $colaborador = Colaborador::query()->create([
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Carlos da Silva',
            'ativo' => true,
            'cpf' => '12345678901',
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->deleteJson('/api/registry/colaboradores/'.$colaborador->id)
            ->assertNoContent();

        $this->assertSoftDeleted('colaboradores', [
            'id' => $colaborador->id,
        ]);
    }

    public function test_only_master_admin_can_create_registry_user(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->postJson('/api/registry/users', [
            'name' => 'Novo Admin',
            'email' => 'novo-admin@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'admin',
        ])->assertForbidden();

        Sanctum::actingAs(User::factory()->create(['role' => 'master_admin']));

        $this->postJson('/api/registry/users', [
            'name' => 'Novo Admin',
            'email' => 'novo-admin@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'admin',
        ])
            ->assertCreated()
            ->assertJsonPath('data.email', 'novo-admin@example.com');
    }

    public function test_master_admin_can_update_registry_user(): void
    {
        $master = User::factory()->create(['role' => 'master_admin']);
        $target = User::factory()->create([
            'name' => 'Usuário Antigo',
            'email' => 'usuario-antigo@example.com',
            'role' => 'admin',
        ]);

        Sanctum::actingAs($master);

        $this->putJson('/api/registry/users/'.$target->id, [
            'name' => 'Usuário Atualizado',
            'email' => 'usuario-atualizado@example.com',
            'role' => 'usuario',
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Usuário Atualizado')
            ->assertJsonPath('data.email', 'usuario-atualizado@example.com')
            ->assertJsonPath('data.role', 'usuario');
    }

    public function test_master_admin_can_define_access_scopes_for_registry_user(): void
    {
        $master = User::factory()->create(['role' => 'master_admin']);
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);

        Sanctum::actingAs($master);

        $this->postJson('/api/registry/users', [
            'name' => 'Gestor Unidade',
            'email' => 'gestor-unidade@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'admin',
            'access_scopes' => [
                [
                    'module_key' => 'registry',
                    'data_scope' => 'units',
                    'allowed_unit_ids' => [$unidade->id],
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('data.access_scopes.0.module_key', 'registry')
            ->assertJsonPath('data.access_scopes.0.data_scope', 'units')
            ->assertJsonPath('data.access_scopes.0.allowed_unit_ids.0', $unidade->id);
    }

    public function test_only_master_admin_can_delete_registry_user_and_cannot_delete_self(): void
    {
        $master = User::factory()->create(['role' => 'master_admin']);
        $admin = User::factory()->create(['role' => 'admin']);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->deleteJson('/api/registry/users/'.$admin->id)
            ->assertForbidden();

        Sanctum::actingAs($master);

        $this->deleteJson('/api/registry/users/'.$master->id)
            ->assertStatus(422);

        $this->deleteJson('/api/registry/users/'.$admin->id)
            ->assertNoContent();

        $this->assertDatabaseMissing('users', [
            'id' => $admin->id,
        ]);
    }

    public function test_admin_can_import_colaboradores_from_xlsx_starting_on_line_five(): void
    {
        $unidade = Unidade::query()->create(['nome' => 'Tatuí', 'slug' => 'tatui']);
        $funcao = Funcao::query()->create(['nome' => 'Motorista', 'ativo' => true]);

        Colaborador::query()->create([
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Colaborador Existente',
            'ativo' => true,
            'cpf' => '99999999999',
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $file = $this->buildXlsxUpload([
            ['B' => 'João da Silva', 'C' => 'João', 'D' => 'Motorista Dois', 'E' => '(11) 99999-8888', 'F' => 'joao@example.com', 'G' => '01/02/1990', 'H' => '123.456.789-01', 'I' => '12.345.678-X', 'J' => '123456789', 'K' => '31/12/2030', 'L' => '15/08/2025', 'O' => 'Rodoviário Bertolino', 'P' => 'Ativo'],
            ['B' => 'CPF Curto', 'C' => 'Curto', 'D' => 'Motorista', 'E' => '(11) 97777-6666', 'F' => 'curto@example.com', 'G' => '01/01/1995', 'H' => '12345', 'I' => '11.111.111-1', 'J' => '111111111', 'K' => '31/12/2030', 'L' => '10/10/2024', 'O' => 'Rodoviário Bertolino', 'P' => 'Ativo'],
            ['B' => 'Duplicado Sistema', 'C' => 'Dup', 'D' => 'Motorista', 'E' => '(11) 96666-5555', 'F' => 'dup@example.com', 'G' => '03/03/1992', 'H' => '999.999.999-99', 'I' => '22.222.222-2', 'J' => '222222222', 'K' => '31/12/2030', 'L' => '20/09/2024', 'O' => 'Rodoviário Bertolino', 'P' => 'Inativo'],
        ]);

        $this->postJson('/api/registry/colaboradores/import-spreadsheet', [
            'file' => $file,
        ])
            ->assertOk()
            ->assertJsonPath('total_importados', 1)
            ->assertJsonPath('total_ignorados', 2)
            ->assertJsonPath('total_lidos', 3);

        $this->assertDatabaseHas('colaboradores', [
            'nome' => 'João da Silva',
            'apelido' => 'João',
            'cpf_hash' => hash('sha256', '12345678901'),
            'telefone' => '11999998888',
            'email' => 'joao@example.com',
            'ativo' => true,
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'data_nascimento' => '1990-02-01 00:00:00',
            'data_admissao' => '2025-08-15 00:00:00',
            'validade_cnh' => '2030-12-31 00:00:00',
        ]);
    }

    public function test_unauthenticated_user_cannot_import_colaboradores_from_spreadsheet(): void
    {
        $file = $this->buildXlsxUpload([
            ['B' => 'Nome Teste', 'C' => 'Apelido', 'D' => 'Motorista', 'E' => '(11) 90000-0000', 'F' => 'teste@example.com', 'G' => '01/01/1990', 'H' => '123.456.789-01', 'I' => '11.111.111-1', 'J' => '123456789', 'K' => '31/12/2030', 'L' => '01/01/2020', 'O' => 'Rodoviário Bertolino', 'P' => 'Ativo'],
        ]);

        $this->postJson('/api/registry/colaboradores/import-spreadsheet', [
            'file' => $file,
        ])->assertUnauthorized();
    }

    public function test_registry_scope_filters_colaboradores_by_allowed_units(): void
    {
        $unidadePermitida = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $unidadeBloqueada = Unidade::query()->create(['nome' => 'Tatui', 'slug' => 'tatui']);
        $funcao = Funcao::query()->create(['nome' => 'Motorista', 'ativo' => true]);

        Colaborador::query()->create([
            'unidade_id' => $unidadePermitida->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Permitido',
            'ativo' => true,
            'cpf' => '12345678901',
        ]);

        Colaborador::query()->create([
            'unidade_id' => $unidadeBloqueada->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Bloqueado',
            'ativo' => true,
            'cpf' => '98765432100',
        ]);

        $admin = User::factory()->create(['role' => 'admin']);
        UserAccessScope::query()->create([
            'user_id' => $admin->id,
            'module_key' => 'registry',
            'data_scope' => 'units',
            'allowed_unit_ids' => [$unidadePermitida->id],
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/registry/colaboradores')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nome', 'Permitido');
    }

    /**
     * @param  array<int, array<string, string>>  $rows
     */
    private function buildXlsxUpload(array $rows): UploadedFile
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();

        $sheet->setCellValue('A1', 'A');
        $sheet->setCellValue('B1', 'B');
        $sheet->setCellValue('C1', 'C');
        $sheet->setCellValue('D1', 'D');
        $sheet->setCellValue('E1', 'E');
        $sheet->setCellValue('F1', 'F');
        $sheet->setCellValue('G1', 'G');
        $sheet->setCellValue('H1', 'H');
        $sheet->setCellValue('I1', 'I');
        $sheet->setCellValue('J1', 'J');
        $sheet->setCellValue('K1', 'K');
        $sheet->setCellValue('L1', 'L');
        $sheet->setCellValue('M1', 'M');
        $sheet->setCellValue('N1', 'N');
        $sheet->setCellValue('O1', 'O');
        $sheet->setCellValue('P1', 'P');

        $line = 5;

        foreach ($rows as $row) {
            foreach ($row as $column => $value) {
                $sheet->setCellValue($column.$line, $value);
            }

            $line++;
        }

        $tempPath = tempnam(sys_get_temp_dir(), 'colab-xlsx-');
        $writer = new Xlsx($spreadsheet);
        $writer->save($tempPath);

        $content = (string) file_get_contents($tempPath);
        @unlink($tempPath);

        return UploadedFile::fake()->createWithContent('colaboradores.xlsx', $content);
    }
}
