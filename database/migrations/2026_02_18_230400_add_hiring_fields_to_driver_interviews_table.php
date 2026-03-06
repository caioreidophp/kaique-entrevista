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
            $table->boolean('foi_contratado')->default(false)->after('guep_status');
            $table->foreignId('colaborador_id')
                ->nullable()
                ->after('foi_contratado')
                ->constrained('colaboradores')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('colaborador_id');
            $table->dropColumn('foi_contratado');
        });
    }
};
