<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_and_receive_token(): void
    {
        $user = User::factory()->create([
            'password' => 'password',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $response
            ->assertOk()
            ->assertJsonStructure([
                'token',
                'user' => ['id', 'name', 'email'],
            ])
            ->assertHeader('X-Request-Id')
            ->assertHeader('Cache-Control', 'no-store, private');
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
}
