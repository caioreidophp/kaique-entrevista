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
        Schema::create('onboarding_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('onboarding_id')
                ->constrained('onboardings')
                ->cascadeOnDelete();
            $table->foreignId('onboarding_item_id')
                ->nullable()
                ->constrained('onboarding_items')
                ->nullOnDelete();
            $table->string('event_type', 80);
            $table->string('from_value')->nullable();
            $table->string('to_value')->nullable();
            $table->json('payload')->nullable();
            $table->foreignId('performed_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamps();

            $table->index(['onboarding_id', 'created_at']);
            $table->index('event_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('onboarding_events');
    }
};
