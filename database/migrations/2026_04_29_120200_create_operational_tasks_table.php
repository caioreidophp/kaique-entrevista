<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('operational_tasks', function (Blueprint $table): void {
            $table->id();
            $table->string('module_key', 50)->default('operations');
            $table->foreignId('unidade_id')->nullable()->constrained('unidades')->nullOnDelete();
            $table->string('title', 180);
            $table->text('description')->nullable();
            $table->string('priority', 20)->default('normal');
            $table->string('status', 20)->default('open');
            $table->timestamp('due_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['status', 'priority']);
            $table->index(['module_key', 'status']);
            $table->index(['unidade_id', 'status']);
            $table->index(['assigned_to', 'status']);
            $table->index(['due_at', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operational_tasks');
    }
};
