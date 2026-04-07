<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('programacao_viagens', function (Blueprint $table): void {
            $table->string('aviario', 160)->nullable()->after('destino');
            $table->string('cidade', 160)->nullable()->after('aviario');
            $table->decimal('distancia_km', 8, 2)->default(0)->after('cidade');
            $table->string('equipe', 60)->nullable()->after('distancia_km');
            $table->unsignedInteger('aves')->default(0)->after('equipe');
            $table->string('numero_carga', 80)->nullable()->after('aves');
            $table->time('hora_carregamento_prevista')->nullable()->after('hora_inicio_prevista');

            $table->index(['data_viagem', 'unidade_id', 'numero_carga'], 'programacao_viagens_data_unidade_carga_idx');
        });
    }

    public function down(): void
    {
        Schema::table('programacao_viagens', function (Blueprint $table): void {
            $table->dropIndex('programacao_viagens_data_unidade_carga_idx');
            $table->dropColumn([
                'aviario',
                'cidade',
                'distancia_km',
                'equipe',
                'aves',
                'numero_carga',
                'hora_carregamento_prevista',
            ]);
        });
    }
};
