<?php

use Carbon\CarbonImmutable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('ferias_lancamentos')
            ->where('tipo', 'passada')
            ->orderBy('id')
            ->chunkById(500, function ($rows): void {
                foreach ($rows as $row) {
                    if (! $row->data_inicio || ! $row->data_fim) {
                        continue;
                    }

                    $dataInicio = CarbonImmutable::parse((string) $row->data_inicio);
                    $dataFimInformada = CarbonImmutable::parse((string) $row->data_fim);
                    $duracaoInformada = $dataInicio->diffInDays($dataFimInformada) + 1;

                    if ($duracaoInformada < 17) {
                        continue;
                    }

                    $diasFerias = $duracaoInformada >= 28 ? 30 : 20;
                    $comAbono = $diasFerias === 20;
                    $dataFimNormalizada = $dataInicio->addDays($diasFerias - 1)->toDateString();

                    DB::table('ferias_lancamentos')
                        ->where('id', $row->id)
                        ->update([
                            'dias_ferias' => $diasFerias,
                            'com_abono' => $comAbono,
                            'data_fim' => $dataFimNormalizada,
                            'updated_at' => now(),
                        ]);
                }
            });
    }

    public function down(): void
    {
    }
};
