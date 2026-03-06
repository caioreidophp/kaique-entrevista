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
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->index(['author_id', 'created_at'], 'driver_interviews_author_created_at_index');
            $table->index(['author_id', 'updated_at'], 'driver_interviews_author_updated_at_index');
            $table->index(['hr_status', 'guep_status'], 'driver_interviews_hr_guep_index');
            $table->index('updated_at', 'driver_interviews_updated_at_index');
        });

        Schema::table('freight_entries', function (Blueprint $table): void {
            $table->index(['autor_id', 'data'], 'freight_entries_autor_data_index');
        });

        Schema::table('pagamentos', function (Blueprint $table): void {
            $table->index(['autor_id', 'competencia_ano', 'competencia_mes'], 'pagamentos_autor_competencia_index');
            $table->index(['autor_id', 'lancado_em'], 'pagamentos_autor_lancado_em_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pagamentos', function (Blueprint $table): void {
            $table->dropIndex('pagamentos_autor_competencia_index');
            $table->dropIndex('pagamentos_autor_lancado_em_index');
        });

        Schema::table('freight_entries', function (Blueprint $table): void {
            $table->dropIndex('freight_entries_autor_data_index');
        });

        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->dropIndex('driver_interviews_author_created_at_index');
            $table->dropIndex('driver_interviews_author_updated_at_index');
            $table->dropIndex('driver_interviews_hr_guep_index');
            $table->dropIndex('driver_interviews_updated_at_index');
        });
    }
};
