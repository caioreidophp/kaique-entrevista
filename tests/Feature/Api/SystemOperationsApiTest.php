<?php

namespace Tests\Feature\Api;

use App\Models\AsyncOperation;
use App\Models\Unidade;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SystemOperationsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_access_observability_and_queue_operations_endpoints(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);
        $operation = AsyncOperation::query()->create([
            'user_id' => $admin->id,
            'category' => 'export',
            'type' => 'payroll',
            'status' => 'queued',
            'progress_percent' => 0,
            'summary' => 'Export in queue',
            'reference_type' => 'tests',
            'reference_id' => 'seed-1',
            'context' => ['unit_id' => $unidade->id],
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/home')->assertOk();

        $this->getJson('/api/system/observability')
            ->assertOk()
            ->assertJsonStructure([
                'generated_at',
                'latency' => ['routes', 'slowest_p95_ms'],
                'http' => ['total_requests_window', 'http_2xx', 'http_4xx', 'http_5xx'],
                'async_operations' => ['queued', 'processing', 'completed', 'failed', 'recent'],
                'cache' => ['permissions_version', 'home_version', 'payroll_version', 'freight_version', 'master_data_version'],
                'master_data' => ['issues'],
                'errors' => ['recent_5xx', 'recent_exceptions'],
                'alerts',
            ])
            ->assertJsonPath('async_operations.queued', 1);

        $this->getJson('/api/system/async-operations')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $operation->id);

        $this->getJson('/api/system/async-operations/'.$operation->id)
            ->assertOk()
            ->assertJsonPath('data.id', $operation->id);

        $this->getJson('/api/system/master-data/consistency')
            ->assertOk()
            ->assertJsonStructure([
                'generated_at',
                'catalog',
                'checks',
                'coverage',
            ]);

        $this->getJson('/api/system/queue')
            ->assertOk()
            ->assertJsonStructure([
                'queue_connection',
                'supports_jobs_table',
                'supports_failed_jobs',
                'pending' => ['total', 'by_queue'],
                'failed' => ['total', 'recent'],
                'actions' => ['retry_single', 'retry_all', 'forget_single', 'flush_all'],
            ]);

        $this->getJson('/api/system/queue/failed')
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'total',
            ]);
    }
}
