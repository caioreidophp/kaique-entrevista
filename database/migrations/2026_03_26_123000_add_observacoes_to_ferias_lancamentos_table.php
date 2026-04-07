<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ferias_lancamentos', function (Blueprint $table): void {
            $table->text('observacoes')->nullable()->after('periodo_aquisitivo_fim');
        });
    }

    public function down(): void
    {
        Schema::table('ferias_lancamentos', function (Blueprint $table): void {
            $table->dropColumn('observacoes');
        });
    }
};
