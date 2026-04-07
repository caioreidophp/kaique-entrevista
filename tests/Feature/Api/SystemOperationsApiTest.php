<?php

namespace Tests\Feature\Api;

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

        Sanctum::actingAs($admin);

        $this->getJson('/api/home')->assertOk();

        $this->getJson('/api/system/observability')
            ->assertOk()
            ->assertJsonStructure([
                'generated_at',
                'latency' => ['routes', 'slowest_p95_ms'],
                'http' => ['total_requests_window', 'http_2xx', 'http_4xx', 'http_5xx'],
                'errors' => ['recent_5xx', 'recent_exceptions'],
                'alerts',
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
