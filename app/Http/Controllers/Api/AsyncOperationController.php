<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AsyncOperation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AsyncOperationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $rows = AsyncOperation::query()
            ->when(
                ! $request->user()?->isMasterAdmin(),
                fn ($query) => $query->where('user_id', (int) $request->user()->id),
            )
            ->latest('created_at')
            ->limit(50)
            ->get();

        return response()->json([
            'data' => $rows,
        ]);
    }

    public function show(Request $request, string $asyncOperation): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $row = AsyncOperation::query()
            ->whereKey($asyncOperation)
            ->when(
                ! $request->user()?->isMasterAdmin(),
                fn ($query) => $query->where('user_id', (int) $request->user()->id),
            )
            ->firstOrFail();

        return response()->json([
            'data' => $row,
        ]);
    }
}
