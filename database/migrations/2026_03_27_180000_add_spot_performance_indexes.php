<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('freight_spot_entries', function (Blueprint $table): void {
            $table->index(['data', 'id'], 'freight_spot_entries_data_id_idx');
            $table->index(['unidade_origem_id', 'data', 'id'], 'freight_spot_entries_unidade_data_id_idx');
        });
    }

    public function down(): void
    {
        Schema::table('freight_spot_entries', function (Blueprint $table): void {
            $table->dropIndex('freight_spot_entries_data_id_idx');
            $table->dropIndex('freight_spot_entries_unidade_data_id_idx');
        });
    }
};
