<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServiceAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ServiceAccountController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $accounts = ServiceAccount::query()
            ->with('createdBy:id,name,email')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $accounts,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'abilities' => ['nullable', 'array'],
            'abilities.*' => ['string', 'max:120'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $prefix = 'ska_'.Str::lower(Str::random(8));
        $secret = Str::random(48);
        $plainKey = $prefix.'.'.$secret;

        $account = ServiceAccount::query()->create([
            'name' => (string) $validated['name'],
            'key_prefix' => $prefix,
            'key_hash' => hash('sha256', $plainKey),
            'abilities' => $validated['abilities'] ?? ['*'],
            'is_active' => (bool) ($validated['is_active'] ?? true),
            'created_by_user_id' => (int) $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Service account criada com sucesso.',
            'data' => $account->load('createdBy:id,name,email'),
            'plain_key' => $plainKey,
        ], 201);
    }

    public function update(Request $request, ServiceAccount $serviceAccount): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'abilities' => ['nullable', 'array'],
            'abilities.*' => ['string', 'max:120'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $serviceAccount->update([
            'name' => array_key_exists('name', $validated) ? (string) $validated['name'] : $serviceAccount->name,
            'abilities' => $validated['abilities'] ?? $serviceAccount->abilities,
            'is_active' => array_key_exists('is_active', $validated)
                ? (bool) $validated['is_active']
                : (bool) $serviceAccount->is_active,
            'revoked_at' => array_key_exists('is_active', $validated) && (bool) $validated['is_active'] === false
                ? now()
                : $serviceAccount->revoked_at,
        ]);

        return response()->json([
            'message' => 'Service account atualizada.',
            'data' => $serviceAccount->refresh()->load('createdBy:id,name,email'),
        ]);
    }

    public function rotate(Request $request, ServiceAccount $serviceAccount): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $prefix = 'ska_'.Str::lower(Str::random(8));
        $secret = Str::random(48);
        $plainKey = $prefix.'.'.$secret;

        $serviceAccount->update([
            'key_prefix' => $prefix,
            'key_hash' => hash('sha256', $plainKey),
            'rotated_at' => now(),
            'revoked_at' => null,
            'is_active' => true,
        ]);

        return response()->json([
            'message' => 'Chave rotacionada com sucesso.',
            'data' => $serviceAccount->refresh()->load('createdBy:id,name,email'),
            'plain_key' => $plainKey,
        ]);
    }

    public function destroy(Request $request, ServiceAccount $serviceAccount): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $serviceAccount->update([
            'is_active' => false,
            'revoked_at' => now(),
        ]);

        return response()->json([
            'message' => 'Service account revogada com sucesso.',
        ]);
    }
}
