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
        Schema::create('colaboradores', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('unidade_id')->constrained('unidades')->restrictOnDelete();
            $table->foreignId('funcao_id')->constrained('funcoes')->restrictOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();

            $table->string('nome');
            $table->string('apelido')->nullable();
            $table->string('sexo', 20)->nullable();
            $table->boolean('ativo')->default(true);

            $table->string('cpf', 11)->unique();
            $table->string('rg', 10)->nullable();
            $table->string('cnh', 9)->nullable();
            $table->date('validade_cnh')->nullable();

            $table->date('data_nascimento')->nullable();
            $table->date('data_admissao')->nullable();
            $table->date('data_demissao')->nullable();

            $table->string('telefone', 11)->nullable();
            $table->string('email')->nullable();
            $table->text('endereco_completo')->nullable();

            $table->string('dados_bancarios_1')->nullable();
            $table->string('dados_bancarios_2')->nullable();
            $table->string('chave_pix')->nullable();
            $table->string('nome_banco')->nullable();
            $table->string('numero_banco')->nullable();
            $table->string('numero_agencia')->nullable();
            $table->string('tipo_conta')->nullable();
            $table->string('numero_conta')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['unidade_id', 'ativo']);
            $table->index(['funcao_id', 'ativo']);
            $table->index('nome');
            $table->index('email');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('colaboradores');
    }
};
