<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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
            'data' => $tokens->map(function (PersonalAccessToken $token) use ($currentTokenId): array {
                $device = $this->parseDeviceContext((string) ($token->user_agent ?? ''));
                $lastSeenAt = $token->last_activity_at ?? $token->last_used_at ?? $token->created_at;
                $lastSeenDate = $lastSeenAt ? Carbon::parse($lastSeenAt) : null;
                $daysWithoutActivity = $lastSeenDate ? (int) $lastSeenDate->diffInDays(now()) : null;

                return [
                    'id' => (int) $token->id,
                    'name' => (string) $token->name,
                    'ip_address' => $token->ip_address,
                    'user_agent' => $token->user_agent,
                    'last_activity_at' => $this->toIsoString($token->last_activity_at),
                    'last_used_at' => $this->toIsoString($token->last_used_at),
                    'expires_at' => $this->toIsoString($token->expires_at),
                    'created_at' => $this->toIsoString($token->created_at),
                    'is_current' => $currentTokenId === $token->id,
                    'device' => $device,
                    'days_without_activity' => $daysWithoutActivity,
                    'risk_flags' => array_values(array_filter([
                        $token->expires_at && $token->expires_at->isPast() ? 'expired' : null,
                        $daysWithoutActivity !== null && $daysWithoutActivity >= 30 ? 'stale' : null,
                        blank($token->ip_address) ? 'missing_ip' : null,
                        blank($token->user_agent) ? 'missing_user_agent' : null,
                    ])),
                ];
            })->values(),
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

        abort_unless($token, 404, 'Sessao nao encontrada.');

        $token->delete();

        return response()->json([
            'message' => 'Sessao revogada com sucesso.',
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
            'message' => 'Sessoes remotas encerradas com sucesso.',
            'revoked_count' => (int) $revoked,
        ]);
    }

    /**
     * @return array{browser:string,os:string,device_type:string}
     */
    private function parseDeviceContext(string $userAgent): array
    {
        $normalized = strtolower($userAgent);

        $browser = match (true) {
            str_contains($normalized, 'edg/') => 'Edge',
            str_contains($normalized, 'chrome/') => 'Chrome',
            str_contains($normalized, 'firefox/') => 'Firefox',
            str_contains($normalized, 'safari/') && ! str_contains($normalized, 'chrome/') => 'Safari',
            str_contains($normalized, 'postmanruntime') => 'Postman',
            str_contains($normalized, 'insomnia') => 'Insomnia',
            default => 'Unknown',
        };

        $os = match (true) {
            str_contains($normalized, 'windows') => 'Windows',
            str_contains($normalized, 'android') => 'Android',
            str_contains($normalized, 'iphone') || str_contains($normalized, 'ipad') || str_contains($normalized, 'ios') => 'iOS',
            str_contains($normalized, 'mac os') || str_contains($normalized, 'macintosh') => 'macOS',
            str_contains($normalized, 'linux') => 'Linux',
            default => 'Unknown',
        };

        $deviceType = match (true) {
            str_contains($normalized, 'ipad') || str_contains($normalized, 'tablet') => 'tablet',
            str_contains($normalized, 'iphone') || str_contains($normalized, 'android') || str_contains($normalized, 'mobile') => 'mobile',
            str_contains($normalized, 'postmanruntime') || str_contains($normalized, 'insomnia') => 'api_client',
            default => 'desktop',
        };

        return [
            'browser' => $browser,
            'os' => $os,
            'device_type' => $deviceType,
        ];
    }

    private function toIsoString(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return Carbon::parse($value)->toISOString();
    }
}
