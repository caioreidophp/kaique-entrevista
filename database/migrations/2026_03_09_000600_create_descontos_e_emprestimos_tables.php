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
        Schema::create('descontos_colaboradores', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('colaborador_id')->constrained('colaboradores')->restrictOnDelete();
            $table->foreignId('unidade_id')->constrained('unidades')->restrictOnDelete();
            $table->foreignId('autor_id')->constrained('users')->restrictOnDelete();
            $table->string('descricao');
            $table->enum('tipo_saida', ['extras', 'salario', 'beneficios', 'direto']);
            $table->enum('forma_pagamento', ['dinheiro', 'pix', 'desconto_folha'])->default('desconto_folha');
            $table->decimal('valor', 12, 2);
            $table->boolean('parcelado')->default(false);
            $table->unsignedSmallInteger('total_parcelas')->nullable();
            $table->unsignedSmallInteger('parcela_atual')->nullable();
            $table->date('data_referencia')->nullable();
            $table->timestamps();

            $table->index(['colaborador_id', 'data_referencia'], 'descontos_colab_data_index');
        });

        Schema::create('emprestimos_colaboradores', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('colaborador_id')->constrained('colaboradores')->restrictOnDelete();
            $table->foreignId('unidade_id')->constrained('unidades')->restrictOnDelete();
            $table->foreignId('autor_id')->constrained('users')->restrictOnDelete();
            $table->string('descricao');
            $table->decimal('valor_total', 12, 2);
            $table->decimal('valor_parcela', 12, 2);
            $table->unsignedSmallInteger('total_parcelas');
            $table->unsignedSmallInteger('parcelas_pagas')->default(0);
            $table->date('data_inicio');
            $table->boolean('ativo')->default(true);
            $table->timestamps();

            $table->index(['colaborador_id', 'ativo'], 'emprestimos_colab_ativo_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('emprestimos_colaboradores');
        Schema::dropIfExists('descontos_colaboradores');
    }
};
