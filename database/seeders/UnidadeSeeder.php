<?php

namespace Database\Seeders;

use App\Models\Unidade;
use Illuminate\Database\Seeder;

class UnidadeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $unidades = [
            ['nome' => 'Amparo', 'slug' => 'amparo', 'ativo' => true],
            ['nome' => 'Itapetininga', 'slug' => 'itapetininga', 'ativo' => true],
            ['nome' => 'Tatuí', 'slug' => 'tatui', 'ativo' => true],
        ];

        foreach ($unidades as $unidade) {
            Unidade::query()->withTrashed()->updateOrCreate(
                ['nome' => $unidade['nome']],
                [
                    'slug' => $unidade['slug'],
                    'ativo' => (bool) $unidade['ativo'],
                    'deleted_at' => null,
                ],
            );
        }
    }
}
