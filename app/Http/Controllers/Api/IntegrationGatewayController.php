<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServiceAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IntegrationGatewayController extends Controller
{
    public function me(Request $request): JsonResponse
    {
        /** @var ServiceAccount|null $account */
        $account = $request->attributes->get('service_account');

        abort_unless($account, 401, 'Service account inválida.');

        return response()->json([
            'service_account' => [
                'id' => (int) $account->id,
                'name' => (string) $account->name,
                'key_prefix' => (string) $account->key_prefix,
                'abilities' => is_array($account->abilities) ? $account->abilities : ['*'],
                'is_active' => (bool) $account->is_active,
                'last_used_at' => $account->last_used_at?->toISOString(),
            ],
            'server_time' => now()->toISOString(),
        ]);
    }
}
