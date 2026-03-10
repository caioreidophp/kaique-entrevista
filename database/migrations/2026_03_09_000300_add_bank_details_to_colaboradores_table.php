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
        Schema::table('colaboradores', function (Blueprint $table): void {
            $table->string('tipo_chave_pix', 20)->nullable()->after('chave_pix');
            $table->string('banco_salario', 20)->nullable()->after('numero_conta');
            $table->string('numero_agencia_salario', 20)->nullable()->after('banco_salario');
            $table->string('numero_conta_salario', 30)->nullable()->after('numero_agencia_salario');
            $table->string('conta_pagamento', 20)->nullable()->after('numero_conta_salario');
            $table->string('cartao_beneficio', 20)->nullable()->after('conta_pagamento');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('colaboradores', function (Blueprint $table): void {
            $table->dropColumn([
                'tipo_chave_pix',
                'banco_salario',
                'numero_agencia_salario',
                'numero_conta_salario',
                'conta_pagamento',
                'cartao_beneficio',
            ]);
        });
    }
};
