<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('programacao_viagens', function (Blueprint $table): void {
            $table->unsignedInteger('ordem_importacao')
                ->default(0)
                ->after('import_lote');

            $table->index(
                ['data_viagem', 'unidade_id', 'ordem_importacao'],
                'programacao_viagens_data_unidade_ordem_importacao_idx',
            );
        });
    }

    public function down(): void
    {
        Schema::table('programacao_viagens', function (Blueprint $table): void {
            $table->dropIndex('programacao_viagens_data_unidade_ordem_importacao_idx');
            $table->dropColumn('ordem_importacao');
        });
    }
};
