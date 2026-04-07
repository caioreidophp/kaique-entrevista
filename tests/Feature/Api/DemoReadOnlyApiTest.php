<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DemoReadOnlyApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_user_cannot_execute_mutating_requests(): void
    {
        config()->set('services.demo.enabled', true);
        config()->set('services.demo.readonly', true);
        config()->set('services.demo.email', 'demo@demo');

        $demo = User::factory()->create([
            'email' => 'demo@demo',
            'role' => 'admin',
        ]);

        Sanctum::actingAs($demo);

        $this->putJson('/api/settings/password', [
            'current_password' => 'password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])
            ->assertStatus(403)
            ->assertJsonPath('message', 'Conta demo em modo somente leitura. Ação bloqueada para proteger os dados já lançados.');
    }

    public function test_non_demo_user_keeps_default_request_flow(): void
    {
        config()->set('services.demo.enabled', true);
        config()->set('services.demo.readonly', true);
        config()->set('services.demo.email', 'demo@demo');

        $user = User::factory()->create([
            'email' => 'admin@example.com',
            'role' => 'admin',
        ]);

        Sanctum::actingAs($user);

        $this->putJson('/api/settings/password', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'current_password',
                'password',
            ]);
    }

    public function test_demo_user_can_still_logout(): void
    {
        config()->set('services.demo.enabled', true);
        config()->set('services.demo.readonly', true);
        config()->set('services.demo.email', 'demo@demo');

        $demo = User::factory()->create([
            'email' => 'demo@demo',
            'role' => 'admin',
        ]);

        Sanctum::actingAs($demo);

        $this->postJson('/api/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Logout realizado com sucesso.');
    }
}