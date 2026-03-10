<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DriverInterview;
use Illuminate\Support\Facades\Cache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $cacheKey = sprintf(
            'transport:dashboard:%s:%d',
            $user->isMasterAdmin() ? 'master' : 'author',
            (int) $user->id,
        );

        $payload = Cache::remember($cacheKey, now()->addSeconds(45), function () use ($user): array {
            $baseQuery = DriverInterview::query();

            if (! $user->isMasterAdmin()) {
                $baseQuery->where('author_id', $user->id);
            }

            $totals = (clone $baseQuery)
                ->selectRaw('COUNT(*) as total_interviews')
                ->selectRaw("SUM(CASE WHEN hr_status = 'aprovado' THEN 1 ELSE 0 END) as total_approved")
                ->selectRaw("SUM(CASE WHEN hr_status = 'reprovado' THEN 1 ELSE 0 END) as total_reproved")
                ->selectRaw("SUM(CASE WHEN hr_status = 'aguardando_vaga' THEN 1 ELSE 0 END) as total_waiting_vacancy")
                ->selectRaw("SUM(CASE WHEN hr_status = 'teste_pratico' THEN 1 ELSE 0 END) as total_practical_test")
                ->selectRaw("SUM(CASE WHEN hr_status = 'guep' AND guep_status IN ('aguardando', 'a_fazer') THEN 1 ELSE 0 END) as guep_to_do")
                ->first();

            $totalInterviews = (int) ($totals?->total_interviews ?? 0);
            $totalApproved = (int) ($totals?->total_approved ?? 0);
            $totalReproved = (int) ($totals?->total_reproved ?? 0);
            $totalWaitingVacancy = (int) ($totals?->total_waiting_vacancy ?? 0);
            $totalPracticalTest = (int) ($totals?->total_practical_test ?? 0);
            $guepToDo = (int) ($totals?->guep_to_do ?? 0);

            $recentInterviews = (clone $baseQuery)
                ->select(['id', 'full_name', 'city', 'hr_status', 'guep_status', 'created_at', 'author_id'])
                ->with('author:id,name')
                ->latest('created_at')
                ->limit(5)
                ->get()
                ->map(fn (DriverInterview $item): array => [
                    'id' => $item->id,
                    'full_name' => $item->full_name,
                    'city' => $item->city,
                    'hr_status' => $item->hr_status?->value,
                    'guep_status' => $item->guep_status?->value,
                    'created_at' => $item->created_at?->toISOString(),
                    'author_name' => $item->author?->name,
                ])
                ->values();

            $recentActivity = (clone $baseQuery)
                ->select(['id', 'full_name', 'created_at', 'updated_at'])
                ->latest('updated_at')
                ->limit(6)
                ->get()
                ->map(fn (DriverInterview $item): array => [
                    'id' => $item->id,
                    'full_name' => $item->full_name,
                    'event' => $item->updated_at?->equalTo($item->created_at)
                        ? 'Entrevista criada'
                        : 'Entrevista atualizada',
                    'at' => $item->updated_at?->toISOString(),
                ])
                ->values();

            return [
                'total_interviews' => $totalInterviews,
                'total_approved' => $totalApproved,
                'total_reproved' => $totalReproved,
                'total_waiting_vacancy' => $totalWaitingVacancy,
                'total_practical_test' => $totalPracticalTest,
                'pending_actions' => [
                    'waiting_vacancy' => $totalWaitingVacancy,
                    'practical_test' => $totalPracticalTest,
                    'guep_to_do' => $guepToDo,
                    'total' => $totalWaitingVacancy + $totalPracticalTest + $guepToDo,
                ],
                'recent_interviews' => $recentInterviews,
                'recent_activity' => $recentActivity,
            ];
        });

        return response()->json($payload);
    }
}
