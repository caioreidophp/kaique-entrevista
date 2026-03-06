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
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        return response()->json([
            'data' => Unidade::query()->orderBy('nome')->get(),
        ]);
    }
}
