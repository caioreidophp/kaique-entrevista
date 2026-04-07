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
        Schema::create('interview_curriculums', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('author_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->string('full_name');
            $table->string('document_path');
            $table->string('document_original_name');
            $table->string('status', 40)->default('pendente');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['author_id', 'status']);
            $table->index('full_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('interview_curriculums');
    }
};
