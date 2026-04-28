<?php

namespace App\Support;

use App\Models\Aviario;
use App\Models\Colaborador;
use App\Models\Funcao;
use App\Models\Pagamento;
use App\Models\PlacaFrota;
use App\Models\TipoPagamento;
use App\Models\Unidade;
use App\Models\User;

class MasterDataConsistencyService
{
    /**
     * @return array<string, mixed>
     */
    public function snapshot(): array
    {
        $units = Unidade::query()->count();
        $functions = Funcao::query()->count();
        $paymentTypes = TipoPagamento::query()->count();

        return [
            'generated_at' => now()->toIso8601String(),
            'catalog' => [
                'unidades' => $units,
                'funcoes' => $functions,
                'tipos_pagamento' => $paymentTypes,
                'placas_frota' => PlacaFrota::query()->count(),
                'aviarios' => Aviario::query()->count(),
            ],
            'checks' => [
                [
                    'code' => 'colaboradores_sem_unidade',
                    'severity' => 'critical',
                    'count' => Colaborador::query()->whereNull('unidade_id')->count(),
                    'message' => 'Colaboradores sem unidade vinculada.',
                ],
                [
                    'code' => 'colaboradores_sem_funcao',
                    'severity' => 'warning',
                    'count' => Colaborador::query()->whereNull('funcao_id')->count(),
                    'message' => 'Colaboradores sem função vinculada.',
                ],
                [
                    'code' => 'pagamentos_sem_tipo',
                    'severity' => 'warning',
                    'count' => Pagamento::query()->whereNull('tipo_pagamento_id')->count(),
                    'message' => 'Pagamentos sem tipo de pagamento definido.',
                ],
                [
                    'code' => 'users_sem_colaborador',
                    'severity' => 'info',
                    'count' => User::query()->whereDoesntHave('colaborador')->count(),
                    'message' => 'Usuários sem vínculo com colaborador.',
                ],
                [
                    'code' => 'funcoes_duplicadas',
                    'severity' => 'warning',
                    'count' => Funcao::query()
                        ->selectRaw('LOWER(nome) as nome_normalizado')
                        ->groupBy('nome_normalizado')
                        ->havingRaw('COUNT(*) > 1')
                        ->get()
                        ->count(),
                    'message' => 'Funções potencialmente duplicadas por nome.',
                ],
                [
                    'code' => 'tipos_pagamento_duplicados',
                    'severity' => 'warning',
                    'count' => TipoPagamento::query()
                        ->selectRaw('LOWER(nome) as nome_normalizado')
                        ->groupBy('nome_normalizado')
                        ->havingRaw('COUNT(*) > 1')
                        ->get()
                        ->count(),
                    'message' => 'Tipos de pagamento potencialmente duplicados por nome.',
                ],
            ],
            'coverage' => [
                'has_unidades' => $units > 0,
                'has_funcoes' => $functions > 0,
                'has_tipos_pagamento' => $paymentTypes > 0,
            ],
        ];
    }
}
