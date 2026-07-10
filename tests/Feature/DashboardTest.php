<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_transport_dashboard()
    {
        $response = $this->get(route('dashboard'));
        $response->assertRedirect(route('transport.dashboard'));
    }

    public function test_authenticated_users_are_redirected_to_the_transport_dashboard()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->get(route('dashboard'));
        $response->assertRedirect(route('transport.dashboard'));
    }
}
