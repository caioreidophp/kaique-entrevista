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
        Schema::create('freight_displacements', function (Blueprint $table): void {
            $table->id();
            $table->date('data');
            $table->text('descricao');
            $table->foreignId('unidade_veiculos_id')->constrained('unidades')->restrictOnDelete();
            $table->unsignedInteger('quantidade_caminhoes')->default(0);
            $table->text('placas')->nullable();
            $table->string('origem', 255);
            $table->string('destino', 255);
            $table->decimal('km_aproximado', 14, 2)->default(0);
            $table->decimal('valor_aproximado', 14, 2)->default(0);
            $table->foreignId('unidade_pagadora_id')->constrained('unidades')->restrictOnDelete();
            $table->string('status', 40)->default('pendente');
            $table->foreignId('freight_spot_entry_id')->nullable()->constrained('freight_spot_entries')->nullOnDelete();
            $table->foreignId('autor_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['status', 'data'], 'freight_displacements_status_data_idx');
            $table->index(['unidade_pagadora_id', 'data'], 'freight_displacements_payer_date_idx');
            $table->index(['unidade_veiculos_id', 'data'], 'freight_displacements_vehicle_unit_date_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('freight_displacements');
    }
};
