<?php

namespace App\Http\Controllers\Api\Registry;

use App\Http\Controllers\Controller;
use App\Models\Unidade;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UnidadeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $user?->isAdmin() || $user?->isMasterAdmin() || $user?->isUsuario(),
            403,
        );

        return response()->json([
            'data' => Unidade::query()->orderBy('nome')->get(),
        ]);
    }
}
