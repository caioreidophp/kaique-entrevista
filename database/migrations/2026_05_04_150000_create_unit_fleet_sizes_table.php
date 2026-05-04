<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('unit_fleet_sizes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('unidade_id')
                ->constrained('unidades')
                ->cascadeOnUpdate()
                ->restrictOnDelete();
            $table->date('reference_month');
            $table->unsignedInteger('fleet_size');
            $table->timestamps();

            $table->unique(['unidade_id', 'reference_month'], 'unit_fleet_sizes_unit_month_unique');
            $table->index('reference_month');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('unit_fleet_sizes');
    }
};
