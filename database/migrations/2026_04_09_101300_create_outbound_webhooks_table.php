<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('outbound_webhooks', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('target_url', 2048);
            $table->string('signing_secret', 255);
            $table->json('events')->nullable();
            $table->unsignedSmallInteger('timeout_seconds')->default(10);
            $table->unsignedTinyInteger('max_attempts')->default(5);
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_triggered_at')->nullable();
            $table->unsignedInteger('failed_deliveries_count')->default(0);
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['is_active', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('outbound_webhooks');
    }
};
