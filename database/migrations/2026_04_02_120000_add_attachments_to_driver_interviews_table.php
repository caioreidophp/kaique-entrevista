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
            $table->string('candidate_photo_path')->nullable()->after('cnh_expiration_date');
            $table->string('candidate_photo_original_name')->nullable()->after('candidate_photo_path');
            $table->string('cnh_attachment_path')->nullable()->after('candidate_photo_original_name');
            $table->string('cnh_attachment_original_name')->nullable()->after('cnh_attachment_path');
            $table->string('curriculum_path')->nullable()->after('cnh_attachment_original_name');
            $table->string('curriculum_original_name')->nullable()->after('curriculum_path');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->dropColumn([
                'candidate_photo_path',
                'candidate_photo_original_name',
                'cnh_attachment_path',
                'cnh_attachment_original_name',
                'curriculum_path',
                'curriculum_original_name',
            ]);
        });
    }
};
