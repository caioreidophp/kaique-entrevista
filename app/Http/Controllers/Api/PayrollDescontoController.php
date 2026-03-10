<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDescontoColaboradorRequest;
use App\Http\Requests\UpdateDescontoColaboradorRequest;
use App\Models\Colaborador;
use App\Models\DescontoColaborador;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayrollDescontoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $query = DescontoColaborador::query()
            ->with(['colaborador:id,nome', 'unidade:id,nome', 'autor:id,name'])
            ->latest('created_at');

        if ($request->filled('colaborador_id')) {
            $query->where('colaborador_id', (int) $request->integer('colaborador_id'));
        }

        return response()->json([
            'data' => $query->limit(300)->get(),
        ]);
    }

    public function store(StoreDescontoColaboradorRequest $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $data = $request->validated();
        $colaborador = Colaborador::query()->whereKey((int) $data['colaborador_id'])->firstOrFail();

        $desconto = DescontoColaborador::query()->create([
            ...$data,
            'unidade_id' => (int) $colaborador->unidade_id,
            'autor_id' => (int) $request->user()->id,
            'total_parcelas' => ($data['parcelado'] ?? false) ? ($data['total_parcelas'] ?? null) : null,
            'parcela_atual' => ($data['parcelado'] ?? false) ? ($data['parcela_atual'] ?? 1) : null,
        ]);

        return response()->json([
            'data' => $desconto->load(['colaborador:id,nome', 'unidade:id,nome', 'autor:id,name']),
        ], 201);
    }

    public function update(UpdateDescontoColaboradorRequest $request, DescontoColaborador $desconto): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        if (! $request->user()?->isMasterAdmin() && $desconto->autor_id !== $request->user()->id) {
            abort(403);
        }

        $data = $request->validated();
        $colaborador = Colaborador::query()->whereKey((int) $data['colaborador_id'])->firstOrFail();

        $desconto->update([
            ...$data,
            'unidade_id' => (int) $colaborador->unidade_id,
            'total_parcelas' => ($data['parcelado'] ?? false) ? ($data['total_parcelas'] ?? null) : null,
            'parcela_atual' => ($data['parcelado'] ?? false) ? ($data['parcela_atual'] ?? 1) : null,
        ]);

        return response()->json([
            'data' => $desconto->refresh()->load(['colaborador:id,nome', 'unidade:id,nome', 'autor:id,name']),
        ]);
    }

    public function destroy(Request $request, DescontoColaborador $desconto): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        if (! $request->user()?->isMasterAdmin() && $desconto->autor_id !== $request->user()->id) {
            abort(403);
        }

        $desconto->delete();

        return response()->json([], 204);
    }
}
