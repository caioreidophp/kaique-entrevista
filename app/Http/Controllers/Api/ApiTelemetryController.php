<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ApiTelemetryController extends Controller
{
    public function latency(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $indexedKeys = Cache::get('telemetry:api:route-keys', []);
        if (! is_array($indexedKeys)) {
            $indexedKeys = [];
        }

        $keys = array_values(array_unique($indexedKeys));

        if ($keys === []) {
            $store = Cache::getStore();
            if (method_exists($store, 'getRedis')) {
                $redis = $store->getRedis();
                $prefix = method_exists($store, 'getPrefix') ? $store->getPrefix() : '';

                $rawKeys = $redis->keys($prefix.'telemetry:api:*');
                foreach ($rawKeys as $fullKey) {
                    $key = (string) $fullKey;
                    $keys[] = str_starts_with($key, $prefix)
                        ? substr($key, strlen($prefix))
                        : $key;
                }
            }
        }

        if ($keys === []) {
            return response()->json([
                'enabled' => false,
                'message' => 'Ainda não há amostras de telemetria disponíveis.',
                'routes' => [],
            ]);
        }
        $rows = [];

        foreach ($keys as $cacheKey) {
            $samples = Cache::get((string) $cacheKey, []);

            if (! is_array($samples) || count($samples) === 0) {
                continue;
            }

            sort($samples);
            $count = count($samples);
            $p50Index = (int) floor(($count - 1) * 0.5);
            $p95Index = (int) floor(($count - 1) * 0.95);

            $rows[] = [
                'key' => $cacheKey,
                'samples' => $count,
                'p50_ms' => round((float) $samples[$p50Index], 2),
                'p95_ms' => round((float) $samples[$p95Index], 2),
                'avg_ms' => round(array_sum($samples) / $count, 2),
                'max_ms' => round((float) max($samples), 2),
            ];
        }

        usort($rows, fn (array $first, array $second) => ($second['p95_ms'] <=> $first['p95_ms']));

        return response()->json([
            'enabled' => true,
            'routes' => array_slice($rows, 0, 80),
        ]);
    }
}
