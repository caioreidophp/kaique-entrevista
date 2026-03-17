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
        Schema::create('freight_canceled_loads', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('freight_entry_id')->constrained('freight_entries')->cascadeOnDelete();
            $table->foreignId('unidade_id')->constrained('unidades')->restrictOnDelete();
            $table->foreignId('autor_id')->constrained('users')->restrictOnDelete();
            $table->date('data');
            $table->string('placa', 20);
            $table->string('aviario', 255)->nullable();
            $table->decimal('valor', 14, 2)->default(0);
            $table->string('n_viagem', 80)->nullable();
            $table->text('obs')->nullable();
            $table->enum('status', ['a_receber', 'recebida'])->default('a_receber');
            $table->date('data_pagamento')->nullable();
            $table->timestamps();

            $table->index(['status', 'data'], 'freight_cancel_status_data_idx');
            $table->index(['unidade_id', 'status'], 'freight_cancel_unidade_status_idx');
            $table->index('placa', 'freight_cancel_placa_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('freight_canceled_loads');
    }
};
