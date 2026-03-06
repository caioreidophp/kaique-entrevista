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
        Schema::create('onboardings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('driver_interview_id')
                ->constrained('driver_interviews')
                ->cascadeOnDelete();
            $table->foreignId('colaborador_id')
                ->nullable()
                ->constrained('colaboradores')
                ->nullOnDelete();
            $table->foreignId('responsavel_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->enum('status', ['em_andamento', 'bloqueado', 'concluido'])
                ->default('em_andamento');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('concluded_at')->nullable();
            $table->timestamps();

            $table->unique('driver_interview_id');
            $table->index(['status', 'responsavel_user_id']);
            $table->index('colaborador_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('onboardings');
    }
};
