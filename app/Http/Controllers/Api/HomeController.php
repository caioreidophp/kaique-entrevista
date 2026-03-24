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
use Illuminate\Support\Facades\Cache;
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

        $cacheFingerprint = [
            'user_id' => (int) $user->id,
            'permissions_version' => (int) Cache::get('transport:permissions-version', 1),
            'is_master' => (bool) $isMaster,
            'interviews' => (bool) $canViewInterviewsPanel,
            'payroll' => (bool) $canViewPayrollPanel,
            'vacations' => (bool) $canViewVacationsPanel,
            'registry' => (bool) $canViewRegistryPanel,
            'freight' => (bool) $canViewFreightPanel,
            'operations' => (bool) $canViewOperationsPanel,
            'month' => (int) now()->month,
            'year' => (int) now()->year,
        ];
        $cacheKey = 'transport:home:v3:'.sha1(json_encode($cacheFingerprint));
        $cachedPayload = Cache::get($cacheKey);

        if (is_array($cachedPayload)) {
            return response()->json($cachedPayload);
        }

        $interviewsTotal = 0;

        if ($canViewInterviewsPanel) {
            $interviewsQuery = DriverInterview::query();

            if (! $isMaster) {
                $interviewsQuery->where('author_id', $user->id);
            }

            $interviewsTotal = (clone $interviewsQuery)->count();
        }

        $tablePresence = Cache::remember('transport:home:table-presence:v1', now()->addMinutes(30), function (): array {
            return [
                'colaboradores' => Schema::hasTable('colaboradores'),
                'pagamentos' => Schema::hasTable('pagamentos'),
                'freight_entries' => Schema::hasTable('freight_entries'),
                'ferias_lancamentos' => Schema::hasTable('ferias_lancamentos'),
            ];
        });

        $hasColaboradores = (bool) ($tablePresence['colaboradores'] ?? false);
        $hasPagamentos = (bool) ($tablePresence['pagamentos'] ?? false);
        $hasFreightEntries = (bool) ($tablePresence['freight_entries'] ?? false);
        $hasFeriasLancamentos = (bool) ($tablePresence['ferias_lancamentos'] ?? false);

        $colaboradoresAtivos = 0;
        $totalPagamentosMes = 0.0;
        $pagamentosLancadosMes = 0;
        $pagamentosPendentesMes = 0;
        $pagamentosCoberturaMes = 0.0;
        $freightEntriesMes = 0;
        $freightTotalMes = 0.0;
        $freightTotalTerceirosMes = 0.0;
        $freightKmMes = 0.0;
        $feriasVencidas = 0;
        $feriasProximos2Meses = 0;
        $feriasProximos4Meses = 0;
        $taxaFeriasVencidas = 0.0;

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
            $pagamentosPendentesMes = max(0, $colaboradoresAtivos - $pagamentosLancadosMes);
            $pagamentosCoberturaMes = $colaboradoresAtivos > 0
                ? round(($pagamentosLancadosMes / $colaboradoresAtivos) * 100, 2)
                : 0.0;
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
            $freightTotalTerceirosMes = (float) ((clone $freightQuery)->sum('frete_terceiros'));
            $freightKmMes = (float) ((clone $freightQuery)->sum('km_rodado'));
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

                    if ($limite->betweenIncluded($today, $today->addMonths(4))) {
                        $feriasProximos4Meses++;
                    }
                }

                $taxaFeriasVencidas = $activeCollaborators->count() > 0
                    ? round(($feriasVencidas / $activeCollaborators->count()) * 100, 2)
                    : 0.0;
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
                    'payments_pending_current_month' => $pagamentosPendentesMes,
                    'payments_coverage_current_month' => $pagamentosCoberturaMes,
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
                    'vacations_due_4_months' => $feriasProximos4Meses,
                    'vacations_expired_rate' => $taxaFeriasVencidas,
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
                    'freight_avg_km_current_month' => $freightKmMes > 0
                        ? round($freightTotalMes / $freightKmMes, 2)
                        : 0.0,
                    'freight_third_share_current_month' => $freightTotalMes > 0
                        ? round(($freightTotalTerceirosMes / $freightTotalMes) * 100, 2)
                        : 0.0,
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

        $payload = [
            'modules' => $modules,
        ];

        Cache::put($cacheKey, $payload, now()->addSeconds(45));

        return response()->json($payload);
    }
}
