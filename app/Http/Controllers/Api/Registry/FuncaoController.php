<?php

namespace App\Http\Controllers\Api\Registry;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFuncaoRequest;
use App\Http\Requests\UpdateFuncaoRequest;
use App\Models\Funcao;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FuncaoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user?->isAdmin() || $user?->isMasterAdmin(), 403);

        $query = Funcao::query()->orderBy('nome');

        if ($request->filled('active')) {
            $query->where('ativo', $request->boolean('active'));
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    public function store(StoreFuncaoRequest $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $funcao = Funcao::query()->create([
            ...$request->validated(),
            'ativo' => (bool) ($request->validated()['ativo'] ?? true),
        ]);

        return response()->json(['data' => $funcao], 201);
    }

    public function show(Request $request, Funcao $funcao): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        return response()->json(['data' => $funcao]);
    }

    public function update(UpdateFuncaoRequest $request, Funcao $funcao): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $funcao->update($request->validated());

        return response()->json(['data' => $funcao->refresh()]);
    }

    public function destroy(Request $request, Funcao $funcao): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        if ($funcao->colaboradores()->exists()) {
            return response()->json([
                'message' => 'Não é possível excluir função com colaboradores vinculados.',
            ], 422);
        }

        $funcao->delete();

        return response()->json([], 204);
    }
}
