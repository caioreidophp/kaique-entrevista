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
            $table->text('expectations_about_company')->nullable()->change();
            $table->text('last_company_observation')->nullable()->change();
            $table->text('previous_company_observation')->nullable()->change();
            $table->text('salary_observation')->nullable()->change();
            $table->string('last_exit_type', 20)->nullable()->change();
            $table->string('previous_exit_type', 20)->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->text('expectations_about_company')->nullable(false)->change();
            $table->text('last_company_observation')->nullable(false)->change();
            $table->text('previous_company_observation')->nullable(false)->change();
            $table->text('salary_observation')->nullable(false)->change();
            $table->string('last_exit_type', 20)->nullable(false)->change();
            $table->string('previous_exit_type', 20)->nullable(false)->change();
        });
    }
};
