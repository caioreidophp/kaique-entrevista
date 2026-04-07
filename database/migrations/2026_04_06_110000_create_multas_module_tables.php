<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('multa_infracoes', function (Blueprint $table): void {
            $table->id();
            $table->string('nome');
            $table->boolean('ativo')->default(true);
            $table->timestamps();

            $table->unique('nome', 'multa_infracoes_nome_unique');
        });

        Schema::create('multa_orgaos_autuadores', function (Blueprint $table): void {
            $table->id();
            $table->string('nome');
            $table->boolean('ativo')->default(true);
            $table->timestamps();

            $table->unique('nome', 'multa_orgaos_nome_unique');
        });

        Schema::create('multas', function (Blueprint $table): void {
            $table->id();
            $table->date('data');
            $table->foreignId('unidade_id')->nullable()->constrained('unidades')->nullOnDelete();
            $table->foreignId('placa_frota_id')->nullable()->constrained('placas_frota')->nullOnDelete();
            $table->foreignId('multa_infracao_id')->nullable()->constrained('multa_infracoes')->nullOnDelete();
            $table->foreignId('multa_orgao_autuador_id')->nullable()->constrained('multa_orgaos_autuadores')->nullOnDelete();
            $table->foreignId('colaborador_id')->nullable()->constrained('colaboradores')->nullOnDelete();
            $table->text('descricao')->nullable();
            $table->string('numero_auto_infracao', 120)->nullable();
            $table->boolean('indicado_condutor')->default(false);
            $table->enum('culpa', ['empresa', 'motorista'])->default('empresa');
            $table->decimal('valor', 12, 2)->default(0);
            $table->enum('tipo_valor', ['normal', '20_percent', '40_percent'])->default('normal');
            $table->date('vencimento')->nullable();
            $table->enum('status', ['aguardando_motorista', 'solicitado_boleto', 'boleto_ok', 'pago'])->default('aguardando_motorista');
            $table->boolean('descontar')->default(false);
            $table->foreignId('autor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['data', 'unidade_id'], 'multas_data_unidade_index');
            $table->index(['placa_frota_id', 'status'], 'multas_placa_status_index');
            $table->index(['colaborador_id', 'status'], 'multas_colaborador_status_index');
            $table->index(['culpa', 'descontar'], 'multas_culpa_descontar_index');
            $table->index('numero_auto_infracao', 'multas_auto_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('multas');
        Schema::dropIfExists('multa_orgaos_autuadores');
        Schema::dropIfExists('multa_infracoes');
    }
};
