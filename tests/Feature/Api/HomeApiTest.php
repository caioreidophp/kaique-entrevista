<?php

namespace Tests\Feature\Api;

use App\Models\DriverInterview;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HomeApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_home_endpoint_requires_authentication(): void
    {
        $this->getJson('/api/home')->assertUnauthorized();
    }

    public function test_authenticated_user_receives_home_modules_payload(): void
    {
        $user = User::factory()->create();

        DriverInterview::factory()->create([
            'author_id' => $user->id,
            'user_id' => $user->id,
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/home');

        $response
            ->assertOk()
            ->assertJsonStructure([
                'modules' => [
                    '*' => [
                        'key',
                        'title',
                        'description',
                        'href',
                        'icon',
                        'metrics',
                    ],
                ],
            ])
            ->assertJsonPath('modules.0.key', 'interviews')
            ->assertJsonPath('modules.0.metrics.total_interviews', 1)
            ->assertJsonPath('modules.1.key', 'payroll')
            ->assertJsonPath('modules.2.key', 'registry');
    }
}
