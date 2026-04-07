<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->string('work_card_attachment_path')->nullable()->after('cnh_attachment_original_name');
            $table->string('work_card_attachment_original_name')->nullable()->after('work_card_attachment_path');
        });
    }

    public function down(): void
    {
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->dropColumn([
                'work_card_attachment_path',
                'work_card_attachment_original_name',
            ]);
        });
    }
};
