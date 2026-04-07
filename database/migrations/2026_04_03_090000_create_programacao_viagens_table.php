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
        Schema::create('programacao_viagens', function (Blueprint $table): void {
            $table->id();
            $table->date('data_viagem');
            $table->foreignId('unidade_id')->constrained('unidades')->restrictOnDelete();
            $table->string('codigo_viagem', 80)->nullable();
            $table->string('origem', 160)->nullable();
            $table->string('destino', 160)->nullable();
            $table->decimal('jornada_horas_prevista', 6, 2)->default(0);
            $table->text('observacoes')->nullable();
            $table->string('import_lote', 64)->nullable();
            $table->foreignId('autor_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['data_viagem', 'unidade_id']);
            $table->index(['autor_id', 'data_viagem']);
            $table->index('import_lote');
            $table->unique(['data_viagem', 'unidade_id', 'codigo_viagem'], 'programacao_viagens_unique_trip');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('programacao_viagens');
    }
};
