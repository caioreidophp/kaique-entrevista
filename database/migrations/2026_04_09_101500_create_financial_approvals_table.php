<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('financial_approvals', function (Blueprint $table): void {
            $table->id();
            $table->uuid('request_uuid')->unique();
            $table->string('action_key', 120);
            $table->string('request_hash', 64);
            $table->string('status', 20)->default('pending');
            $table->json('summary')->nullable();
            $table->foreignId('requester_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('approver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('execution_token', 120)->nullable()->unique();
            $table->timestamp('token_expires_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('consumed_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->text('reason')->nullable();
            $table->timestamps();

            $table->index(['action_key', 'status']);
            $table->index(['requester_id', 'status']);
            $table->index(['approver_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_approvals');
    }
};
