<?php

namespace App\Http\Controllers\Api\Registry;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMultaInfracaoRequest;
use App\Http\Requests\UpdateMultaInfracaoRequest;
use App\Models\MultaInfracao;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MultaInfracaoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $user?->hasPermission('registry.infractions.manage')
            || $user?->hasPermission('sidebar.registry.infractions.view'),
            403,
        );

        $query = MultaInfracao::query()->orderBy('nome');

        if ($request->filled('active')) {
            $query->where('ativo', $request->boolean('active'));
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    public function store(StoreMultaInfracaoRequest $request): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('registry.infractions.manage'), 403);

        $infracao = MultaInfracao::query()->create([
            ...$request->validated(),
            'ativo' => (bool) ($request->validated()['ativo'] ?? true),
        ]);

        return response()->json(['data' => $infracao], 201);
    }

    public function show(Request $request, MultaInfracao $infracaoMulta): JsonResponse
    {
        abort_unless(
            $request->user()?->hasPermission('registry.infractions.manage')
            || $request->user()?->hasPermission('sidebar.registry.infractions.view'),
            403,
        );

        return response()->json(['data' => $infracaoMulta]);
    }

    public function update(UpdateMultaInfracaoRequest $request, MultaInfracao $infracaoMulta): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('registry.infractions.manage'), 403);

        $infracaoMulta->update($request->validated());

        return response()->json(['data' => $infracaoMulta->refresh()]);
    }

    public function destroy(Request $request, MultaInfracao $infracaoMulta): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('registry.infractions.manage'), 403);

        if ($infracaoMulta->multas()->exists()) {
            return response()->json([
                'message' => 'Não é possível excluir infração com multas vinculadas.',
            ], 422);
        }

        $infracaoMulta->delete();

        return response()->json([], 204);
    }
}
