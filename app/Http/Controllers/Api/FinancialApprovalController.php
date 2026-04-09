<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FinancialApproval;
use App\Support\FinancialApprovalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinancialApprovalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $rows = FinancialApproval::query()
            ->with([
                'requester:id,name,email,role',
                'approver:id,name,email,role',
            ])
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        return response()->json([
            'data' => $rows,
        ]);
    }

    public function approve(
        Request $request,
        FinancialApproval $financialApproval,
        FinancialApprovalService $service,
    ): JsonResponse {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        abort_if($financialApproval->requester_id === (int) $request->user()->id, 422, 'Aprovação pelo próprio solicitante não é permitida.');
        abort_if($financialApproval->status !== 'pending', 422, 'Aprovação já foi processada anteriormente.');

        $approved = $service->approve($financialApproval, $request->user());

        return response()->json([
            'message' => 'Solicitação aprovada com sucesso.',
            'data' => $approved,
            'execution_token' => $approved->execution_token,
            'token_expires_at' => $approved->token_expires_at?->toISOString(),
        ]);
    }

    public function reject(
        Request $request,
        FinancialApproval $financialApproval,
        FinancialApprovalService $service,
    ): JsonResponse {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        abort_if($financialApproval->status !== 'pending', 422, 'Aprovação já foi processada anteriormente.');

        $rejected = $service->reject($financialApproval, $request->user(), $validated['reason'] ?? null);

        return response()->json([
            'message' => 'Solicitação rejeitada.',
            'data' => $rejected,
        ]);
    }
}
