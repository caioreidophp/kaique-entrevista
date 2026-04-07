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

class DriverInterviewApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_usuario_can_create_and_view_own_interview(): void
    {
        $usuario = User::factory()->create(['role' => 'usuario']);
        Sanctum::actingAs($usuario);

        $createResponse = $this->postJson('/api/driver-interviews', $this->validPayload());

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.author_id', $usuario->id);

        $id = (int) $createResponse->json('data.id');

        $this->getJson('/api/driver-interviews/'.$id)
            ->assertOk()
            ->assertJsonPath('data.id', $id);
    }

    public function test_authenticated_user_can_create_interview(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $response = $this->postJson('/api/driver-interviews', $this->validPayload());

        $response
            ->assertCreated()
            ->assertJsonPath('data.full_name', 'João da Silva')
            ->assertJsonPath('data.hr_status', 'aprovado')
            ->assertJsonPath('data.guep_status', 'aguardando');

        $this->assertDatabaseHas('driver_interviews', [
            'full_name' => 'João da Silva',
            'hr_status' => 'aprovado',
            'guep_status' => 'aguardando',
        ]);
    }

    public function test_authenticated_user_can_filter_interviews_by_name_status_and_date(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        DriverInterview::factory()->create([
            'author_id' => $user->id,
            'user_id' => $user->id,
            'full_name' => 'Carlos Aprovado',
            'hr_status' => 'aprovado',
            'created_at' => now()->subDay(),
        ]);

        DriverInterview::factory()->create([
            'author_id' => $user->id,
            'user_id' => $user->id,
            'full_name' => 'Bruno Reprovado',
            'hr_status' => 'reprovado',
            'created_at' => now()->subDays(10),
        ]);

        $response = $this->getJson('/api/driver-interviews?name=Carlos&status=aprovado&date_from='.now()->subDays(2)->toDateString());

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.full_name', 'Carlos Aprovado');
    }

    public function test_master_admin_can_filter_interviews_by_author_id(): void
    {
        $master = User::factory()->masterAdmin()->create();
        $authorA = User::factory()->create();
        $authorB = User::factory()->create();

        DriverInterview::factory()->create([
            'author_id' => $authorA->id,
            'user_id' => $authorA->id,
            'full_name' => 'Autor A',
        ]);

        DriverInterview::factory()->create([
            'author_id' => $authorB->id,
            'user_id' => $authorB->id,
            'full_name' => 'Autor B',
        ]);

        Sanctum::actingAs($master);

        $response = $this->getJson("/api/driver-interviews?author_id={$authorA->id}");

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.full_name', 'Autor A')
            ->assertJsonPath('data.0.author.id', $authorA->id);
    }

    public function test_authenticated_user_can_soft_delete_interview(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $interview = DriverInterview::factory()->create([
            'author_id' => $user->id,
            'user_id' => $user->id,
        ]);

        $response = $this->deleteJson("/api/driver-interviews/{$interview->id}");

        $response->assertNoContent();

        $this->assertSoftDeleted('driver_interviews', [
            'id' => $interview->id,
        ]);
    }

    public function test_admin_cannot_view_interview_from_another_author(): void
    {
        $admin = User::factory()->create();
        $otherAuthor = User::factory()->create();

        $interview = DriverInterview::factory()->create([
            'author_id' => $otherAuthor->id,
            'user_id' => $otherAuthor->id,
        ]);

        Sanctum::actingAs($admin);

        $this->getJson("/api/driver-interviews/{$interview->id}")
            ->assertForbidden();
    }

    public function test_master_admin_can_view_interview_from_any_author(): void
    {
        $master = User::factory()->masterAdmin()->create();
        $otherAuthor = User::factory()->create();

        $interview = DriverInterview::factory()->create([
            'author_id' => $otherAuthor->id,
            'user_id' => $otherAuthor->id,
        ]);

        Sanctum::actingAs($master);

        $this->getJson("/api/driver-interviews/{$interview->id}")
            ->assertOk();
    }

    public function test_reproved_hr_status_forces_guep_status_to_nao_fazer(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $payload = $this->validPayload();
        $payload['hr_status'] = 'reprovado';

        $response = $this->postJson('/api/driver-interviews', $payload);

        $response
            ->assertCreated()
            ->assertJsonPath('data.hr_status', 'reprovado')
            ->assertJsonPath('data.guep_status', 'nao_fazer');
    }

    public function test_can_create_interview_without_general_observations(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $payload = $this->validPayload();
        $payload['general_observations'] = null;

        $response = $this->postJson('/api/driver-interviews', $payload);

        $response
            ->assertCreated()
            ->assertJsonPath('data.general_observations', null);
    }

    public function test_can_create_interview_without_expectations_and_new_observation_fields(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $payload = $this->validPayload();
        $payload['expectations_about_company'] = null;
        $payload['last_company_observation'] = null;
        $payload['previous_company_observation'] = null;
        $payload['salary_observation'] = null;
        $payload['last_exit_type'] = null;
        $payload['previous_exit_type'] = null;

        $response = $this->postJson('/api/driver-interviews', $payload);

        $response
            ->assertCreated()
            ->assertJsonPath('data.expectations_about_company', null)
            ->assertJsonPath('data.last_company_observation', null)
            ->assertJsonPath('data.previous_company_observation', null)
            ->assertJsonPath('data.salary_observation', null)
            ->assertJsonPath('data.last_exit_type', null)
            ->assertJsonPath('data.previous_exit_type', null);
    }

    public function test_rejects_cpf_with_letters(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $payload = $this->validPayload();
        $payload['cpf'] = '123.456.789-AB';

        $this->postJson('/api/driver-interviews', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cpf');
    }

    public function test_rejects_rg_with_less_than_three_characters(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $payload = $this->validPayload();
        $payload['rg'] = '1A';

        $this->postJson('/api/driver-interviews', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('rg');
    }

    public function test_rejects_phone_with_less_than_11_digits(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $payload = $this->validPayload();
        $payload['phone'] = '(11)9999-999';

        $this->postJson('/api/driver-interviews', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('phone');
    }

    public function test_rejects_cnh_with_non_numeric_characters(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $payload = $this->validPayload();
        $payload['cnh_number'] = '12345AB89';

        $this->postJson('/api/driver-interviews', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cnh_number');
    }

    public function test_rejects_category_with_non_letters(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $payload = $this->validPayload();
        $payload['cnh_category'] = '1';

        $this->postJson('/api/driver-interviews', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cnh_category');
    }

    public function test_authenticated_user_can_update_statuses_from_list_endpoint(): void
    {
        $user = User::factory()->create();
        $interview = DriverInterview::factory()->create([
            'author_id' => $user->id,
            'user_id' => $user->id,
            'hr_status' => 'aguardando_vaga',
            'guep_status' => 'aguardando',
        ]);

        Sanctum::actingAs($user);

        $this->patchJson("/api/driver-interviews/{$interview->id}/statuses", [
            'hr_status' => 'reprovado',
        ])
            ->assertOk()
            ->assertJsonPath('data.hr_status', 'reprovado')
            ->assertJsonPath('data.guep_status', 'nao_fazer');
    }

    public function test_cannot_update_guep_to_invalid_value_when_hr_is_reproved(): void
    {
        $user = User::factory()->create();
        $interview = DriverInterview::factory()->create([
            'author_id' => $user->id,
            'user_id' => $user->id,
            'hr_status' => 'reprovado',
            'guep_status' => 'nao_fazer',
        ]);

        Sanctum::actingAs($user);

        $this->patchJson("/api/driver-interviews/{$interview->id}/statuses", [
            'guep_status' => 'aprovado',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('guep_status');
    }

    public function test_admin_cannot_update_statuses_from_another_author(): void
    {
        $admin = User::factory()->create();
        $otherAuthor = User::factory()->create();

        $interview = DriverInterview::factory()->create([
            'author_id' => $otherAuthor->id,
            'user_id' => $otherAuthor->id,
        ]);

        Sanctum::actingAs($admin);

        $this->patchJson("/api/driver-interviews/{$interview->id}/statuses", [
            'hr_status' => 'aprovado',
        ])->assertForbidden();
    }

    public function test_admin_cannot_generate_pdf_from_another_author_interview(): void
    {
        $admin = User::factory()->create();
        $otherAuthor = User::factory()->create();

        $interview = DriverInterview::factory()->create([
            'author_id' => $otherAuthor->id,
            'user_id' => $otherAuthor->id,
        ]);

        Sanctum::actingAs($admin);

        $this->get("/api/driver-interviews/{$interview->id}/pdf")
            ->assertForbidden();
    }

    public function test_master_admin_can_generate_pdf_from_any_interview(): void
    {
        $master = User::factory()->masterAdmin()->create();
        $otherAuthor = User::factory()->create();

        $interview = DriverInterview::factory()->create([
            'author_id' => $otherAuthor->id,
            'user_id' => $otherAuthor->id,
        ]);

        Sanctum::actingAs($master);

        $this->get("/api/driver-interviews/{$interview->id}/pdf")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_author_can_upload_interview_attachments(): void
    {
        Storage::fake('public');

        $user = User::factory()->create();
        $interview = DriverInterview::factory()->create([
            'author_id' => $user->id,
            'user_id' => $user->id,
        ]);

        Sanctum::actingAs($user);

        $response = $this->post("/api/driver-interviews/{$interview->id}/attachments", [
            'candidate_photo_file' => UploadedFile::fake()->image('foto.jpg', 480, 640),
            'cnh_attachment_file' => UploadedFile::fake()->image('cnh.png', 800, 600),
            'work_card_attachment_file' => UploadedFile::fake()->create('ctps.pdf', 256, 'application/pdf'),
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.candidate_photo_original_name', 'foto.jpg')
            ->assertJsonPath('data.cnh_attachment_original_name', 'cnh.png')
            ->assertJsonPath('data.work_card_attachment_original_name', 'ctps.pdf');

        $interview->refresh();

        $this->assertNotNull($interview->candidate_photo_path);
        $this->assertNotNull($interview->cnh_attachment_path);
        $this->assertNotNull($interview->work_card_attachment_path);

        Storage::disk('public')->assertExists((string) $interview->candidate_photo_path);
        Storage::disk('public')->assertExists((string) $interview->cnh_attachment_path);
        Storage::disk('public')->assertExists((string) $interview->work_card_attachment_path);
    }

    public function test_linking_curriculum_on_interview_creation_updates_curriculum_status(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $curriculum = InterviewCurriculum::factory()->create([
            'author_id' => $user->id,
            'status' => 'pendente',
        ]);

        $payload = $this->validPayload();
        $payload['hr_status'] = 'aguardando_vaga';
        $payload['curriculum_id'] = $curriculum->id;

        $response = $this->postJson('/api/driver-interviews', $payload);

        $response
            ->assertCreated()
            ->assertJsonPath('data.curriculum.id', $curriculum->id)
            ->assertJsonPath('data.curriculum.status', 'aguardando_entrevista');

        $this->assertDatabaseHas('interview_curriculums', [
            'id' => $curriculum->id,
            'status' => 'aguardando_entrevista',
        ]);
    }

    public function test_updating_hr_status_to_reproved_updates_linked_curriculum_status(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $curriculum = InterviewCurriculum::factory()->create([
            'author_id' => $user->id,
            'status' => 'aguardando_entrevista',
        ]);

        $interview = DriverInterview::factory()->create([
            'author_id' => $user->id,
            'user_id' => $user->id,
            'curriculum_id' => $curriculum->id,
            'hr_status' => 'aguardando_vaga',
        ]);

        $this->patchJson("/api/driver-interviews/{$interview->id}/statuses", [
            'hr_status' => 'reprovado',
        ])
            ->assertOk()
            ->assertJsonPath('data.curriculum.status', 'reprovado_entrevista');

        $this->assertDatabaseHas('interview_curriculums', [
            'id' => $curriculum->id,
            'status' => 'reprovado_entrevista',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validPayload(): array
    {
        return [
            'full_name' => 'João da Silva',
            'preferred_name' => 'João',
            'phone' => '11999999999',
            'email' => 'joao@example.com',
            'city' => 'São Paulo',
            'marital_status' => 'casado',
            'has_children' => true,
            'children_situation' => null,
            'cpf' => '12345678901',
            'rg' => '123456789X',
            'cnh_number' => '98765432109',
            'cnh_category' => 'AB',
            'cnh_expiration_date' => '2030-12-31',
            'ear' => true,
            'last_company' => 'TransLog',
            'last_role' => 'Motorista',
            'last_city' => 'Campinas',
            'last_period_start' => '2021-01-01',
            'last_period_end' => '2023-12-31',
            'last_exit_reason' => 'Mudança de escala',
            'previous_company' => 'Rápido Sul',
            'previous_role' => 'Motorista',
            'previous_city' => 'Jundiaí',
            'previous_period_start' => '2019-01-01',
            'previous_period_end' => '2020-12-31',
            'previous_exit_reason' => 'Fim de contrato',
            'relevant_experience' => 'Experiência com longas viagens e cargas frágeis.',
            'truck_types_operated' => 'Truck, carreta',
            'night_shift_experience' => true,
            'live_animals_transport_experience' => false,
            'accident_history' => true,
            'accident_details' => 'Pequena colisão sem vítimas em 2020.',
            'schedule_availability' => '12x36',
            'start_availability_date' => now()->toDateString(),
            'knows_company_contact' => true,
            'contact_name' => 'Carlos RH',
            'expectations_about_company' => 'Crescimento e estabilidade.',
            'last_salary' => 3800.50,
            'salary_expectation' => 4500.00,
            'posture_communication' => 'Boa comunicação e postura profissional.',
            'perceived_experience' => 'Experiência consistente em rodovias.',
            'general_observations' => 'Bom alinhamento com a vaga.',
            'candidate_interest' => 'alto',
            'availability_matches' => true,
            'overall_score' => 9,
            'hr_status' => 'aprovado',
        ];
    }
}
