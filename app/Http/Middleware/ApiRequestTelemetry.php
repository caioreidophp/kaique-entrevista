<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class ApiRequestTelemetry
{
    public function handle(Request $request, Closure $next): Response
    {
        $start = microtime(true);

        /** @var Response $response */
        $response = $next($request);

        $durationMs = max(0.1, round((microtime(true) - $start) * 1000, 2));
        $metricKey = $this->metricKey($request);
        $routeIdentifier = $this->routeIdentifier($request);
        $statusCode = (int) $response->getStatusCode();

        $samples = Cache::get($metricKey, []);
        if (! is_array($samples)) {
            $samples = [];
        }

        $samples[] = $durationMs;
        if (count($samples) > 200) {
            $samples = array_slice($samples, -200);
        }

        Cache::put($metricKey, $samples, now()->addHours(6));

        $indexedRouteKeys = Cache::get('telemetry:api:route-keys', []);
        if (! is_array($indexedRouteKeys)) {
            $indexedRouteKeys = [];
        }

        if (! in_array($metricKey, $indexedRouteKeys, true)) {
            $indexedRouteKeys[] = $metricKey;
            if (count($indexedRouteKeys) > 300) {
                $indexedRouteKeys = array_slice($indexedRouteKeys, -300);
            }
            Cache::put('telemetry:api:route-keys', $indexedRouteKeys, now()->addHours(6));
        }

        $statusBucketKey = 'telemetry:http-status:'.now()->format('YmdHi');
        $statusCounters = Cache::get($statusBucketKey, []);
        if (! is_array($statusCounters)) {
            $statusCounters = [];
        }

        $statusCounters[$statusCode] = ((int) ($statusCounters[$statusCode] ?? 0)) + 1;
        Cache::put($statusBucketKey, $statusCounters, now()->addHours(2));

        $statusBucketIndex = Cache::get('telemetry:http-status:buckets', []);
        if (! is_array($statusBucketIndex)) {
            $statusBucketIndex = [];
        }

        if (! in_array($statusBucketKey, $statusBucketIndex, true)) {
            $statusBucketIndex[] = $statusBucketKey;
            if (count($statusBucketIndex) > 180) {
                $statusBucketIndex = array_slice($statusBucketIndex, -180);
            }
            Cache::put('telemetry:http-status:buckets', $statusBucketIndex, now()->addHours(2));
        }

        if ($statusCode >= 500) {
            $recentErrors = Cache::get('telemetry:api:recent-errors', []);

            if (! is_array($recentErrors)) {
                $recentErrors = [];
            }

            $recentErrors[] = [
                'timestamp' => now()->toIso8601String(),
                'path' => trim((string) $request->path(), '/'),
                'method' => strtoupper((string) $request->method()),
                'route' => $routeIdentifier,
                'status' => $statusCode,
                'duration_ms' => $durationMs,
            ];

            if (count($recentErrors) > 100) {
                $recentErrors = array_slice($recentErrors, -100);
            }

            Cache::put('telemetry:api:recent-errors', $recentErrors, now()->addHours(6));
        }

        $response->headers->set('X-Response-Time-Ms', (string) $durationMs);
        $response->headers->set('Server-Timing', sprintf('app;dur=%s', $durationMs));

        return $response;
    }

    private function metricKey(Request $request): string
    {
        $routeIdentifier = $this->routeIdentifier($request);

        return sprintf('telemetry:api:%s:%s', strtoupper($request->method()), $routeIdentifier);
    }

    private function routeIdentifier(Request $request): string
    {
        $route = $request->route();

        return (string) ($route?->getName() ?: $route?->uri() ?: trim((string) $request->path(), '/'));
    }
}
