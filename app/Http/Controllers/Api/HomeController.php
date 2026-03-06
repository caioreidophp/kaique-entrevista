<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Colaborador;
use App\Models\DriverInterview;
use App\Models\FreightEntry;
use App\Models\Pagamento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class HomeController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $isMaster = $request->user()->isMasterAdmin();
        $isUsuario = $request->user()->isUsuario();

        $interviewsQuery = DriverInterview::query();

        if (! $isMaster) {
            $interviewsQuery->where('author_id', $request->user()->id);
        }

        $interviewsTotal = (clone $interviewsQuery)->count();

        $hasColaboradores = Schema::hasTable('colaboradores');
        $hasPagamentos = Schema::hasTable('pagamentos');
        $hasFreightEntries = Schema::hasTable('freight_entries');

        $colaboradoresAtivos = 0;
        $totalPagamentosMes = 0.0;
        $pagamentosLancadosMes = 0;
        $freightEntriesMes = 0;
        $freightTotalMes = 0.0;

        if ($hasColaboradores) {
            $colaboradoresAtivos = Colaborador::query()
                ->where('ativo', true)
                ->count();
        }

        if ($hasPagamentos) {
            $mesAtual = (int) now()->month;
            $anoAtual = (int) now()->year;

            $pagamentosQuery = Pagamento::query()
                ->where('competencia_mes', $mesAtual)
                ->where('competencia_ano', $anoAtual);

            if (! $isMaster) {
                $pagamentosQuery->where('autor_id', $request->user()->id);
            }

            $pagamentosLancadosMes = (clone $pagamentosQuery)->count();
            $totalPagamentosMes = (float) ((clone $pagamentosQuery)->sum('valor'));
        }

        if ($hasFreightEntries) {
            $mesAtual = (int) now()->month;
            $anoAtual = (int) now()->year;

            $freightQuery = FreightEntry::query()
                ->whereYear('data', $anoAtual)
                ->whereMonth('data', $mesAtual);

            if (! $isMaster) {
                $freightQuery->where('autor_id', $request->user()->id);
            }

            $freightEntriesMes = (clone $freightQuery)->count();
            $freightTotalMes = (float) ((clone $freightQuery)->sum('frete_total'));
        }

        $modules = [
            [
                'key' => 'interviews',
                'title' => 'Entrevistas',
                'description' => 'Gestão de entrevistas e próximos passos de candidatos.',
                'href' => '/transport/interviews',
                'icon' => 'list-checks',
                'metrics' => [
                    'total_interviews' => $interviewsTotal,
                ],
            ],
        ];

        if (! $isUsuario) {
            $modules[] = [
                'key' => 'payroll',
                'title' => 'Salários',
                'description' => 'Lançamentos de pagamentos e relatórios por unidade e colaborador.',
                'href' => '/transport/payroll',
                'icon' => 'wallet',
                'metrics' => [
                    'payments_current_month' => $pagamentosLancadosMes,
                    'total_current_month' => $totalPagamentosMes,
                ],
            ];

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

        return response()->json([
            'modules' => $modules,
        ]);
    }
}
