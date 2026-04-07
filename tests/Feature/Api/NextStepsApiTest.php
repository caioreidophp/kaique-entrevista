<?php

namespace Tests\Feature\Api;

use App\Enums\HrStatus;
use App\Models\Colaborador;
use App\Models\DriverInterview;
use App\Models\Funcao;
use App\Models\InterviewCurriculum;
use App\Models\Onboarding;
use App\Models\Unidade;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NextStepsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_master_admin_list_shows_only_approved_candidates(): void
    {
        $master = User::factory()->masterAdmin()->create();
        Sanctum::actingAs($master);

        DriverInterview::factory()->create([
            'full_name' => 'Aprovado Um',
            'hr_status' => HrStatus::Aprovado,
        ]);

        DriverInterview::factory()->create([
            'full_name' => 'Aguardando Dois',
            'hr_status' => HrStatus::AguardandoVaga,
        ]);

        $response = $this->getJson('/api/next-steps/candidates');

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.full_name', 'Aprovado Um')
            ->assertJsonPath('data.0.hr_status', 'aprovado')
            ->assertJsonPath('data.0.documents.checklist.preview_url', route('api.next-steps.documents.preview', [
                'driverInterview' => $response->json('data.0.id'),
                'document' => 'checklist',
            ]));
    }

    public function test_admin_list_shows_only_own_approved_candidates(): void
    {
        $admin = User::factory()->create();
        $otherAdmin = User::factory()->create();

        DriverInterview::factory()->create([
            'author_id' => $admin->id,
            'user_id' => $admin->id,
            'full_name' => 'Meu Aprovado',
            'hr_status' => HrStatus::Aprovado,
        ]);

        DriverInterview::factory()->create([
            'author_id' => $otherAdmin->id,
            'user_id' => $otherAdmin->id,
            'full_name' => 'Aprovado de Outro',
            'hr_status' => HrStatus::Aprovado,
        ]);

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/next-steps/candidates');

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.full_name', 'Meu Aprovado');
    }

    public function test_can_generate_checklist_pdf_inline_and_download(): void
    {
        $master = User::factory()->masterAdmin()->create();
        $interview = DriverInterview::factory()->create([
            'hr_status' => HrStatus::Aprovado,
            'full_name' => 'Caio Henrique',
        ]);

        Sanctum::actingAs($master);

        $this->get("/api/next-steps/{$interview->id}/documents/checklist/pdf")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('Content-Disposition', 'inline; filename="Checklist-CaioHenrique.pdf"');

        $this->get("/api/next-steps/{$interview->id}/documents/checklist/pdf?download=1")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('Content-Disposition', 'attachment; filename="Checklist-CaioHenrique.pdf"');
    }

    public function test_preview_route_returns_html_for_raca_etnia_document(): void
    {
        $master = User::factory()->masterAdmin()->create();
        $interview = DriverInterview::factory()->create([
            'hr_status' => HrStatus::Aprovado,
            'full_name' => 'Jefferson',
        ]);

        Sanctum::actingAs($master);

        $this->get("/api/next-steps/{$interview->id}/documents/raca-etnia/preview")
            ->assertOk()
            ->assertHeader('Content-Type', 'text/html; charset=UTF-8')
            ->assertSee('Autodeclaração Étnico-Racial');
    }

    public function test_document_generation_fails_for_non_approved_candidate(): void
    {
        $master = User::factory()->masterAdmin()->create();
        $interview = DriverInterview::factory()->create([
            'hr_status' => HrStatus::Reprovado,
        ]);

        Sanctum::actingAs($master);

        $this->get("/api/next-steps/{$interview->id}/documents/checklist/pdf")
            ->assertStatus(422);
    }

    public function test_can_mark_approved_candidate_as_hired_and_link_colaborador(): void
    {
        $admin = User::factory()->create();
        Sanctum::actingAs($admin);

        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $funcao = Funcao::query()->create(['nome' => 'Motorista', 'ativo' => true]);

        $interview = DriverInterview::factory()->create([
            'author_id' => $admin->id,
            'user_id' => $admin->id,
            'hr_status' => HrStatus::Aprovado,
            'cpf' => '12345678901',
        ]);

        $colaborador = Colaborador::query()->create([
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Carlos',
            'ativo' => true,
            'cpf' => '12345678901',
            'rg' => '123456789X',
            'telefone' => '11999999999',
        ]);

        $this->patchJson("/api/next-steps/{$interview->id}/hiring-status", [
            'foi_contratado' => true,
            'colaborador_id' => $colaborador->id,
        ])
            ->assertOk()
            ->assertJsonPath('data.foi_contratado', true)
            ->assertJsonPath('data.colaborador_id', $colaborador->id);

        $this->assertDatabaseHas('driver_interviews', [
            'id' => $interview->id,
            'foi_contratado' => true,
            'colaborador_id' => $colaborador->id,
        ]);
    }

    public function test_cannot_mark_hired_with_colaborador_of_different_cpf(): void
    {
        $admin = User::factory()->create();
        Sanctum::actingAs($admin);

        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $funcao = Funcao::query()->create(['nome' => 'Motorista', 'ativo' => true]);

        $interview = DriverInterview::factory()->create([
            'author_id' => $admin->id,
            'user_id' => $admin->id,
            'hr_status' => HrStatus::Aprovado,
            'cpf' => '12345678901',
        ]);

        $colaborador = Colaborador::query()->create([
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Carlos',
            'ativo' => true,
            'cpf' => '99999999999',
            'rg' => '123456789X',
            'telefone' => '11999999999',
        ]);

        $this->patchJson("/api/next-steps/{$interview->id}/hiring-status", [
            'foi_contratado' => true,
            'colaborador_id' => $colaborador->id,
        ])
            ->assertStatus(422);
    }

    public function test_can_mark_hired_without_colaborador_and_still_create_onboarding(): void
    {
        $admin = User::factory()->create();
        Sanctum::actingAs($admin);

        $interview = DriverInterview::factory()->create([
            'author_id' => $admin->id,
            'user_id' => $admin->id,
            'hr_status' => HrStatus::Aprovado,
            'cpf' => '32165498700',
        ]);

        $this->patchJson("/api/next-steps/{$interview->id}/hiring-status", [
            'foi_contratado' => true,
        ])
            ->assertOk()
            ->assertJsonPath('data.foi_contratado', true)
            ->assertJsonPath('data.colaborador_id', null)
            ->assertJsonPath('data.onboarding_status', 'em_andamento');

        $this->assertDatabaseHas('driver_interviews', [
            'id' => $interview->id,
            'foi_contratado' => true,
            'colaborador_id' => null,
        ]);

        $this->assertNotNull(
            Onboarding::query()->where('driver_interview_id', $interview->id)->first(),
        );
    }

    public function test_mark_hired_updates_linked_curriculum_to_approved_interview_status(): void
    {
        $admin = User::factory()->create();
        Sanctum::actingAs($admin);

        $curriculum = InterviewCurriculum::factory()->create([
            'author_id' => $admin->id,
            'status' => 'aguardando_entrevista',
        ]);

        $interview = DriverInterview::factory()->create([
            'author_id' => $admin->id,
            'user_id' => $admin->id,
            'hr_status' => HrStatus::Aprovado,
            'curriculum_id' => $curriculum->id,
        ]);

        $this->patchJson("/api/next-steps/{$interview->id}/hiring-status", [
            'foi_contratado' => true,
        ])
            ->assertOk()
            ->assertJsonPath('data.foi_contratado', true);

        $this->assertDatabaseHas('interview_curriculums', [
            'id' => $curriculum->id,
            'status' => 'aprovado_entrevista',
        ]);
    }

    public function test_mark_hired_copies_interview_and_curriculum_attachments_to_colaborador(): void
    {
        Storage::fake('public');

        $admin = User::factory()->create();
        Sanctum::actingAs($admin);

        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $funcao = Funcao::query()->create(['nome' => 'Motorista', 'ativo' => true]);

        $curriculum = InterviewCurriculum::factory()->create([
            'author_id' => $admin->id,
            'cnh_attachment_path' => 'interview-curriculums/100/cnh/cnh-origem.pdf',
            'cnh_attachment_original_name' => 'cnh-origem.pdf',
            'work_card_attachment_path' => null,
            'work_card_attachment_original_name' => null,
            'status' => 'aguardando_entrevista',
        ]);

        Storage::disk('public')->put('interview-curriculums/100/cnh/cnh-origem.pdf', 'cnh');
        Storage::disk('public')->put('driver-interviews/200/candidate-photo/foto.jpg', 'foto');
        Storage::disk('public')->put('driver-interviews/200/work-card/ct-origem.pdf', 'ct');

        $interview = DriverInterview::factory()->create([
            'author_id' => $admin->id,
            'user_id' => $admin->id,
            'hr_status' => HrStatus::Aprovado,
            'cpf' => '12345678901',
            'curriculum_id' => $curriculum->id,
            'candidate_photo_path' => 'driver-interviews/200/candidate-photo/foto.jpg',
            'cnh_attachment_path' => null,
            'cnh_attachment_original_name' => null,
            'work_card_attachment_path' => 'driver-interviews/200/work-card/ct-origem.pdf',
            'work_card_attachment_original_name' => 'ct-origem.pdf',
        ]);

        $colaborador = Colaborador::query()->create([
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Carlos',
            'ativo' => true,
            'cpf' => '12345678901',
        ]);

        $this->patchJson("/api/next-steps/{$interview->id}/hiring-status", [
            'foi_contratado' => true,
            'colaborador_id' => $colaborador->id,
        ])
            ->assertOk()
            ->assertJsonPath('data.foi_contratado', true);

        $colaborador->refresh();

        $this->assertNotNull($colaborador->foto_3x4_path);
        $this->assertNotNull($colaborador->cnh_attachment_path);
        $this->assertNotNull($colaborador->work_card_attachment_path);
        $this->assertSame('cnh-origem.pdf', $colaborador->cnh_attachment_original_name);
        $this->assertSame('ct-origem.pdf', $colaborador->work_card_attachment_original_name);

        Storage::disk('public')->assertExists((string) $colaborador->foto_3x4_path);
        Storage::disk('public')->assertExists((string) $colaborador->cnh_attachment_path);
        Storage::disk('public')->assertExists((string) $colaborador->work_card_attachment_path);
    }
}
