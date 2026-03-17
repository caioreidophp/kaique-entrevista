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
        Schema::table('freight_entries', function (Blueprint $table): void {
            $table->decimal('programado_frete', 14, 2)->default(0);
            $table->unsignedInteger('programado_viagens')->default(0);
            $table->unsignedBigInteger('programado_aves')->default(0);
            $table->decimal('programado_km', 14, 2)->default(0);

            $table->decimal('kaique_geral_frete', 14, 2)->default(0);
            $table->unsignedInteger('kaique_geral_viagens')->default(0);
            $table->unsignedBigInteger('kaique_geral_aves')->default(0);
            $table->decimal('kaique_geral_km', 14, 2)->default(0);

            $table->decimal('terceiros_frete', 14, 2)->default(0);
            $table->unsignedInteger('terceiros_viagens')->default(0);
            $table->unsignedBigInteger('terceiros_aves')->default(0);
            $table->decimal('terceiros_km', 14, 2)->default(0);

            $table->decimal('abatedouro_frete', 14, 2)->default(0);
            $table->unsignedInteger('abatedouro_viagens')->default(0);
            $table->unsignedBigInteger('abatedouro_aves')->default(0);
            $table->decimal('abatedouro_km', 14, 2)->default(0);

            $table->decimal('canceladas_sem_escalar_frete', 14, 2)->default(0);
            $table->unsignedInteger('canceladas_sem_escalar_viagens')->default(0);
            $table->unsignedBigInteger('canceladas_sem_escalar_aves')->default(0);
            $table->decimal('canceladas_sem_escalar_km', 14, 2)->default(0);

            $table->decimal('canceladas_escaladas_frete', 14, 2)->default(0);
            $table->unsignedInteger('canceladas_escaladas_viagens')->default(0);
            $table->unsignedBigInteger('canceladas_escaladas_aves')->default(0);
            $table->decimal('canceladas_escaladas_km', 14, 2)->default(0);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('freight_entries', function (Blueprint $table): void {
            $table->dropColumn([
                'programado_frete',
                'programado_viagens',
                'programado_aves',
                'programado_km',
                'kaique_geral_frete',
                'kaique_geral_viagens',
                'kaique_geral_aves',
                'kaique_geral_km',
                'terceiros_frete',
                'terceiros_viagens',
                'terceiros_aves',
                'terceiros_km',
                'abatedouro_frete',
                'abatedouro_viagens',
                'abatedouro_aves',
                'abatedouro_km',
                'canceladas_sem_escalar_frete',
                'canceladas_sem_escalar_viagens',
                'canceladas_sem_escalar_aves',
                'canceladas_sem_escalar_km',
                'canceladas_escaladas_frete',
                'canceladas_escaladas_viagens',
                'canceladas_escaladas_aves',
                'canceladas_escaladas_km',
            ]);
        });
    }
};
