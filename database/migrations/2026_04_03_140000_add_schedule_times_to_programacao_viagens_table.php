<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('programacao_viagens', function (Blueprint $table): void {
            $table->time('hora_inicio_prevista')->nullable()->after('destino');
            $table->time('hora_fim_prevista')->nullable()->after('hora_inicio_prevista');
        });
    }

    public function down(): void
    {
        Schema::table('programacao_viagens', function (Blueprint $table): void {
            $table->dropColumn([
                'hora_inicio_prevista',
                'hora_fim_prevista',
            ]);
        });
    }
};
