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
            $table->string('last_exit_type', 20)->nullable()->after('last_period_end');
            $table->text('last_company_observation')->nullable()->after('last_exit_reason');
            $table->string('previous_exit_type', 20)->nullable()->after('previous_period_end');
            $table->text('previous_company_observation')->nullable()->after('previous_exit_reason');
            $table->text('salary_observation')->nullable()->after('salary_expectation');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->dropColumn([
                'last_exit_type',
                'last_company_observation',
                'previous_exit_type',
                'previous_company_observation',
                'salary_observation',
            ]);
        });
    }
};
