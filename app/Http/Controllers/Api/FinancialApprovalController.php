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

        $perPage = min(max((int) $request->integer('per_page', 20), 1), 100);

        $query = FinancialApproval::query()
            ->with([
                'requester:id,name,email,role',
                'approver:id,name,email,role',
            ])
            ->orderByDesc('id');

        if ($request->filled('status')) {
            $query->where('status', (string) $request->string('status'));
        }

        if ($request->filled('action_key')) {
            $query->where('action_key', (string) $request->string('action_key'));
        }

        if ($request->filled('unidade_id')) {
            $unidadeId = (int) $request->integer('unidade_id');
            $query->where('summary->unidade_id', $unidadeId);
        }

        $paginated = $query->paginate($perPage)->withQueryString();

        $allVisible = FinancialApproval::query()->get(['id', 'status', 'summary', 'expires_at', 'reviewed_at', 'created_at']);

        return response()->json([
            'data' => collect($paginated->items())->map(function (FinancialApproval $approval): array {
                $summary = is_array($approval->summary) ? $approval->summary : [];
                $totalValor = round((float) ($summary['total_valor'] ?? 0), 2);
                $totalColaboradores = (int) ($summary['total_colaboradores'] ?? 0);
                $expiresSoon = $approval->expires_at?->between(now(), now()->addHour()) ?? false;

                return [
                    'id' => $approval->id,
                    'request_uuid' => $approval->request_uuid,
                    'action_key' => $approval->action_key,
                    'status' => $approval->status,
                    'summary' => $summary,
                    'requester' => $approval->requester,
                    'approver' => $approval->approver,
                    'reason' => $approval->reason,
                    'required_approvals' => (int) ($approval->required_approvals ?? 1),
                    'approved_steps' => (int) ($approval->approved_steps ?? 0),
                    'approval_history' => $approval->approval_history ?? [],
                    'reviewed_at' => $approval->reviewed_at?->toISOString(),
                    'expires_at' => $approval->expires_at?->toISOString(),
                    'created_at' => $approval->created_at?->toISOString(),
                    'priority' => $totalValor >= 50000 || $totalColaboradores >= 50 ? 'high' : ($totalValor >= 15000 || $totalColaboradores >= 25 ? 'medium' : 'normal'),
                    'expires_soon' => $expiresSoon,
                ];
            })->values(),
            'summary' => [
                'total' => $allVisible->count(),
                'pending' => $allVisible->where('status', 'pending')->count(),
                'approved' => $allVisible->where('status', 'approved')->count(),
                'rejected' => $allVisible->where('status', 'rejected')->count(),
                'consumed' => $allVisible->where('status', 'consumed')->count(),
                'expires_soon' => $allVisible->filter(
                    fn (FinancialApproval $approval): bool => $approval->status === 'pending'
                        && $approval->expires_at !== null
                        && $approval->expires_at->between(now(), now()->addHour()),
                )->count(),
            ],
            'current_page' => $paginated->currentPage(),
            'last_page' => $paginated->lastPage(),
            'per_page' => $paginated->perPage(),
            'total' => $paginated->total(),
        ]);
    }

    public function approve(
        Request $request,
        FinancialApproval $financialApproval,
        FinancialApprovalService $service,
    ): JsonResponse {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        abort_if($financialApproval->requester_id === (int) $request->user()->id, 422, 'Aprovacao pelo proprio solicitante nao e permitida.');
        abort_if($financialApproval->status !== 'pending', 422, 'Aprovacao ja foi processada anteriormente.');

        $alreadyApproved = collect((array) ($financialApproval->approval_history ?? []))
            ->contains(fn ($step): bool => is_array($step) && (int) ($step['approver_id'] ?? 0) === (int) $request->user()->id);
        abort_if($alreadyApproved, 422, 'Este aprovador ja registrou uma etapa para esta solicitacao.');

        $approved = $service->approve($financialApproval, $request->user());
        $isFinal = $approved->status === 'approved';

        return response()->json([
            'message' => $isFinal
                ? 'Solicitacao aprovada com sucesso.'
                : 'Etapa aprovada. Aguardando proxima aprovacao.',
            'data' => $approved,
            'execution_token' => $isFinal ? $approved->execution_token : null,
            'token_expires_at' => $isFinal ? $approved->token_expires_at?->toISOString() : null,
            'required_approvals' => (int) ($approved->required_approvals ?? 1),
            'approved_steps' => (int) ($approved->approved_steps ?? 0),
            'pending_steps' => max((int) ($approved->required_approvals ?? 1) - (int) ($approved->approved_steps ?? 0), 0),
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

        abort_if($financialApproval->status !== 'pending', 422, 'Aprovacao ja foi processada anteriormente.');

        $rejected = $service->reject($financialApproval, $request->user(), $validated['reason'] ?? null);

        return response()->json([
            'message' => 'Solicitacao rejeitada.',
            'data' => $rejected,
        ]);
    }
}
