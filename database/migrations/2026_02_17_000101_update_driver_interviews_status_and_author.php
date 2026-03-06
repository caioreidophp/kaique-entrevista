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
        $driver = DB::getDriverName();

        Schema::table('driver_interviews', function (Blueprint $table) {
            $table->foreignId('author_id')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
            $table->enum('guep_status', ['nao_fazer', 'a_fazer', 'aprovado', 'reprovado', 'aguardando'])
                ->default('aguardando')
                ->after('hr_status');
        });

        DB::table('driver_interviews')
            ->whereNull('author_id')
            ->update([
                'author_id' => DB::raw('user_id'),
            ]);

        DB::table('driver_interviews')
            ->where('hr_status', 'banco_de_talentos')
            ->update(['hr_status' => 'aguardando_vaga']);

        DB::table('driver_interviews')
            ->where('hr_status', 'requer_atencao')
            ->update(['hr_status' => 'teste_pratico']);

        if ($driver === 'mysql') {
            DB::statement(
                "ALTER TABLE driver_interviews MODIFY hr_status ENUM('aprovado', 'reprovado', 'aguardando_vaga', 'guep', 'teste_pratico') NOT NULL"
            );
        }

        DB::table('driver_interviews')
            ->where('hr_status', 'reprovado')
            ->update(['guep_status' => 'nao_fazer']);

        Schema::table('driver_interviews', function (Blueprint $table) {
            $table->index('author_id');
            $table->index('guep_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driver = DB::getDriverName();

        DB::table('driver_interviews')
            ->where('hr_status', 'aguardando_vaga')
            ->update(['hr_status' => 'banco_de_talentos']);

        DB::table('driver_interviews')
            ->whereIn('hr_status', ['guep', 'teste_pratico'])
            ->update(['hr_status' => 'requer_atencao']);

        if ($driver === 'mysql') {
            DB::statement(
                "ALTER TABLE driver_interviews MODIFY hr_status ENUM('aprovado', 'banco_de_talentos', 'reprovado', 'requer_atencao') NOT NULL"
            );
        }

        Schema::table('driver_interviews', function (Blueprint $table) {
            $table->dropIndex(['author_id']);
            $table->dropIndex(['guep_status']);
            $table->dropConstrainedForeignId('author_id');
            $table->dropColumn('guep_status');
        });
    }
};
