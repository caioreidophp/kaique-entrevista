<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('interview_curriculums', function (Blueprint $table): void {
            $table->index(['status', 'role_name'], 'interview_curriculums_status_role_index');
            $table->index(['status', 'unit_name'], 'interview_curriculums_status_unit_index');
        });
    }

    public function down(): void
    {
        Schema::table('interview_curriculums', function (Blueprint $table): void {
            $table->dropIndex('interview_curriculums_status_role_index');
            $table->dropIndex('interview_curriculums_status_unit_index');
        });
    }
};
