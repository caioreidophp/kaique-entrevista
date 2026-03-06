<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->text('children_situation')->nullable()->after('has_children');
        });
    }

    public function down(): void
    {
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->dropColumn('children_situation');
        });
    }
};
