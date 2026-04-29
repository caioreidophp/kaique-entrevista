<?php

namespace Tests\Feature\Api;

use App\Models\Unidade;
use App\Models\UserAccessScope;
use App\Models\User;
use App\Support\TransportPanelGuard;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_and_receive_token(): void
    {
        $unidade = Unidade::query()->create([
            'nome' => 'Amparo',
            'slug' => 'amparo',
        ]);

        $user = User::factory()->create([
            'password' => 'password',
        ]);
        UserAccessScope::query()->create([
            'user_id' => $user->id,
            'module_key' => 'registry',
            'data_scope' => 'units',
            'allowed_unit_ids' => [$unidade->id],
        ]);

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $response
            ->assertOk()
            ->assertJsonStructure([
                'token',
                'user' => ['id', 'name', 'email', 'access_scopes'],
            ])
            ->assertJsonPath('user.access_scopes.registry.module_key', 'registry')
            ->assertJsonPath('user.access_scopes.registry.data_scope', 'units')
            ->assertJsonPath('user.access_scopes.registry.allowed_unit_ids.0', $unidade->id)
            ->assertHeader('X-Request-Id')
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertCookie(TransportPanelGuard::COOKIE_NAME);
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        User::factory()->create([
            'password' => 'password',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'wrong@example.com',
            'password' => 'invalid-password',
        ]);

        $response->assertStatus(422);
    }

    public function test_login_is_rate_limited_after_many_attempts(): void
    {
        User::factory()->create([
            'email' => 'rate@example.com',
            'password' => 'password',
        ]);

        for ($attempt = 1; $attempt <= 8; $attempt++) {
            $this->postJson('/api/login', [
                'email' => 'rate@example.com',
                'password' => 'wrong-password',
            ])->assertStatus(422);
        }

        $this->postJson('/api/login', [
            'email' => 'rate@example.com',
            'password' => 'wrong-password',
        ])
            ->assertStatus(429)
            ->assertJsonPath('message', 'Muitas tentativas de login. Aguarde 1 minuto e tente novamente.');
    }

    public function test_logout_revokes_cookie_guard(): void
    {
        $user = User::factory()->create([
            'password' => 'password',
        ]);

        $login = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk();

        $token = (string) $login->json('token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Logout realizado com sucesso.')
            ->assertCookieExpired(TransportPanelGuard::COOKIE_NAME);
    }
}
