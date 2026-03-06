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
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->string('rg', 30)->change();
            $table->decimal('overall_score', 3, 1)->change();
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE driver_interviews MODIFY hr_status ENUM('aprovado', 'reprovado', 'em_analise', 'aguardando_vaga', 'guep', 'teste_pratico') NOT NULL"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE driver_interviews MODIFY hr_status ENUM('aprovado', 'reprovado', 'aguardando_vaga', 'guep', 'teste_pratico') NOT NULL"
            );
        }

        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->string('rg', 9)->change();
            $table->unsignedTinyInteger('overall_score')->change();
        });
    }
};
