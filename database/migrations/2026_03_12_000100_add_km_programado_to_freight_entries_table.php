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
        Schema::table('freight_entries', function (Blueprint $table): void {
            $table->decimal('km_programado', 14, 2)
                ->default(0)
                ->after('frete_programado');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('freight_entries', function (Blueprint $table): void {
            $table->dropColumn('km_programado');
        });
    }
};
