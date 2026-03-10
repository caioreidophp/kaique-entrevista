<?php

namespace App\Http\Controllers\Api\Registry;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTipoPagamentoRequest;
use App\Http\Requests\UpdateTipoPagamentoRequest;
use App\Models\TipoPagamento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TipoPagamentoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        return response()->json([
            'data' => TipoPagamento::query()->orderBy('nome')->get(),
        ]);
    }

    public function store(StoreTipoPagamentoRequest $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $tipoPagamento = TipoPagamento::query()->create($request->validated());

        return response()->json(['data' => $tipoPagamento], 201);
    }

    public function show(Request $request, TipoPagamento $tipoPagamento): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        return response()->json(['data' => $tipoPagamento]);
    }

    public function update(UpdateTipoPagamentoRequest $request, TipoPagamento $tipoPagamento): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $tipoPagamento->update($request->validated());

        return response()->json(['data' => $tipoPagamento->refresh()]);
    }

    public function destroy(Request $request, TipoPagamento $tipoPagamento): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $tipoPagamento->delete();

        return response()->json([], 204);
    }
}
