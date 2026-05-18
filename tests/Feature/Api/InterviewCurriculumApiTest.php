<?php

namespace Tests\Feature\Api;

use App\Models\DriverInterview;
use App\Models\InterviewCurriculum;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InterviewCurriculumApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_create_curriculum(): void
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'usuario']);
        Sanctum::actingAs($user);

        $response = $this->post('/api/interview-curriculums', [
            'full_name' => 'Carlos Mendes',
            'phone' => '(11) 98888-7777',
            'role_name' => 'Motorista',
            'unit_name' => 'Amparo',
            'curriculum_file' => UploadedFile::fake()->create('carlos.pdf', 120, 'application/pdf'),
            'cnh_attachment_file' => UploadedFile::fake()->create('cnh.pdf', 200, 'application/pdf'),
            'work_card_attachment_file' => UploadedFile::fake()->image('ct.webp', 600, 800),
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.full_name', 'Carlos Mendes')
            ->assertJsonPath('data.phone', '(11) 98888-7777')
            ->assertJsonPath('data.role_name', 'Motorista')
            ->assertJsonPath('data.unit_name', 'Amparo')
            ->assertJsonPath('data.status', 'pendente')
            ->assertJsonPath('data.has_cnh_attachment', true)
            ->assertJsonPath('data.has_work_card_attachment', true)
            ->assertJsonPath('data.attachments_status', 'CNH/CT');

        $curriculum = InterviewCurriculum::query()->firstOrFail();

        $this->assertDatabaseHas('interview_curriculums', [
            'id' => $curriculum->id,
            'author_id' => $user->id,
            'full_name' => 'Carlos Mendes',
            'phone' => '(11) 98888-7777',
            'role_name' => 'Motorista',
            'unit_name' => 'Amparo',
            'status' => 'pendente',
        ]);

        Storage::disk('public')->assertExists($curriculum->document_path);
        Storage::disk('public')->assertExists((string) $curriculum->cnh_attachment_path);
        Storage::disk('public')->assertExists((string) $curriculum->work_card_attachment_path);
    }

    public function test_curriculum_index_filters_tabs_including_all(): void
    {
        $user = User::factory()->create(['role' => 'usuario']);
        Sanctum::actingAs($user);

        InterviewCurriculum::factory()->create([
            'author_id' => $user->id,
            'full_name' => 'Pendente',
            'status' => 'pendente',
        ]);

        InterviewCurriculum::factory()->create([
            'author_id' => $user->id,
            'full_name' => 'Recusado',
            'status' => 'recusado',
        ]);

        $this->getJson('/api/interview-curriculums?tab=pendentes')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.full_name', 'Pendente');

        $this->getJson('/api/interview-curriculums?tab=passados')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.full_name', 'Recusado');

        $this->getJson('/api/interview-curriculums?tab=todos')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_create_curriculum_rejects_name_already_used_in_interview(): void
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'usuario']);
        Sanctum::actingAs($user);

        DriverInterview::factory()->create([
            'author_id' => $user->id,
            'full_name' => 'Eduardo Jose da Cruz',
            'phone' => '15997484008',
        ]);

        $this->postJson('/api/interview-curriculums', [
            'full_name' => 'Eduardo Jose da Cruz',
            'phone' => '(15) 90000-0000',
            'role_name' => 'Motorista',
            'unit_name' => 'Itapetininga',
            'curriculum_file' => UploadedFile::fake()->create('eduardo.pdf', 120, 'application/pdf'),
        ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Nome já cadastrado em currículos ou entrevistas.');
    }

    public function test_create_curriculum_rejects_phone_already_used_in_curriculum(): void
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'usuario']);
        Sanctum::actingAs($user);

        InterviewCurriculum::factory()->create([
            'author_id' => $user->id,
            'full_name' => 'Candidato Existente',
            'phone' => '(15) 99748-4008',
        ]);

        $this->postJson('/api/interview-curriculums', [
            'full_name' => 'Outro Candidato',
            'phone' => '15997484008',
            'role_name' => 'Motorista',
            'unit_name' => 'Itapetininga',
            'curriculum_file' => UploadedFile::fake()->create('outro.pdf', 120, 'application/pdf'),
        ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Telefone já cadastrado em currículos ou entrevistas.');
    }

    public function test_create_curriculum_rejects_phone_already_used_in_interview(): void
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'usuario']);
        Sanctum::actingAs($user);

        DriverInterview::factory()->create([
            'author_id' => $user->id,
            'full_name' => 'Entrevistado Existente',
            'phone' => '(15) 99748-4008',
        ]);

        $this->postJson('/api/interview-curriculums', [
            'full_name' => 'Novo Candidato',
            'phone' => '15997484008',
            'role_name' => 'Motorista',
            'unit_name' => 'Itapetininga',
            'curriculum_file' => UploadedFile::fake()->create('novo.pdf', 120, 'application/pdf'),
        ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Telefone já cadastrado em currículos ou entrevistas.');
    }

    public function test_author_can_refuse_pending_curriculum(): void
    {
        $user = User::factory()->create(['role' => 'usuario']);
        Sanctum::actingAs($user);

        $curriculum = InterviewCurriculum::factory()->create([
            'author_id' => $user->id,
            'status' => 'pendente',
        ]);

        $this->patchJson("/api/interview-curriculums/{$curriculum->id}/refuse")
            ->assertOk()
            ->assertJsonPath('data.status', 'recusado');

        $this->assertDatabaseHas('interview_curriculums', [
            'id' => $curriculum->id,
            'status' => 'recusado',
        ]);
    }

    public function test_author_can_update_curriculum_basic_fields(): void
    {
        $user = User::factory()->create(['role' => 'usuario']);
        Sanctum::actingAs($user);

        $curriculum = InterviewCurriculum::factory()->create([
            'author_id' => $user->id,
            'full_name' => 'Nome Antigo',
            'phone' => '(11) 90000-0000',
            'role_name' => 'Função Antiga',
            'unit_name' => 'Unidade Antiga',
        ]);

        $this->putJson("/api/interview-curriculums/{$curriculum->id}", [
            'full_name' => 'Nome Novo',
            'phone' => '(11) 98888-7777',
            'role_name' => 'Motorista',
            'unit_name' => 'Amparo',
        ])
            ->assertOk()
            ->assertJsonPath('data.full_name', 'Nome Novo')
            ->assertJsonPath('data.phone', '(11) 98888-7777')
            ->assertJsonPath('data.role_name', 'Motorista')
            ->assertJsonPath('data.unit_name', 'Amparo');
    }

    public function test_author_can_delete_unlinked_curriculum(): void
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'usuario']);
        Sanctum::actingAs($user);

        $curriculum = InterviewCurriculum::factory()->create([
            'author_id' => $user->id,
        ]);

        Storage::disk('public')->put((string) $curriculum->document_path, 'curriculum');

        $this->deleteJson("/api/interview-curriculums/{$curriculum->id}")
            ->assertNoContent();

        $this->assertSoftDeleted('interview_curriculums', [
            'id' => $curriculum->id,
        ]);
    }

    public function test_admin_cannot_refuse_curriculum_from_another_author_without_visibility_permission(): void
    {
        $admin = User::factory()->create();
        $other = User::factory()->create();

        $curriculum = InterviewCurriculum::factory()->create([
            'author_id' => $other->id,
            'status' => 'pendente',
        ]);

        Sanctum::actingAs($admin);

        $this->patchJson("/api/interview-curriculums/{$curriculum->id}/refuse")
            ->assertForbidden();
    }
}
