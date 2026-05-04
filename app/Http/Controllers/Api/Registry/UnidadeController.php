<?php

namespace App\Http\Controllers\Api\Registry;

use App\Http\Controllers\Controller;
use App\Models\Unidade;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UnidadeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $user?->isAdmin() || $user?->isMasterAdmin() || $user?->isUsuario(),
            403,
        );

        $validated = $request->validate([
            'active' => ['nullable', 'boolean'],
            'include_inactive' => ['nullable', 'boolean'],
        ]);

        $query = Unidade::query()->orderBy('nome');

        if ($user?->dataScopeFor('registry') === 'units') {
            $query->whereIn('id', $user->allowedUnitIdsFor('registry') ?: [0]);
        }

        $hasActiveFilter = array_key_exists('active', $validated);
        $includeInactive = (bool) ($validated['include_inactive'] ?? false);

        if ($hasActiveFilter) {
            $query->where('ativo', (bool) $validated['active']);
        } elseif (! $includeInactive) {
            $query->where('ativo', true);
        }

        return response()->json([
            'data' => $query
                ->get()
                ->map(fn (Unidade $unidade): array => [
                    'id' => (int) $unidade->id,
                    'nome' => (string) $unidade->nome,
                    'slug' => (string) $unidade->slug,
                    'ativo' => (bool) $unidade->ativo,
                ])
                ->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('registry.units.manage'), 403);

        $validated = $request->validate([
            'nome' => ['required', 'string', 'max:120', 'unique:unidades,nome'],
            'ativo' => ['nullable', 'boolean'],
        ]);

        $nome = trim((string) $validated['nome']);
        $slug = $this->resolveUniqueSlug($nome);

        $unidade = Unidade::query()->create([
            'nome' => $nome,
            'slug' => $slug,
            'ativo' => (bool) ($validated['ativo'] ?? true),
        ]);

        return response()->json([
            'data' => [
                'id' => (int) $unidade->id,
                'nome' => (string) $unidade->nome,
                'slug' => (string) $unidade->slug,
                'ativo' => (bool) $unidade->ativo,
            ],
        ], 201);
    }

    public function update(Request $request, Unidade $unidade): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('registry.units.manage'), 403);

        $validated = $request->validate([
            'nome' => [
                'required',
                'string',
                'max:120',
                Rule::unique('unidades', 'nome')->ignore($unidade->id),
            ],
            'ativo' => ['required', 'boolean'],
        ]);

        $nome = trim((string) $validated['nome']);
        $slug = $this->resolveUniqueSlug($nome, (int) $unidade->id);

        $unidade->update([
            'nome' => $nome,
            'slug' => $slug,
            'ativo' => (bool) $validated['ativo'],
        ]);

        return response()->json([
            'data' => [
                'id' => (int) $unidade->id,
                'nome' => (string) $unidade->nome,
                'slug' => (string) $unidade->slug,
                'ativo' => (bool) $unidade->ativo,
            ],
        ]);
    }

    private function resolveUniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name);
        $base = $base !== '' ? $base : 'unidade';
        $slug = $base;
        $suffix = 2;

        while ($this->slugExists($slug, $ignoreId)) {
            $slug = "{$base}-{$suffix}";
            $suffix++;
        }

        return $slug;
    }

    private function slugExists(string $slug, ?int $ignoreId = null): bool
    {
        $query = Unidade::query()->withTrashed()->where('slug', $slug);

        if ($ignoreId !== null) {
            $query->where('id', '!=', $ignoreId);
        }

        return $query->exists();
    }
}
