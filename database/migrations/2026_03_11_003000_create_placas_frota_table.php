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
        Schema::create('placas_frota', function (Blueprint $table): void {
            $table->id();
            $table->string('placa', 10)->unique();
            $table->foreignId('unidade_id')->constrained('unidades')->restrictOnDelete();
            $table->timestamps();

            $table->index(['unidade_id', 'placa']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('placas_frota');
    }
};
