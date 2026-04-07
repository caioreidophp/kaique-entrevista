<?php

use Carbon\CarbonImmutable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('colaboradores')
            ->select(['id', 'data_admissao'])
            ->whereNotNull('data_admissao')
            ->orderBy('id')
            ->chunkById(200, function ($colaboradores): void {
                foreach ($colaboradores as $colaborador) {
                    $admissao = CarbonImmutable::parse((string) $colaborador->data_admissao);

                    $lancamentos = DB::table('ferias_lancamentos')
                        ->select(['id'])
                        ->where('colaborador_id', (int) $colaborador->id)
                        ->orderBy('data_inicio')
                        ->orderBy('id')
                        ->get();

                    foreach ($lancamentos as $index => $lancamento) {
                        $periodoInicio = $admissao->addYearsNoOverflow($index);
                        $periodoFim = $periodoInicio->addYear()->subDay();

                        DB::table('ferias_lancamentos')
                            ->where('id', (int) $lancamento->id)
                            ->update([
                                'periodo_aquisitivo_inicio' => $periodoInicio->toDateString(),
                                'periodo_aquisitivo_fim' => $periodoFim->toDateString(),
                                'updated_at' => now(),
                            ]);
                    }
                }
            });
    }

    public function down(): void
    {
    }
};
