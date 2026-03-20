<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('descontos_colaboradores', function (Blueprint $table): void {
            $table->json('tipo_saida_prioridades')->nullable()->after('tipo_saida');
        });
    }

    public function down(): void
    {
        Schema::table('descontos_colaboradores', function (Blueprint $table): void {
            $table->dropColumn('tipo_saida_prioridades');
        });
    }
};
