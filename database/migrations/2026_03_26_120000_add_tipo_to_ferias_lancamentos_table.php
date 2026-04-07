<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('ferias_lancamentos', function (Blueprint $table): void {
            $table->string('tipo', 20)->default('confirmado')->after('autor_id');
            $table->index('tipo', 'ferias_tipo_idx');
        });

        DB::table('ferias_lancamentos')
            ->whereNull('tipo')
            ->update(['tipo' => 'confirmado']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ferias_lancamentos', function (Blueprint $table): void {
            $table->dropIndex('ferias_tipo_idx');
            $table->dropColumn('tipo');
        });
    }
};
