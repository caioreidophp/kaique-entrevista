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
        Schema::create('pensoes_colaboradores', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('colaborador_id')->constrained('colaboradores')->restrictOnDelete();
            $table->foreignId('unidade_id')->constrained('unidades')->restrictOnDelete();
            $table->foreignId('autor_id')->constrained('users')->restrictOnDelete();
            $table->string('nome_beneficiaria');
            $table->string('cpf_beneficiaria', 20)->nullable();
            $table->decimal('valor', 12, 2);
            $table->string('nome_banco', 120);
            $table->string('numero_banco', 20)->nullable();
            $table->string('numero_agencia', 30);
            $table->string('tipo_conta', 40);
            $table->string('numero_conta', 40);
            $table->string('tipo_chave_pix', 40)->nullable();
            $table->string('chave_pix')->nullable();
            $table->text('observacao')->nullable();
            $table->boolean('ativo')->default(true);
            $table->timestamps();

            $table->index(['colaborador_id', 'ativo'], 'pensoes_colab_ativo_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pensoes_colaboradores');
    }
};
