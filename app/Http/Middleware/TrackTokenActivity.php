<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class TrackTokenActivity
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->user()?->currentAccessToken();

        if ($token && (bool) config('transport_features.session_management', true)) {
            $tokenId = (int) data_get($token, 'id', 0);

            if ($tokenId <= 0 || ! method_exists($token, 'forceFill') || ! method_exists($token, 'save')) {
                return $next($request);
            }

            $throttleKey = 'token:last-activity:'.$tokenId;

            if (Cache::add($throttleKey, 1, now()->addSeconds(60))) {
                $token->forceFill([
                    'last_activity_at' => now(),
                    'last_used_at' => now(),
                    'ip_address' => (string) ($request->ip() ?? ''),
                    'user_agent' => mb_substr((string) ($request->userAgent() ?? ''), 0, 1000),
                ]);

                $token->save();
            }
        }

        return $next($request);
    }
}
