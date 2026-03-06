<?php

namespace Database\Seeders;

use App\Models\Funcao;
use Illuminate\Database\Seeder;

class FuncaoSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $funcoes = [
            'Motorista',
            'Auxiliar Administrativo',
            'Agente Administrativo',
            'Gerente de Frota',
            'RH',
            'Financeiro',
            'Estoquista',
            'Manobrista',
        ];

        foreach ($funcoes as $nome) {
            Funcao::query()->updateOrCreate(
                ['nome' => $nome],
                ['ativo' => true],
            );
        }
    }
}
