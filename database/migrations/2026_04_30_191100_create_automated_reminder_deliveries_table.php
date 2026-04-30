<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('automated_reminder_deliveries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('automated_reminder_rule_id')->nullable()->constrained('automated_reminder_rules')->nullOnDelete();
            $table->string('trigger_key', 80);
            $table->string('channel', 24);
            $table->string('recipient', 255);
            $table->string('status', 24)->default('sent');
            $table->string('subject', 255)->nullable();
            $table->text('message')->nullable();
            $table->unsignedSmallInteger('http_status')->nullable();
            $table->text('provider_response')->nullable();
            $table->text('error_message')->nullable();
            $table->json('context')->nullable();
            $table->timestamp('dispatched_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['channel', 'created_at']);
            $table->index(['trigger_key', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automated_reminder_deliveries');
    }
};

