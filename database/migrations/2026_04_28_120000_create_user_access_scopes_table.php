<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_access_scopes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('module_key', 80);
            $table->string('data_scope', 16)->default('all');
            $table->json('allowed_unit_ids')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'module_key']);
            $table->index(['module_key', 'data_scope']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_access_scopes');
    }
};
