<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LogSensitiveApiActions
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $this->shouldLog($request)) {
            return $response;
        }

        $user = $request->user();

        if (! $user) {
            return $response;
        }

        activity('security')
            ->causedBy($user)
            ->withProperties([
                'method' => $request->method(),
                'path' => '/'.$request->path(),
                'query' => $request->query(),
                'status' => $response->getStatusCode(),
                'ip' => (string) $request->ip(),
                'user_agent' => (string) $request->userAgent(),
            ])
            ->log('Ação sensível de API executada');

        return $response;
    }

    private function shouldLog(Request $request): bool
    {
        if (! in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return false;
        }

        $path = '/'.$request->path();

        $watchedPrefixes = [
            '/api/registry/',
            '/api/payroll/',
            '/api/freight/',
            '/api/settings/',
        ];

        $isWatchedPrefix = false;

        foreach ($watchedPrefixes as $prefix) {
            if (str_starts_with($path, $prefix)) {
                $isWatchedPrefix = true;
                break;
            }
        }

        if (! $isWatchedPrefix) {
            return false;
        }

        if ($request->method() === 'DELETE') {
            return true;
        }

        $sensitiveFragments = [
            '/import',
            '/bulk',
            '/backup',
            '/launch-batch',
            '/bill',
            '/unbill',
        ];

        foreach ($sensitiveFragments as $fragment) {
            if (str_contains($path, $fragment)) {
                return true;
            }
        }

        return in_array($request->method(), ['PUT', 'PATCH'], true);
    }
}
