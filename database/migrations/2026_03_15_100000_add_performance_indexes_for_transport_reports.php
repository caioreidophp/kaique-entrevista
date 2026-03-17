<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('pagamentos', function (Blueprint $table): void {
            $table->index(['autor_id', 'colaborador_id', 'competencia_ano', 'competencia_mes'], 'pagamentos_autor_colab_competencia_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pagamentos', function (Blueprint $table): void {
            $table->dropIndex('pagamentos_autor_colab_competencia_index');
        });
    }
};
