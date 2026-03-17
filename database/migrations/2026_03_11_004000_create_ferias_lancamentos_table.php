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
        Schema::create('ferias_lancamentos', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('colaborador_id')->constrained('colaboradores')->restrictOnDelete();
            $table->foreignId('unidade_id')->constrained('unidades')->restrictOnDelete();
            $table->foreignId('funcao_id')->nullable()->constrained('funcoes')->nullOnDelete();
            $table->foreignId('autor_id')->constrained('users')->restrictOnDelete();
            $table->boolean('com_abono')->default(false);
            $table->unsignedTinyInteger('dias_ferias')->default(30);
            $table->date('data_inicio');
            $table->date('data_fim');
            $table->date('periodo_aquisitivo_inicio');
            $table->date('periodo_aquisitivo_fim');
            $table->timestamps();

            $table->index(['colaborador_id', 'periodo_aquisitivo_fim'], 'ferias_colab_periodo_fim_idx');
            $table->index(['unidade_id', 'funcao_id'], 'ferias_unidade_funcao_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ferias_lancamentos');
    }
};
