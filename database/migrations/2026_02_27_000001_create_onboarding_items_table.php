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
        Schema::create('onboarding_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('onboarding_id')
                ->constrained('onboardings')
                ->cascadeOnDelete();
            $table->string('code', 80);
            $table->string('title');
            $table->boolean('required')->default(true);
            $table->enum('status', ['pendente', 'em_analise', 'aprovado', 'reprovado'])
                ->default('pendente');
            $table->date('due_date')->nullable();
            $table->foreignId('approved_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['onboarding_id', 'code']);
            $table->index(['status', 'due_date']);
            $table->index(['onboarding_id', 'required']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('onboarding_items');
    }
};
