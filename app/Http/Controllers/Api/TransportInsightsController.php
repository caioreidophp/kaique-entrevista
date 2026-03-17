<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Colaborador;
use App\Models\DriverInterview;
use App\Models\FeriasLancamento;
use App\Models\FreightCanceledLoad;
use App\Models\FreightEntry;
use App\Models\FreightSpotEntry;
use App\Models\Pagamento;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransportInsightsController extends Controller
{
    public function pending(Request $request): JsonResponse
    {
        $user = $request->user();
        $isMaster = $user->isMasterAdmin();

        $baseInterviews = DriverInterview::query();

        if (! $isMaster) {
            $baseInterviews->where('author_id', $user->id);
        }

        $waitingVacancy = (clone $baseInterviews)
            ->where('hr_status', 'aguardando_vaga')
            ->count();

        $practicalTest = (clone $baseInterviews)
            ->where('hr_status', 'teste_pratico')
            ->count();

        $guepToDo = (clone $baseInterviews)
            ->where('hr_status', 'guep')
            ->whereIn('guep_status', ['aguardando', 'a_fazer'])
            ->count();

        $today = CarbonImmutable::today();
        $plus2Months = $today->addMonths(2);

        $activeCollaborators = Colaborador::query()
            ->where('ativo', true)
            ->whereNotNull('data_admissao')
            ->select(['id', 'data_admissao'])
            ->get();

        $latestPeriodEndByCollaborator = FeriasLancamento::query()
            ->whereIn('colaborador_id', $activeCollaborators->pluck('id')->all())
            ->selectRaw('colaborador_id, MAX(periodo_aquisitivo_fim) as base_fim')
            ->groupBy('colaborador_id')
            ->pluck('base_fim', 'colaborador_id');

        $vacationsExpired = 0;
        $vacationsDue2Months = 0;

        foreach ($activeCollaborators as $colaborador) {
            $admissao = $colaborador->data_admissao?->toDateString();

            if (! $admissao) {
                continue;
            }

            $baseDate = (string) ($latestPeriodEndByCollaborator->get($colaborador->id) ?? $admissao);
            $limite = CarbonImmutable::parse($baseDate)->addYear()->addMonths(11);

            if ($limite->lt($today)) {
                $vacationsExpired++;
            }

            if ($limite->betweenIncluded($today, $plus2Months)) {
                $vacationsDue2Months++;
            }
        }

        $canceledLoadsToReceive = FreightCanceledLoad::query()
            ->when(! $isMaster, fn ($query) => $query->where('autor_id', $user->id))
            ->where('status', 'a_receber')
            ->count();

        $month = now()->month;
        $year = now()->year;

        $launchedPayrollCollaborators = Pagamento::query()
            ->when(! $isMaster, fn ($query) => $query->where('autor_id', $user->id))
            ->where('competencia_mes', $month)
            ->where('competencia_ano', $year)
            ->distinct('colaborador_id')
            ->count('colaborador_id');

        $activeCollaboratorsCount = Colaborador::query()->where('ativo', true)->count();
        $payrollPendingCollaborators = max($activeCollaboratorsCount - $launchedPayrollCollaborators, 0);

        return response()->json([
            'data' => [
                'interviews' => [
                    'waiting_vacancy' => $waitingVacancy,
                    'practical_test' => $practicalTest,
                    'guep_to_do' => $guepToDo,
                    'total' => $waitingVacancy + $practicalTest + $guepToDo,
                ],
                'vacations' => [
                    'expired' => $vacationsExpired,
                    'due_2_months' => $vacationsDue2Months,
                ],
                'freight' => [
                    'canceled_to_receive' => $canceledLoadsToReceive,
                ],
                'payroll' => [
                    'pending_collaborators' => $payrollPendingCollaborators,
                ],
            ],
        ]);
    }

    public function executive(Request $request): JsonResponse
    {
        $user = $request->user();
        $isMaster = $user->isMasterAdmin();

        $month = now()->month;
        $year = now()->year;

        $interviewsBase = DriverInterview::query();
        $payrollBase = Pagamento::query()
            ->where('competencia_mes', $month)
            ->where('competencia_ano', $year);
        $freightBase = FreightEntry::query()
            ->whereYear('data', $year)
            ->whereMonth('data', $month);
        $spotBase = FreightSpotEntry::query()
            ->whereYear('data', $year)
            ->whereMonth('data', $month);

        if (! $isMaster) {
            $interviewsBase->where('author_id', $user->id);
            $payrollBase->where('autor_id', $user->id);
            $freightBase->where('autor_id', $user->id);
            $spotBase->where('autor_id', $user->id);
        }

        $totalInterviews = (clone $interviewsBase)->count();
        $approvedInterviews = (clone $interviewsBase)
            ->where('hr_status', 'aprovado')
            ->count();
        $approvalRate = $totalInterviews > 0
            ? round(($approvedInterviews / $totalInterviews) * 100, 2)
            : 0.0;

        $totalPayroll = (float) (clone $payrollBase)->sum('valor');
        $totalPayrollLaunches = (clone $payrollBase)->count();
        $activeCollaborators = Colaborador::query()->where('ativo', true)->count();
        $coverageRate = $activeCollaborators > 0
            ? round((($totalPayrollLaunches / $activeCollaborators) * 100), 2)
            : 0.0;

        $freightTotal = (float) (clone $freightBase)->sum('frete_total');
        $freightEntries = (clone $freightBase)->count();
        $freightSpotTotal = (float) (clone $spotBase)->sum('frete_spot');
        $freightSpotShare = ($freightTotal + $freightSpotTotal) > 0
            ? round(($freightSpotTotal / ($freightTotal + $freightSpotTotal)) * 100, 2)
            : 0.0;

        $alerts = [];

        if ($coverageRate < 95) {
            $alerts[] = [
                'level' => 'warning',
                'title' => 'Cobertura da folha abaixo da meta',
                'detail' => "Cobertura atual {$coverageRate}% (meta 95%).",
            ];
        }

        if ($freightSpotShare > 35) {
            $alerts[] = [
                'level' => 'warning',
                'title' => 'Dependência alta de frete spot',
                'detail' => "Participação spot em {$freightSpotShare}% no mês.",
            ];
        }

        if ($approvalRate < 40 && $totalInterviews >= 10) {
            $alerts[] = [
                'level' => 'info',
                'title' => 'Taxa de aprovação baixa',
                'detail' => "Aprovação em entrevistas está em {$approvalRate}%.",
            ];
        }

        return response()->json([
            'data' => [
                'competencia_mes' => $month,
                'competencia_ano' => $year,
                'interviews' => [
                    'total' => $totalInterviews,
                    'approved' => $approvedInterviews,
                    'approval_rate' => $approvalRate,
                ],
                'payroll' => [
                    'total' => $totalPayroll,
                    'launches' => $totalPayrollLaunches,
                    'coverage_rate' => $coverageRate,
                ],
                'freight' => [
                    'entries' => $freightEntries,
                    'total' => $freightTotal,
                    'spot_total' => $freightSpotTotal,
                    'spot_share' => $freightSpotShare,
                ],
                'alerts' => $alerts,
            ],
        ]);
    }
}
