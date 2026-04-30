<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserQuickAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuickAccessController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = UserQuickAccess::query()
            ->where('user_id', (int) $request->user()->id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $rows,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'shortcut_key' => ['required', 'string', 'max:120'],
            'label' => ['required', 'string', 'max:180'],
            'href' => ['required', 'string', 'max:255'],
            'icon' => ['nullable', 'string', 'max:80'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $row = UserQuickAccess::query()->updateOrCreate(
            [
                'user_id' => (int) $request->user()->id,
                'shortcut_key' => trim((string) $validated['shortcut_key']),
            ],
            [
                'label' => trim((string) $validated['label']),
                'href' => trim((string) $validated['href']),
                'icon' => isset($validated['icon']) ? trim((string) $validated['icon']) : null,
                'sort_order' => (int) ($validated['sort_order'] ?? 0),
                'is_active' => (bool) ($validated['is_active'] ?? true),
            ],
        );

        return response()->json([
            'message' => 'Atalho salvo com sucesso.',
            'data' => $row,
        ], 201);
    }

    public function update(Request $request, UserQuickAccess $userQuickAccess): JsonResponse
    {
        abort_unless((int) $userQuickAccess->user_id === (int) $request->user()->id, 403);

        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:180'],
            'href' => ['nullable', 'string', 'max:255'],
            'icon' => ['nullable', 'string', 'max:80'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $payload = [];

        foreach (['label', 'href', 'icon', 'sort_order', 'is_active'] as $field) {
            if (! array_key_exists($field, $validated)) {
                continue;
            }

            $value = $validated[$field];

            if (in_array($field, ['label', 'href', 'icon'], true) && is_string($value)) {
                $payload[$field] = trim($value);
                continue;
            }

            $payload[$field] = $value;
        }

        $userQuickAccess->update($payload);

        return response()->json([
            'message' => 'Atalho atualizado com sucesso.',
            'data' => $userQuickAccess->refresh(),
        ]);
    }

    public function destroy(Request $request, UserQuickAccess $userQuickAccess): JsonResponse
    {
        abort_unless((int) $userQuickAccess->user_id === (int) $request->user()->id, 403);

        $userQuickAccess->delete();

        return response()->json([], 204);
    }
}

