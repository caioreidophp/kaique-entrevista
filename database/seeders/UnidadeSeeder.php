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
            ['nome' => 'Amparo', 'slug' => 'amparo'],
            ['nome' => 'Itapetininga', 'slug' => 'itapetininga'],
            ['nome' => 'Tatuí', 'slug' => 'tatui'],
        ];

        foreach ($unidades as $unidade) {
            Unidade::query()->updateOrCreate(
                ['nome' => $unidade['nome']],
                ['slug' => $unidade['slug']],
            );
        }
    }
}
