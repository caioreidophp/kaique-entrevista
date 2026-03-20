<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class MonitorSuspiciousApiActivity
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->is('api/*')) {
            return $next($request);
        }

        $ip = (string) ($request->ip() ?? 'unknown');
        $path = (string) $request->path();
        $blockedUntilKey = $this->blockedUntilKey($ip);
        $blockedUntil = Cache::get($blockedUntilKey);

        if (is_int($blockedUntil) && $blockedUntil > now()->timestamp) {
            $retryAfter = max($blockedUntil - now()->timestamp, 1);

            return new JsonResponse([
                'message' => 'Muitas tentativas inválidas detectadas. Aguarde antes de tentar novamente.',
            ], 429, [
                'Retry-After' => (string) $retryAfter,
            ]);
        }

        /** @var Response $response */
        $response = $next($request);

        $status = (int) $response->getStatusCode();
        $counterKey = $this->attemptCounterKey($ip);

        if (in_array($status, [401, 403, 419], true)) {
            if (! Cache::has($counterKey)) {
                Cache::put($counterKey, 0, now()->addMinutes(10));
            }

            $attempts = Cache::increment($counterKey);

            if ($attempts >= 30) {
                $blockForSeconds = 15 * 60;
                Cache::put($blockedUntilKey, now()->timestamp + $blockForSeconds, now()->addSeconds($blockForSeconds));

                Log::warning('API security lock triggered', [
                    'ip' => $ip,
                    'path' => $path,
                    'status' => $status,
                    'attempts' => $attempts,
                    'user_id' => $request->user()?->id,
                    'user_agent' => (string) ($request->userAgent() ?? ''),
                ]);
            }
        } elseif ($status < 400) {
            Cache::forget($counterKey);
            Cache::forget($blockedUntilKey);
        }

        return $response;
    }

    private function attemptCounterKey(string $ip): string
    {
        return 'security:api:attempts:'.sha1($ip);
    }

    private function blockedUntilKey(string $ip): string
    {
        return 'security:api:blocked-until:'.sha1($ip);
    }
}
