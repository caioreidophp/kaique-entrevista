<?php

namespace Tests\Feature\Api;

use App\Models\Unidade;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class IdempotencyApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_freight_store_replays_response_when_idempotency_key_is_reused(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $unidade = Unidade::query()->create(['nome' => 'Amparo', 'slug' => 'amparo']);

        Sanctum::actingAs($admin);

        $payload = [
            'data' => '2026-04-01',
            'unidade_id' => $unidade->id,
            'frete_total' => 15000,
            'cargas' => 15,
            'aves' => 2400,
            'veiculos' => 5,
            'km_rodado' => 12000,
            'frete_terceiros' => 1200,
            'viagens_terceiros' => 2,
            'aves_terceiros' => 180,
        ];

        $idempotencyKey = 'idem-freight-20260401';

        $firstResponse = $this
            ->withHeaders(['Idempotency-Key' => $idempotencyKey])
            ->postJson('/api/freight/entries', $payload)
            ->assertCreated()
            ->assertHeader('Idempotency-Replayed', 'false');

        $firstId = (int) $firstResponse->json('data.id');

        $secondResponse = $this
            ->withHeaders(['Idempotency-Key' => $idempotencyKey])
            ->postJson('/api/freight/entries', $payload)
            ->assertCreated()
            ->assertHeader('Idempotency-Replayed', 'true');

        $secondId = (int) $secondResponse->json('data.id');

        $this->assertSame($firstId, $secondId);
        $this->assertDatabaseCount('freight_entries', 1);
    }
}
