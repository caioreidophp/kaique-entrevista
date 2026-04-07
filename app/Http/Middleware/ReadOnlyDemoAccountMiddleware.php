<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ReadOnlyDemoAccountMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        if (
            ! in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)
            || $request->is('api/logout')
        ) {
            return $next($request);
        }

        $user = $request->user();

        if (! $user || ! $this->isDemoReadOnlyEnabled()) {
            return $next($request);
        }

        $demoEmail = mb_strtolower(trim((string) config('services.demo.email', '')));
        $userEmail = mb_strtolower(trim((string) ($user->email ?? '')));

        if ($demoEmail === '' || $userEmail !== $demoEmail) {
            return $next($request);
        }

        return response()->json([
            'message' => 'Conta demo em modo somente leitura. Ação bloqueada para proteger os dados já lançados.',
        ], 403);
    }

    private function isDemoReadOnlyEnabled(): bool
    {
        return $this->toBool(config('services.demo.enabled', true), true)
            && $this->toBool(config('services.demo.readonly', true), true);
    }

    private function toBool(mixed $value, bool $default): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_int($value)) {
            return $value === 1;
        }

        if (is_string($value)) {
            $normalized = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

            return $normalized ?? $default;
        }

        return $default;
    }
}