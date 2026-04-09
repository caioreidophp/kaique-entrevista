<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

class SessionManagementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user(), 401);

        $user = $request->user();
        $currentTokenId = $user->currentAccessToken()?->id;

        $tokens = PersonalAccessToken::query()
            ->where('tokenable_type', User::class)
            ->where('tokenable_id', $user->id)
            ->orderByDesc('last_activity_at')
            ->orderByDesc('created_at')
            ->limit(200)
            ->get([
                'id',
                'name',
                'ip_address',
                'user_agent',
                'last_activity_at',
                'last_used_at',
                'expires_at',
                'created_at',
            ]);

        return response()->json([
            'current_token_id' => $currentTokenId,
            'data' => $tokens->map(fn (PersonalAccessToken $token): array => [
                'id' => (int) $token->id,
                'name' => (string) $token->name,
                'ip_address' => $token->ip_address,
                'user_agent' => $token->user_agent,
                'last_activity_at' => $token->last_activity_at?->toISOString(),
                'last_used_at' => $token->last_used_at?->toISOString(),
                'expires_at' => $token->expires_at?->toISOString(),
                'created_at' => $token->created_at?->toISOString(),
                'is_current' => $currentTokenId === $token->id,
            ])->values(),
        ]);
    }

    public function revoke(Request $request, int $tokenId): JsonResponse
    {
        abort_unless($request->user(), 401);

        $user = $request->user();

        $token = PersonalAccessToken::query()
            ->where('tokenable_type', User::class)
            ->where('tokenable_id', $user->id)
            ->whereKey($tokenId)
            ->first();

        abort_unless($token, 404, 'Sessão não encontrada.');

        $token->delete();

        return response()->json([
            'message' => 'Sessão revogada com sucesso.',
            'token_id' => $tokenId,
        ]);
    }

    public function revokeOthers(Request $request): JsonResponse
    {
        abort_unless($request->user(), 401);

        $user = $request->user();
        $currentTokenId = $user->currentAccessToken()?->id;

        $query = PersonalAccessToken::query()
            ->where('tokenable_type', User::class)
            ->where('tokenable_id', $user->id);

        if ($currentTokenId) {
            $query->where('id', '!=', $currentTokenId);
        }

        $revoked = $query->delete();

        return response()->json([
            'message' => 'Sessões remotas encerradas com sucesso.',
            'revoked_count' => (int) $revoked,
        ]);
    }
}
