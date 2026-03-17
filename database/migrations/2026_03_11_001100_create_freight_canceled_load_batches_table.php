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
        Schema::create('freight_canceled_load_batches', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('unidade_id')->constrained('unidades')->restrictOnDelete();
            $table->foreignId('autor_id')->constrained('users')->restrictOnDelete();
            $table->string('descricao', 255);
            $table->date('data_pagamento');
            $table->string('numero_nota_fiscal', 80);
            $table->timestamps();

            $table->index(['unidade_id', 'data_pagamento'], 'freight_cancel_batch_unit_date_idx');
        });

        Schema::table('freight_canceled_loads', function (Blueprint $table): void {
            $table->foreignId('batch_id')
                ->nullable()
                ->after('freight_entry_id')
                ->constrained('freight_canceled_load_batches')
                ->nullOnDelete();

            $table->index(['batch_id', 'status'], 'freight_cancel_batch_status_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('freight_canceled_loads', function (Blueprint $table): void {
            $table->dropIndex('freight_cancel_batch_status_idx');
            $table->dropConstrainedForeignId('batch_id');
        });

        Schema::dropIfExists('freight_canceled_load_batches');
    }
};
