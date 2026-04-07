<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('interview_curriculums', function (Blueprint $table): void {
            $table->string('phone', 40)->nullable()->after('full_name');
            $table->string('role_name', 120)->nullable()->after('phone');
            $table->string('unit_name', 120)->nullable()->after('role_name');
        });
    }

    public function down(): void
    {
        Schema::table('interview_curriculums', function (Blueprint $table): void {
            $table->dropColumn(['phone', 'role_name', 'unit_name']);
        });
    }
};
