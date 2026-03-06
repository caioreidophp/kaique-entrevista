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
        Schema::create('pagamentos', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('colaborador_id')->constrained('colaboradores')->restrictOnDelete();
            $table->foreignId('unidade_id')->constrained('unidades')->restrictOnDelete();
            $table->foreignId('autor_id')->constrained('users')->restrictOnDelete();

            $table->unsignedTinyInteger('competencia_mes');
            $table->unsignedSmallInteger('competencia_ano');
            $table->decimal('valor', 12, 2);
            $table->text('observacao')->nullable();
            $table->timestamp('lancado_em')->nullable();

            $table->timestamps();

            $table->unique(['colaborador_id', 'competencia_mes', 'competencia_ano'], 'pagamentos_colaborador_competencia_unique');
            $table->index(['unidade_id', 'competencia_ano', 'competencia_mes'], 'pagamentos_unidade_competencia_index');
            $table->index(['competencia_ano', 'competencia_mes'], 'pagamentos_competencia_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pagamentos');
    }
};
