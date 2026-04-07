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
        Schema::create('programacao_escalas', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('programacao_viagem_id')->constrained('programacao_viagens')->cascadeOnDelete();
            $table->foreignId('colaborador_id')->constrained('colaboradores')->restrictOnDelete();
            $table->foreignId('placa_frota_id')->constrained('placas_frota')->restrictOnDelete();
            $table->foreignId('autor_id')->constrained('users')->restrictOnDelete();
            $table->text('observacoes')->nullable();
            $table->timestamps();

            $table->unique('programacao_viagem_id');
            $table->index('colaborador_id');
            $table->index('placa_frota_id');
            $table->index(['autor_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('programacao_escalas');
    }
};
