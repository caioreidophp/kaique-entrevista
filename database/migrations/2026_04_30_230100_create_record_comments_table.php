<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('record_comments', function (Blueprint $table): void {
            $table->id();
            $table->string('module_key', 40);
            $table->unsignedBigInteger('record_id');
            $table->text('body');
            $table->json('mentioned_user_ids')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['module_key', 'record_id', 'id']);
            $table->index(['created_by', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('record_comments');
    }
};
