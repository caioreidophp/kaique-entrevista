<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireCriticalActionConfirmation
{
    public function handle(Request $request, Closure $next): Response
    {
        if (app()->environment('testing')) {
            return $next($request);
        }

        if (! $this->requiresConfirmation($request)) {
            return $next($request);
        }

        if ($request->header('X-Confirm-Action') === 'yes') {
            return $next($request);
        }

        return new JsonResponse([
            'message' => 'Confirmação explícita obrigatória para ação crítica.',
        ], 428);
    }

    private function requiresConfirmation(Request $request): bool
    {
        if (! in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return false;
        }

        $path = '/'.$request->path();

        if ($request->method() === 'DELETE') {
            return true;
        }

        $criticalFragments = [
            '/import',
            '/bulk',
            '/bill',
            '/unbill',
            '/backup',
            '/settings/password',
            '/registry/users',
        ];

        foreach ($criticalFragments as $fragment) {
            if (str_contains($path, $fragment)) {
                return true;
            }
        }

        return false;
    }
}
