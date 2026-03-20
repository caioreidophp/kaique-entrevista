<?php

namespace Tests\Unit;

use App\Http\Requests\StoreFreightEntryRequest;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class StoreFreightEntryRequestTest extends TestCase
{
    public function test_with_validator_rejects_empty_trip_totals(): void
    {
        $request = StoreFreightEntryRequest::create('/api/freight/entries', 'POST', [
            'programado_viagens' => 0,
            'kaique_geral_viagens' => 0,
            'terceiros_viagens' => 0,
            'abatedouro_viagens' => 0,
            'canceladas_sem_escalar_viagens' => 0,
            'canceladas_escaladas_viagens' => 0,
        ]);

        $formRequest = new StoreFreightEntryRequest;
        $validator = Validator::make($request->all(), $formRequest->rules());
        $request->withValidator($validator);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('kaique_geral_viagens', $validator->errors()->toArray());
    }

    public function test_with_validator_rejects_km_over_daily_threshold(): void
    {
        $request = StoreFreightEntryRequest::create('/api/freight/entries', 'POST', [
            'programado_viagens' => 1,
            'kaique_geral_viagens' => 0,
            'terceiros_viagens' => 0,
            'abatedouro_viagens' => 0,
            'canceladas_sem_escalar_viagens' => 0,
            'canceladas_escaladas_viagens' => 0,
            'km_rodado' => 12000,
        ]);

        $formRequest = new StoreFreightEntryRequest;
        $validator = Validator::make($request->all(), $formRequest->rules());
        $request->withValidator($validator);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('km_rodado', $validator->errors()->toArray());
    }
}
