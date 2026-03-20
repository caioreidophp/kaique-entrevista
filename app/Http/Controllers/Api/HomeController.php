<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Colaborador;
use App\Models\DriverInterview;
use App\Models\FeriasLancamento;
use App\Models\FreightEntry;
use App\Models\Pagamento;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class HomeController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $isMaster = $user->isMasterAdmin();
        $canViewInterviewsPanel = $user->hasPermission('sidebar.interviews.view');
        $canViewPayrollPanel = $user->hasPermission('sidebar.payroll.dashboard.view');
        $canViewVacationsPanel = $user->hasPermission('sidebar.vacations.dashboard.view');
        $canViewRegistryPanel = $user->hasPermission('sidebar.registry.collaborators.view');
        $canViewFreightPanel = $user->hasPermission('sidebar.freight.dashboard.view');
        $canViewOperationsPanel = $user->hasPermission('sidebar.operations-hub.view')
            && (bool) config('transport_features.operations_hub', true);

        $interviewsTotal = 0;

        if ($canViewInterviewsPanel) {
            $interviewsQuery = DriverInterview::query();

            if (! $isMaster) {
                $interviewsQuery->where('author_id', $user->id);
            }

            $interviewsTotal = (clone $interviewsQuery)->count();
        }

        $hasColaboradores = Schema::hasTable('colaboradores');
        $hasPagamentos = Schema::hasTable('pagamentos');
        $hasFreightEntries = Schema::hasTable('freight_entries');
        $hasFeriasLancamentos = Schema::hasTable('ferias_lancamentos');

        $colaboradoresAtivos = 0;
        $totalPagamentosMes = 0.0;
        $pagamentosLancadosMes = 0;
        $freightEntriesMes = 0;
        $freightTotalMes = 0.0;
        $feriasVencidas = 0;
        $feriasProximos2Meses = 0;

        if (($canViewRegistryPanel || $canViewVacationsPanel || $canViewOperationsPanel) && $hasColaboradores) {
            $colaboradoresAtivos = Colaborador::query()
                ->where('ativo', true)
                ->count();
        }

        if ($canViewPayrollPanel && $hasPagamentos) {
            $mesAtual = (int) now()->month;
            $anoAtual = (int) now()->year;

            $pagamentosQuery = Pagamento::query()
                ->where('competencia_mes', $mesAtual)
                ->where('competencia_ano', $anoAtual);

            if (! $isMaster) {
                $pagamentosQuery->where('autor_id', $user->id);
            }

            $pagamentosLancadosMes = (clone $pagamentosQuery)->count();
            $totalPagamentosMes = (float) ((clone $pagamentosQuery)->sum('valor'));
        }

        if ($canViewFreightPanel && $hasFreightEntries) {
            $mesAtual = (int) now()->month;
            $anoAtual = (int) now()->year;

            $freightQuery = FreightEntry::query()
                ->whereYear('data', $anoAtual)
                ->whereMonth('data', $mesAtual);

            if (! $isMaster) {
                $freightQuery->where('autor_id', $user->id);
            }

            $freightEntriesMes = (clone $freightQuery)->count();
            $freightTotalMes = (float) ((clone $freightQuery)->sum('frete_total'));
        }

        if (($canViewVacationsPanel || $canViewOperationsPanel) && $hasColaboradores && $hasFeriasLancamentos) {
            $activeCollaborators = Colaborador::query()
                ->where('ativo', true)
                ->whereNotNull('data_admissao')
                ->select(['id', 'data_admissao'])
                ->get();

            if ($activeCollaborators->isNotEmpty()) {
                $latestPeriodEndByCollaborator = FeriasLancamento::query()
                    ->whereIn('colaborador_id', $activeCollaborators->pluck('id')->all())
                    ->selectRaw('colaborador_id, MAX(periodo_aquisitivo_fim) as base_fim')
                    ->groupBy('colaborador_id')
                    ->pluck('base_fim', 'colaborador_id');

                $today = CarbonImmutable::today();
                $plus2Months = $today->addMonths(2);

                foreach ($activeCollaborators as $colaborador) {
                    $admissao = $colaborador->data_admissao?->toDateString();

                    if (! $admissao) {
                        continue;
                    }

                    $baseDate = (string) ($latestPeriodEndByCollaborator->get($colaborador->id) ?? $admissao);
                    $base = CarbonImmutable::parse($baseDate);
                    $direito = $base->addYear();
                    $limite = $direito->addMonths(11);

                    if ($limite->lt($today)) {
                        $feriasVencidas++;
                    }

                    if ($limite->betweenIncluded($today, $plus2Months)) {
                        $feriasProximos2Meses++;
                    }
                }
            }
        }

        $modules = [];

        if ($canViewInterviewsPanel) {
            $modules[] = [
                'key' => 'interviews',
                'title' => 'Entrevistas',
                'description' => 'Gestão de entrevistas e próximos passos de candidatos.',
                'href' => '/transport/interviews',
                'icon' => 'list-checks',
                'metrics' => [
                    'total_interviews' => $interviewsTotal,
                ],
            ];
        }

        if ($canViewPayrollPanel) {
            $modules[] = [
                'key' => 'payroll',
                'title' => 'Pagamentos',
                'description' => 'Lançamentos de pagamentos e relatórios por unidade e colaborador.',
                'href' => '/transport/payroll',
                'icon' => 'wallet',
                'metrics' => [
                    'payments_current_month' => $pagamentosLancadosMes,
                    'total_current_month' => $totalPagamentosMes,
                ],
            ];
        }

        if ($canViewVacationsPanel) {
            $modules[] = [
                'key' => 'vacations',
                'title' => 'Férias',
                'description' => 'Dashboard, lista e lançamento de férias por período aquisitivo.',
                'href' => '/transport/vacations/dashboard',
                'icon' => 'clipboard-check',
                'metrics' => [
                    'vacations_expired' => $feriasVencidas,
                    'vacations_due_2_months' => $feriasProximos2Meses,
                ],
            ];
        }

        if ($canViewRegistryPanel) {
            $modules[] = [
                'key' => 'registry',
                'title' => 'Cadastro',
                'description' => 'Cadastro de colaboradores, usuários e funções.',
                'href' => '/transport/registry/collaborators',
                'icon' => 'users',
                'metrics' => [
                    'active_collaborators' => $colaboradoresAtivos,
                ],
            ];
        }

        if ($canViewFreightPanel) {
            $modules[] = [
                'key' => 'freight',
                'title' => 'Gestão de Fretes',
                'description' => 'Lançamentos únicos e análises diárias/mensais de fretes por unidade.',
                'href' => '/transport/freight/dashboard',
                'icon' => 'truck',
                'metrics' => [
                    'freight_entries_current_month' => $freightEntriesMes,
                    'freight_total_current_month' => $freightTotalMes,
                ],
            ];
        }

        if ($canViewOperationsPanel) {
            $modules[] = [
                'key' => 'operations',
                'title' => 'Pendências',
                'description' => 'Central de pendências críticas para priorização diária.',
                'href' => '/transport/pendencias',
                'icon' => 'clipboard-check',
                'metrics' => [
                    'operations_pending_total' => $feriasVencidas + $feriasProximos2Meses,
                ],
            ];
        }

        return response()->json([
            'modules' => $modules,
        ]);
    }
}
