<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('financial_approvals', function (Blueprint $table): void {
            $table->unsignedTinyInteger('required_approvals')
                ->default(1)
                ->after('status');
            $table->unsignedTinyInteger('approved_steps')
                ->default(0)
                ->after('required_approvals');
            $table->json('approval_history')
                ->nullable()
                ->after('summary');
        });
    }

    public function down(): void
    {
        Schema::table('financial_approvals', function (Blueprint $table): void {
            $table->dropColumn(['required_approvals', 'approved_steps', 'approval_history']);
        });
    }
};
