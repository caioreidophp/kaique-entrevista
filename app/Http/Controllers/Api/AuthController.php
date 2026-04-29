<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\RolePermissionCatalog;
use App\Support\TransportPanelGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * @throws ValidationException
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $email = mb_strtolower(trim((string) $credentials['email']));

        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Credenciais inválidas.'],
            ]);
        }

        if (Hash::needsRehash($user->password)) {
            $user->forceFill([
                'password' => Hash::make($credentials['password']),
            ])->save();
        }

        $newToken = $user->createToken('api-token');
        $newToken->accessToken->forceFill([
            'ip_address' => (string) ($request->ip() ?? ''),
            'user_agent' => mb_substr((string) ($request->userAgent() ?? ''), 0, 1000),
            'last_activity_at' => now(),
            'last_used_at' => now(),
        ])->save();

        $token = $newToken->plainTextToken;
        $tokenId = (int) explode('|', $token, 2)[0];
        $guardCookieValue = TransportPanelGuard::makeCookieValue(
            userId: (int) $user->id,
            tokenId: $tokenId,
        );

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'permissions' => RolePermissionCatalog::forRole((string) $user->role),
                'access_scopes' => $user->resolvedAccessScopes(),
            ],
        ])->cookie(
            TransportPanelGuard::COOKIE_NAME,
            $guardCookieValue,
            60 * 24 * 7,
            '/',
            null,
            (bool) $request->isSecure(),
            true,
            false,
            'lax',
        );
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json([
            'message' => 'Logout realizado com sucesso.',
        ])->withoutCookie(TransportPanelGuard::COOKIE_NAME, '/');
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => [
                'id' => $user?->id,
                'name' => $user?->name,
                'email' => $user?->email,
                'role' => $user?->role,
                'permissions' => RolePermissionCatalog::forRole((string) $user?->role),
                'access_scopes' => $user?->resolvedAccessScopes() ?? [],
            ],
        ]);
    }
}
