<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('interview_curriculums', function (Blueprint $table): void {
            if (! Schema::hasIndex('interview_curriculums', 'interview_curriculums_status_role_unit_index')) {
                $table->index(['status', 'role_name', 'unit_name'], 'interview_curriculums_status_role_unit_index');
            }

            if (! Schema::hasIndex('interview_curriculums', 'interview_curriculums_role_name_index')) {
                $table->index('role_name', 'interview_curriculums_role_name_index');
            }

            if (! Schema::hasIndex('interview_curriculums', 'interview_curriculums_unit_name_index')) {
                $table->index('unit_name', 'interview_curriculums_unit_name_index');
            }
        });
    }

    public function down(): void
    {
        Schema::table('interview_curriculums', function (Blueprint $table): void {
            if (Schema::hasIndex('interview_curriculums', 'interview_curriculums_unit_name_index')) {
                $table->dropIndex('interview_curriculums_unit_name_index');
            }

            if (Schema::hasIndex('interview_curriculums', 'interview_curriculums_role_name_index')) {
                $table->dropIndex('interview_curriculums_role_name_index');
            }

            if (Schema::hasIndex('interview_curriculums', 'interview_curriculums_status_role_unit_index')) {
                $table->dropIndex('interview_curriculums_status_role_unit_index');
            }
        });
    }
};
