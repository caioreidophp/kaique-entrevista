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
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->text('hr_rejection_reason')->nullable()->after('hr_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->dropColumn('hr_rejection_reason');
        });
    }
};
