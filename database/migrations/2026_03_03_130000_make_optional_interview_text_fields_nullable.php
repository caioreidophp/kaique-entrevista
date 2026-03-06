<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->text('truck_types_operated')->nullable()->change();
            $table->text('relevant_experience')->nullable()->change();
            $table->text('expectations_about_company')->nullable()->change();
            $table->text('posture_communication')->nullable()->change();
            $table->text('perceived_experience')->nullable()->change();
            $table->text('general_observations')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->text('truck_types_operated')->nullable(false)->change();
            $table->text('relevant_experience')->nullable(false)->change();
            $table->text('expectations_about_company')->nullable(false)->change();
            $table->text('posture_communication')->nullable(false)->change();
            $table->text('perceived_experience')->nullable(false)->change();
            $table->text('general_observations')->nullable(false)->change();
        });
    }
};
