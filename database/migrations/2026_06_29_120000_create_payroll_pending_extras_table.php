<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_pending_extras', function (Blueprint $table): void {
            $table->id();
            $table->date('data');
            $table->foreignId('unidade_id')->nullable()->constrained('unidades')->nullOnDelete();
            $table->string('descricao');
            $table->string('tipo', 40);
            $table->string('status', 20)->default('pendente');
            $table->foreignId('pagamento_id')->nullable()->constrained('pagamentos')->nullOnDelete();
            $table->foreignId('autor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'data']);
            $table->index(['unidade_id', 'status']);
            $table->index('pagamento_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_pending_extras');
    }
};
