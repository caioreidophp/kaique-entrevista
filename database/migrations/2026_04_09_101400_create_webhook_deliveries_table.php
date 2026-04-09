<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('webhook_deliveries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('outbound_webhook_id')->constrained('outbound_webhooks')->cascadeOnDelete();
            $table->string('event_name', 120);
            $table->unsignedSmallInteger('attempt')->default(1);
            $table->boolean('is_success')->default(false);
            $table->unsignedSmallInteger('http_status')->nullable();
            $table->string('signature', 255)->nullable();
            $table->json('payload');
            $table->text('response_body')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('next_retry_at')->nullable();
            $table->timestamp('dead_lettered_at')->nullable();
            $table->timestamps();

            $table->index(['event_name', 'is_success']);
            $table->index(['dead_lettered_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webhook_deliveries');
    }
};
