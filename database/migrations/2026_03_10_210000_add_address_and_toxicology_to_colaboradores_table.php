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
            $table->string('cnh', 11)->nullable()->change();
            $table->date('validade_exame_toxicologico')->nullable()->after('validade_cnh');

            $table->string('cep', 9)->nullable()->after('email');
            $table->string('logradouro')->nullable()->after('cep');
            $table->string('numero_endereco', 20)->nullable()->after('logradouro');
            $table->string('complemento')->nullable()->after('numero_endereco');
            $table->string('bairro', 120)->nullable()->after('complemento');
            $table->string('cidade_uf', 120)->nullable()->after('bairro');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('colaboradores', function (Blueprint $table): void {
            $table->dropColumn([
                'validade_exame_toxicologico',
                'cep',
                'logradouro',
                'numero_endereco',
                'complemento',
                'bairro',
                'cidade_uf',
            ]);

            $table->string('cnh', 9)->nullable()->change();
        });
    }
};
