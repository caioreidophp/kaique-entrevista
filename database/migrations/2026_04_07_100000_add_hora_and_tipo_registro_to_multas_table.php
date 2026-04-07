<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('multas', function (Blueprint $table): void {
            $table->time('hora')->nullable()->after('data');
            $table->enum('tipo_registro', ['multa', 'notificacao'])
                ->default('multa')
                ->after('hora');

            $table->index(['tipo_registro', 'data'], 'multas_tipo_registro_data_index');
        });
    }

    public function down(): void
    {
        Schema::table('multas', function (Blueprint $table): void {
            $table->dropIndex('multas_tipo_registro_data_index');
            $table->dropColumn(['hora', 'tipo_registro']);
        });
    }
};
