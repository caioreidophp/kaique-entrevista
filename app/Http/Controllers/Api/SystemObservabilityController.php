<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class SystemObservabilityController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $routes = $this->latencyRoutes();
        $httpStatuses = $this->httpStatusSummary();
        $recentErrors = $this->recentErrors();
        $recentExceptions = $this->recentExceptions();

        return response()->json([
            'generated_at' => now()->toIso8601String(),
            'latency' => [
                'routes' => $routes,
                'slowest_p95_ms' => $routes !== [] ? max(array_column($routes, 'p95_ms')) : 0,
            ],
            'http' => $httpStatuses,
            'errors' => [
                'recent_5xx' => $recentErrors,
                'recent_exceptions' => $recentExceptions,
            ],
            'alerts' => $this->alerts($routes, $httpStatuses, $recentErrors, $recentExceptions),
        ]);
    }

    /**
     * @return array<int, array<string, float|int|string>>
     */
    private function latencyRoutes(): array
    {
        $keys = Cache::get('telemetry:api:route-keys', []);
        if (! is_array($keys)) {
            $keys = [];
        }

        $rows = [];

        foreach (array_values(array_unique($keys)) as $key) {
            $samples = Cache::get((string) $key, []);
            if (! is_array($samples) || $samples === []) {
                continue;
            }

            sort($samples);
            $count = count($samples);
            $p50Index = (int) floor(($count - 1) * 0.5);
            $p95Index = (int) floor(($count - 1) * 0.95);

            $rows[] = [
                'key' => (string) $key,
                'samples' => $count,
                'p50_ms' => round((float) $samples[$p50Index], 2),
                'p95_ms' => round((float) $samples[$p95Index], 2),
                'avg_ms' => round(array_sum($samples) / max($count, 1), 2),
                'max_ms' => round((float) max($samples), 2),
            ];
        }

        usort($rows, fn (array $a, array $b): int => ((float) $b['p95_ms']) <=> ((float) $a['p95_ms']));

        return array_slice($rows, 0, 80);
    }

    /**
     * @return array<string, int>
     */
    private function httpStatusSummary(): array
    {
        $bucketKeys = Cache::get('telemetry:http-status:buckets', []);

        if (! is_array($bucketKeys)) {
            $bucketKeys = [];
        }

        $total = 0;
        $http2xx = 0;
        $http4xx = 0;
        $http5xx = 0;

        foreach (array_values(array_unique($bucketKeys)) as $bucketKey) {
            $bucket = Cache::get((string) $bucketKey, []);
            if (! is_array($bucket)) {
                continue;
            }

            foreach ($bucket as $status => $count) {
                $statusInt = (int) $status;
                $countInt = max((int) $count, 0);
                $total += $countInt;

                if ($statusInt >= 500) {
                    $http5xx += $countInt;
                } elseif ($statusInt >= 400) {
                    $http4xx += $countInt;
                } elseif ($statusInt >= 200) {
                    $http2xx += $countInt;
                }
            }
        }

        return [
            'total_requests_window' => $total,
            'http_2xx' => $http2xx,
            'http_4xx' => $http4xx,
            'http_5xx' => $http5xx,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function recentErrors(): array
    {
        $rows = Cache::get('telemetry:api:recent-errors', []);

        if (! is_array($rows)) {
            return [];
        }

        return array_slice($rows, -30);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function recentExceptions(): array
    {
        $rows = Cache::get('telemetry:exceptions:recent', []);

        if (! is_array($rows)) {
            return [];
        }

        return array_slice($rows, -30);
    }

    /**
     * @param array<int, array<string, float|int|string>> $routes
     * @param array<string, int> $httpStatuses
     * @param array<int, array<string, mixed>> $recentErrors
     * @param array<int, array<string, mixed>> $recentExceptions
     * @return array<int, array<string, mixed>>
     */
    private function alerts(array $routes, array $httpStatuses, array $recentErrors, array $recentExceptions): array
    {
        $alerts = [];

        $slowRoutes = array_values(array_filter($routes, fn (array $row): bool => (float) ($row['p95_ms'] ?? 0) >= 1500));
        if ($slowRoutes !== []) {
            $alerts[] = [
                'severity' => 'warning',
                'code' => 'latency_p95_high',
                'message' => 'Foram identificadas rotas com p95 acima de 1500ms.',
                'count' => count($slowRoutes),
            ];
        }

        if (($httpStatuses['http_5xx'] ?? 0) >= 10) {
            $alerts[] = [
                'severity' => 'critical',
                'code' => 'http_5xx_spike',
                'message' => 'Pico de erros HTTP 5xx detectado na janela de telemetria.',
                'count' => (int) ($httpStatuses['http_5xx'] ?? 0),
            ];
        }

        if (count($recentErrors) >= 10) {
            $alerts[] = [
                'severity' => 'warning',
                'code' => 'recent_5xx_high',
                'message' => 'Muitos erros 5xx recentes registrados no gateway da API.',
                'count' => count($recentErrors),
            ];
        }

        if (count($recentExceptions) >= 10) {
            $alerts[] = [
                'severity' => 'warning',
                'code' => 'recent_exceptions_high',
                'message' => 'Muitas exceções de aplicação registradas recentemente.',
                'count' => count($recentExceptions),
            ];
        }

        return $alerts;
    }
}