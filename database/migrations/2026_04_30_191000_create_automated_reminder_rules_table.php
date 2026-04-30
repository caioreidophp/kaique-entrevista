<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('automated_reminder_rules', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('trigger_key', 80);
            $table->string('channel', 24);
            $table->json('recipients');
            $table->unsignedSmallInteger('threshold_days')->default(30);
            $table->string('webhook_url', 2048)->nullable();
            $table->text('message_prefix')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_run_at')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['trigger_key', 'is_active']);
            $table->index(['channel', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automated_reminder_rules');
    }
};

