<?php

namespace Tests\Feature\Web;

use App\Models\User;
use App\Support\TransportPanelGuard;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TransportRouteGuardTest extends TestCase
{
    use RefreshDatabase;

    public function test_transport_shell_redirects_to_login_without_guard_cookie(): void
    {
        $response = $this->get('/transport/home');

        $response->assertRedirect(route('transport.login'));
    }

    public function test_transport_shell_allows_request_with_valid_guard_cookie(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('api-token');
        $tokenId = (int) $token->accessToken->id;

        $cookie = TransportPanelGuard::makeCookieValue(
            userId: (int) $user->id,
            tokenId: $tokenId,
        );

        $response = $this->withUnencryptedCookie(TransportPanelGuard::COOKIE_NAME, $cookie)
            ->get('/transport/home');

        $response->assertOk();
    }
}
