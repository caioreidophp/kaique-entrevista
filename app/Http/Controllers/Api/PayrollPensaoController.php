<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePensaoColaboradorRequest;
use App\Http\Requests\UpdatePensaoColaboradorRequest;
use App\Models\Colaborador;
use App\Models\PensaoColaborador;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayrollPensaoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $query = PensaoColaborador::query()
            ->with(['colaborador:id,nome', 'unidade:id,nome', 'autor:id,name'])
            ->latest('created_at');

        if ($request->filled('colaborador_id')) {
            $query->where('colaborador_id', (int) $request->integer('colaborador_id'));
        }

        if ($request->filled('ativo')) {
            $query->where('ativo', (bool) $request->boolean('ativo'));
        }

        return response()->json([
            'data' => $query->limit(400)->get(),
        ]);
    }

    public function store(StorePensaoColaboradorRequest $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $data = $request->validated();
        $colaborador = Colaborador::query()->whereKey((int) $data['colaborador_id'])->firstOrFail();

        $pensao = PensaoColaborador::query()->create([
            ...$data,
            'valor' => (float) ($data['valor'] ?? 0),
            'unidade_id' => (int) $colaborador->unidade_id,
            'autor_id' => (int) $request->user()->id,
            'ativo' => array_key_exists('ativo', $data) ? (bool) $data['ativo'] : true,
        ]);

        return response()->json([
            'data' => $pensao->load(['colaborador:id,nome', 'unidade:id,nome', 'autor:id,name']),
        ], 201);
    }

    public function update(UpdatePensaoColaboradorRequest $request, PensaoColaborador $pensao): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        if (! $request->user()?->isMasterAdmin() && $pensao->autor_id !== $request->user()->id) {
            abort(403);
        }

        $data = $request->validated();
        $colaborador = Colaborador::query()->whereKey((int) $data['colaborador_id'])->firstOrFail();

        $pensao->update([
            ...$data,
            'valor' => (float) ($data['valor'] ?? $pensao->valor ?? 0),
            'unidade_id' => (int) $colaborador->unidade_id,
        ]);

        return response()->json([
            'data' => $pensao->refresh()->load(['colaborador:id,nome', 'unidade:id,nome', 'autor:id,name']),
        ]);
    }

    public function destroy(Request $request, PensaoColaborador $pensao): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        if (! $request->user()?->isMasterAdmin() && $pensao->autor_id !== $request->user()->id) {
            abort(403);
        }

        $pensao->delete();

        return response()->json([], 204);
    }
}
