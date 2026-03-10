<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEmprestimoColaboradorRequest;
use App\Http\Requests\UpdateEmprestimoColaboradorRequest;
use App\Models\Colaborador;
use App\Models\EmprestimoColaborador;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayrollEmprestimoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $query = EmprestimoColaborador::query()
            ->with(['colaborador:id,nome', 'unidade:id,nome', 'autor:id,name'])
            ->latest('created_at');

        if ($request->filled('colaborador_id')) {
            $query->where('colaborador_id', (int) $request->integer('colaborador_id'));
        }

        return response()->json([
            'data' => $query->limit(300)->get(),
        ]);
    }

    public function store(StoreEmprestimoColaboradorRequest $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $data = $request->validated();
        $colaborador = Colaborador::query()->whereKey((int) $data['colaborador_id'])->firstOrFail();

        $emprestimo = EmprestimoColaborador::query()->create([
            ...$data,
            'unidade_id' => (int) $colaborador->unidade_id,
            'autor_id' => (int) $request->user()->id,
            'parcelas_pagas' => $data['parcelas_pagas'] ?? 0,
        ]);

        return response()->json([
            'data' => $emprestimo->load(['colaborador:id,nome', 'unidade:id,nome', 'autor:id,name']),
        ], 201);
    }

    public function update(UpdateEmprestimoColaboradorRequest $request, EmprestimoColaborador $emprestimo): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        if (! $request->user()?->isMasterAdmin() && $emprestimo->autor_id !== $request->user()->id) {
            abort(403);
        }

        $data = $request->validated();
        $colaborador = Colaborador::query()->whereKey((int) $data['colaborador_id'])->firstOrFail();

        $emprestimo->update([
            ...$data,
            'unidade_id' => (int) $colaborador->unidade_id,
            'parcelas_pagas' => $data['parcelas_pagas'] ?? 0,
        ]);

        return response()->json([
            'data' => $emprestimo->refresh()->load(['colaborador:id,nome', 'unidade:id,nome', 'autor:id,name']),
        ]);
    }

    public function destroy(Request $request, EmprestimoColaborador $emprestimo): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        if (! $request->user()?->isMasterAdmin() && $emprestimo->autor_id !== $request->user()->id) {
            abort(403);
        }

        $emprestimo->delete();

        return response()->json([], 204);
    }
}
