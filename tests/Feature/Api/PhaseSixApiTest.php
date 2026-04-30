<?php

namespace Tests\Feature\Api;

use App\Models\DriverInterview;
use App\Models\RecordComment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PhaseSixApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_manage_own_quick_accesses(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($user);

        $createResponse = $this->postJson('/api/quick-accesses', [
            'shortcut_key' => 'payroll:dashboard',
            'label' => 'Folha',
            'href' => '/transport/payroll/dashboard',
            'sort_order' => 2,
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.user_id', $user->id)
            ->assertJsonPath('data.shortcut_key', 'payroll:dashboard');

        $id = (int) $createResponse->json('data.id');

        $this->getJson('/api/quick-accesses')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $id);

        $this->putJson("/api/quick-accesses/{$id}", [
            'label' => 'Folha mensal',
        ])
            ->assertOk()
            ->assertJsonPath('data.label', 'Folha mensal');

        $this->deleteJson("/api/quick-accesses/{$id}")
            ->assertNoContent();

        $this->getJson('/api/quick-accesses')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_record_comments_resolve_mentions_and_allow_listing(): void
    {
        $author = User::factory()->create(['role' => 'admin']);
        $mentionedUser = User::factory()->create([
            'role' => 'admin',
            'email' => 'marina.oliveira@example.com',
            'name' => 'Marina Oliveira',
        ]);
        $interview = DriverInterview::factory()->create([
            'author_id' => $author->id,
            'user_id' => $author->id,
        ]);

        Sanctum::actingAs($author);

        $storeResponse = $this->postJson('/api/record-comments', [
            'module_key' => 'interviews',
            'record_id' => $interview->id,
            'body' => 'Validar documentos com @marina.oliveira@example.com antes da aprovacao.',
        ]);

        $storeResponse
            ->assertCreated()
            ->assertJsonPath('data.module_key', 'interviews')
            ->assertJsonPath('data.record_id', $interview->id)
            ->assertJsonPath('data.mentioned_users.0.id', $mentionedUser->id);

        $this->getJson("/api/record-comments?module_key=interviews&record_id={$interview->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.author.id', $author->id)
            ->assertJsonPath('data.0.mentioned_users.0.email', $mentionedUser->email);
    }

    public function test_global_search_respects_interview_visibility_scope(): void
    {
        $owner = User::factory()->create(['role' => 'admin']);
        $reader = User::factory()->create(['role' => 'usuario']);
        $interview = DriverInterview::factory()->create([
            'author_id' => $owner->id,
            'user_id' => $owner->id,
            'full_name' => 'Carlos Teste Escopo',
        ]);

        Sanctum::actingAs($owner);
        $this->getJson('/api/search/global?q=Carlos%20Teste')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.meta.record_id', $interview->id);

        Sanctum::actingAs($reader);
        $this->getJson('/api/search/global?q=Carlos%20Teste')
            ->assertOk()
            ->assertJsonPath('total', 0);
    }

    public function test_record_comment_delete_requires_owner_or_admin_permission(): void
    {
        $owner = User::factory()->create(['role' => 'admin']);
        $other = User::factory()->create(['role' => 'usuario']);
        $interview = DriverInterview::factory()->create([
            'author_id' => $owner->id,
            'user_id' => $owner->id,
        ]);
        $comment = RecordComment::query()->create([
            'module_key' => 'interviews',
            'record_id' => $interview->id,
            'body' => 'Comentario inicial',
            'mentioned_user_ids' => [],
            'created_by' => $owner->id,
        ]);

        Sanctum::actingAs($other);
        $this->deleteJson("/api/record-comments/{$comment->id}")
            ->assertForbidden();

        Sanctum::actingAs($owner);
        $this->deleteJson("/api/record-comments/{$comment->id}")
            ->assertNoContent();
    }
}
