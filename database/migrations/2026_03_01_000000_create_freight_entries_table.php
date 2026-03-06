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
        Schema::create('freight_entries', function (Blueprint $table): void {
            $table->id();
            $table->date('data');
            $table->foreignId('unidade_id')->constrained('unidades')->restrictOnDelete();
            $table->foreignId('autor_id')->constrained('users')->restrictOnDelete();

            $table->decimal('frete_total', 14, 2);
            $table->unsignedInteger('cargas')->default(0);
            $table->unsignedBigInteger('aves')->default(0);
            $table->unsignedInteger('veiculos')->default(0);
            $table->decimal('km_rodado', 14, 2)->default(0);

            $table->decimal('frete_terceiros', 14, 2)->default(0);
            $table->unsignedInteger('viagens_terceiros')->default(0);
            $table->unsignedBigInteger('aves_terceiros')->default(0);

            $table->decimal('frete_liquido', 14, 2)->default(0);
            $table->unsignedInteger('cargas_liq')->default(0);
            $table->unsignedBigInteger('aves_liq')->default(0);

            $table->decimal('kaique', 14, 2)->default(0);
            $table->decimal('vdm', 14, 2)->default(0);

            $table->decimal('frete_programado', 14, 2)->default(0);
            $table->unsignedInteger('cargas_programadas')->default(0);
            $table->unsignedBigInteger('aves_programadas')->default(0);
            $table->unsignedInteger('cargas_canceladas_escaladas')->default(0);
            $table->unsignedInteger('nao_escaladas')->default(0);

            $table->string('placas')->nullable();
            $table->text('obs')->nullable();

            $table->timestamps();

            $table->unique(['data', 'unidade_id']);
            $table->index(['data', 'unidade_id']);
            $table->index(['unidade_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('freight_entries');
    }
};
