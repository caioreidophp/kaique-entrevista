<?php

namespace Tests\Feature\Api;

use App\Enums\HrStatus;
use App\Models\Colaborador;
use App\Models\DriverInterview;
use App\Models\Funcao;
use App\Models\Onboarding;
use App\Models\OnboardingItem;
use App\Models\Unidade;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OnboardingApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_hiring_creates_onboarding_with_default_items(): void
    {
        $admin = User::factory()->create();
        Sanctum::actingAs($admin);

        [$interview, $colaborador] = $this->createInterviewAndColaborador($admin, '12345678901');

        $response = $this->patchJson("/api/next-steps/{$interview->id}/hiring-status", [
            'foi_contratado' => true,
            'colaborador_id' => $colaborador->id,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.foi_contratado', true)
            ->assertJsonPath('data.onboarding_status', 'em_andamento')
            ->assertJsonStructure([
                'data' => ['onboarding_id'],
            ]);

        $onboardingId = (int) $response->json('data.onboarding_id');

        $this->assertDatabaseHas('onboardings', [
            'id' => $onboardingId,
            'driver_interview_id' => $interview->id,
            'colaborador_id' => $colaborador->id,
            'responsavel_user_id' => $admin->id,
            'status' => 'em_andamento',
        ]);

        $this->assertSame(15, OnboardingItem::query()->where('onboarding_id', $onboardingId)->count());
    }

    public function test_updating_required_item_to_rejected_blocks_onboarding(): void
    {
        $admin = User::factory()->create();
        Sanctum::actingAs($admin);

        $onboarding = $this->hireInterviewAndGetOnboarding($admin, '22233344455');
        $requiredItem = $onboarding->items()->where('required', true)->firstOrFail();

        $this->patchJson("/api/onboarding-items/{$requiredItem->id}", [
            'status' => 'reprovado',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'reprovado');

        $this->assertDatabaseHas('onboarding_items', [
            'id' => $requiredItem->id,
            'status' => 'reprovado',
        ]);

        $this->assertDatabaseHas('onboardings', [
            'id' => $onboarding->id,
            'status' => 'bloqueado',
        ]);
    }

    public function test_cannot_complete_onboarding_with_pending_required_items(): void
    {
        $admin = User::factory()->create();
        Sanctum::actingAs($admin);

        $onboarding = $this->hireInterviewAndGetOnboarding($admin, '98765432100');

        $this->postJson("/api/onboardings/{$onboarding->id}/complete")
            ->assertStatus(422)
            ->assertJson([
                'message' => 'Existem itens obrigatórios pendentes para concluir o onboarding.',
            ]);
    }

    public function test_can_complete_onboarding_when_all_required_items_are_approved(): void
    {
        $admin = User::factory()->create();
        Sanctum::actingAs($admin);

        $onboarding = $this->hireInterviewAndGetOnboarding($admin, '11122233344');

        $onboarding->items()
            ->where('required', true)
            ->update([
                'status' => 'aprovado',
                'approved_by' => $admin->id,
                'approved_at' => now(),
            ]);

        $this->postJson("/api/onboardings/{$onboarding->id}/complete")
            ->assertOk()
            ->assertJsonPath('data.status', 'concluido');

        $this->assertDatabaseHas('onboardings', [
            'id' => $onboarding->id,
            'status' => 'concluido',
        ]);

        $this->assertNotNull(Onboarding::query()->findOrFail($onboarding->id)->concluded_at);
    }

    public function test_can_upload_and_download_attachment_and_non_authorized_user_cannot_download(): void
    {
        Storage::fake('local');

        $admin = User::factory()->create();
        Sanctum::actingAs($admin);

        $onboarding = $this->hireInterviewAndGetOnboarding($admin, '55443322110');
        $item = $onboarding->items()->firstOrFail();

        $uploadResponse = $this->postJson("/api/onboarding-items/{$item->id}/attachments", [
            'file' => $this->fakeSignedPdf('documento.pdf'),
        ]);

        $uploadResponse
            ->assertCreated()
            ->assertJsonPath('data.original_name', 'documento.pdf')
            ->assertJsonStructure([
                'data' => ['id', 'download_url'],
            ]);

        $attachmentId = (int) $uploadResponse->json('data.id');

        $this->get("/api/onboarding-attachments/{$attachmentId}/download")
            ->assertOk()
            ->assertHeader('Content-Disposition', 'attachment; filename=documento.pdf')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY');

        $otherAdmin = User::factory()->create();
        Sanctum::actingAs($otherAdmin);

        $this->get("/api/onboarding-attachments/{$attachmentId}/download")
            ->assertForbidden();
    }

    public function test_onboarding_summary_returns_sla_counters(): void
    {
        $admin = User::factory()->create();
        Sanctum::actingAs($admin);

        $overdueOnboarding = $this->hireInterviewAndGetOnboarding($admin, '74185296300');
        $todayOnboarding = $this->hireInterviewAndGetOnboarding($admin, '74185296311');
        $soonOnboarding = $this->hireInterviewAndGetOnboarding($admin, '74185296322');

        $overdueItem = $overdueOnboarding->items()->where('required', true)->firstOrFail();
        $todayItem = $todayOnboarding->items()->where('required', true)->firstOrFail();
        $soonItem = $soonOnboarding->items()->where('required', true)->firstOrFail();

        $overdueItem->update([
            'due_date' => now()->subDay()->toDateString(),
            'status' => 'pendente',
        ]);

        $todayItem->update([
            'due_date' => now()->toDateString(),
            'status' => 'pendente',
        ]);

        $soonItem->update([
            'due_date' => now()->addDays(2)->toDateString(),
            'status' => 'pendente',
        ]);

        $response = $this->getJson('/api/onboardings/summary');

        $response
            ->assertOk()
            ->assertJsonPath('total', 3)
            ->assertJsonPath('em_andamento', 3)
            ->assertJsonPath('atrasados', 1)
            ->assertJsonPath('vencem_hoje', 1)
            ->assertJsonPath('vencem_3_dias', 2);
    }

    public function test_deleting_interview_also_removes_onboarding(): void
    {
        $admin = User::factory()->create();
        Sanctum::actingAs($admin);

        [$interview, $colaborador] = $this->createInterviewAndColaborador($admin, '10293847566');

        $this->patchJson("/api/next-steps/{$interview->id}/hiring-status", [
            'foi_contratado' => true,
            'colaborador_id' => $colaborador->id,
        ])->assertOk();

        $onboarding = Onboarding::query()
            ->where('driver_interview_id', $interview->id)
            ->firstOrFail();

        $interview->delete();

        $this->assertDatabaseMissing('onboardings', [
            'id' => $onboarding->id,
        ]);
    }

    /**
     * @return array{DriverInterview, Colaborador}
     */
    private function createInterviewAndColaborador(User $admin, string $cpf): array
    {
        $unidade = Unidade::query()->firstOrCreate(
            ['slug' => 'amparo'],
            ['nome' => 'Amparo'],
        );
        $funcao = Funcao::query()->firstOrCreate(
            ['nome' => 'Motorista'],
            ['ativo' => true],
        );

        $interview = DriverInterview::factory()->create([
            'author_id' => $admin->id,
            'user_id' => $admin->id,
            'hr_status' => HrStatus::Aprovado,
            'cpf' => $cpf,
        ]);

        $colaborador = Colaborador::query()->create([
            'unidade_id' => $unidade->id,
            'funcao_id' => $funcao->id,
            'nome' => 'Colaborador '.$cpf,
            'ativo' => true,
            'cpf' => $cpf,
            'rg' => '123456789X',
            'telefone' => '11999999999',
        ]);

        return [$interview, $colaborador];
    }

    private function hireInterviewAndGetOnboarding(User $admin, string $cpf): Onboarding
    {
        [$interview, $colaborador] = $this->createInterviewAndColaborador($admin, $cpf);

        $this->patchJson("/api/next-steps/{$interview->id}/hiring-status", [
            'foi_contratado' => true,
            'colaborador_id' => $colaborador->id,
        ])->assertOk();

        return Onboarding::query()
            ->where('driver_interview_id', $interview->id)
            ->firstOrFail();
    }

    private function fakeSignedPdf(string $name): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, "%PDF-1.4\nfake");
    }
}
