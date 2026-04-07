<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('interview_curriculums', function (Blueprint $table): void {
            $table->string('observacao', 500)->nullable()->after('unit_name');
        });
    }

    public function down(): void
    {
        Schema::table('interview_curriculums', function (Blueprint $table): void {
            $table->dropColumn('observacao');
        });
    }
};
