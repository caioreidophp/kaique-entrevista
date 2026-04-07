<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('freight_entries', function (Blueprint $table): void {
            $table->index(['autor_id', 'data', 'id'], 'freight_entries_autor_data_id_idx');
            $table->index(['data', 'id'], 'freight_entries_data_id_idx');
        });

        Schema::table('pagamentos', function (Blueprint $table): void {
            $table->index(['autor_id', 'competencia_ano', 'competencia_mes'], 'pagamentos_autor_competencia_idx');
            $table->index(['colaborador_id', 'competencia_ano', 'competencia_mes'], 'pagamentos_colaborador_competencia_idx');
            $table->index(['autor_id', 'data_pagamento'], 'pagamentos_autor_data_pagamento_idx');
        });
    }

    public function down(): void
    {
        Schema::table('freight_entries', function (Blueprint $table): void {
            $table->dropIndex('freight_entries_autor_data_id_idx');
            $table->dropIndex('freight_entries_data_id_idx');
        });

        Schema::table('pagamentos', function (Blueprint $table): void {
            $table->dropIndex('pagamentos_autor_competencia_idx');
            $table->dropIndex('pagamentos_colaborador_competencia_idx');
            $table->dropIndex('pagamentos_autor_data_pagamento_idx');
        });
    }
};
