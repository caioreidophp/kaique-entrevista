<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class QueueMonitorController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $jobsAvailable = Schema::hasTable('jobs');
        $failedAvailable = Schema::hasTable('failed_jobs');

        $pendingByQueue = [];
        $pendingTotal = 0;

        if ($jobsAvailable) {
            $pendingByQueue = DB::table('jobs')
                ->selectRaw('queue, COUNT(*) as total')
                ->groupBy('queue')
                ->orderByDesc('total')
                ->get()
                ->map(fn ($row): array => [
                    'queue' => (string) $row->queue,
                    'total' => (int) $row->total,
                ])
                ->all();

            $pendingTotal = array_sum(array_column($pendingByQueue, 'total'));
        }

        $failedTotal = 0;
        $recentFailed = [];

        if ($failedAvailable) {
            $failedTotal = (int) DB::table('failed_jobs')->count();
            $recentFailed = DB::table('failed_jobs')
                ->select(['id', 'uuid', 'queue', 'failed_at'])
                ->orderByDesc('id')
                ->limit(20)
                ->get()
                ->map(fn ($row): array => [
                    'id' => (int) $row->id,
                    'uuid' => (string) $row->uuid,
                    'queue' => (string) $row->queue,
                    'failed_at' => (string) $row->failed_at,
                ])
                ->all();
        }

        return response()->json([
            'queue_connection' => (string) config('queue.default'),
            'supports_jobs_table' => $jobsAvailable,
            'supports_failed_jobs' => $failedAvailable,
            'pending' => [
                'total' => $pendingTotal,
                'by_queue' => $pendingByQueue,
            ],
            'failed' => [
                'total' => $failedTotal,
                'recent' => $recentFailed,
            ],
            'actions' => [
                'retry_single' => '/api/system/queue/failed/{id}/retry',
                'retry_all' => '/api/system/queue/failed/retry-all',
                'forget_single' => '/api/system/queue/failed/{id}',
                'flush_all' => '/api/system/queue/failed',
            ],
        ]);
    }

    public function failed(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        if (! Schema::hasTable('failed_jobs')) {
            return response()->json([
                'data' => [],
                'total' => 0,
            ]);
        }

        $rows = DB::table('failed_jobs')
            ->select(['id', 'uuid', 'connection', 'queue', 'failed_at'])
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        return response()->json([
            'data' => $rows,
            'total' => (int) DB::table('failed_jobs')->count(),
        ]);
    }

    public function retry(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        if (! Schema::hasTable('failed_jobs')) {
            abort(422, 'Tabela de jobs falhos não disponível.');
        }

        Artisan::call('queue:retry', [
            'id' => [$id],
        ]);

        return response()->json([
            'message' => 'Job reenfileirado com sucesso.',
            'id' => $id,
            'output' => trim((string) Artisan::output()),
        ]);
    }

    public function retryAll(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        if (! Schema::hasTable('failed_jobs')) {
            abort(422, 'Tabela de jobs falhos não disponível.');
        }

        Artisan::call('queue:retry', [
            'id' => ['all'],
        ]);

        return response()->json([
            'message' => 'Todos os jobs falhos foram reenfileirados.',
            'output' => trim((string) Artisan::output()),
        ]);
    }

    public function forget(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        if (! Schema::hasTable('failed_jobs')) {
            abort(422, 'Tabela de jobs falhos não disponível.');
        }

        Artisan::call('queue:forget', [
            'id' => $id,
        ]);

        return response()->json([
            'message' => 'Job removido da lista de falhas.',
            'id' => $id,
            'output' => trim((string) Artisan::output()),
        ]);
    }

    public function flush(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        if (! Schema::hasTable('failed_jobs')) {
            abort(422, 'Tabela de jobs falhos não disponível.');
        }

        Artisan::call('queue:flush');

        return response()->json([
            'message' => 'Lista de jobs falhos limpa com sucesso.',
            'output' => trim((string) Artisan::output()),
        ]);
    }
}