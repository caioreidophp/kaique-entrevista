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
        Schema::create('freight_spot_entries', function (Blueprint $table): void {
            $table->id();
            $table->date('data');
            $table->foreignId('unidade_origem_id')->constrained('unidades')->restrictOnDelete();
            $table->foreignId('autor_id')->constrained('users')->restrictOnDelete();
            $table->decimal('frete_spot', 14, 2);
            $table->unsignedInteger('cargas')->default(0);
            $table->unsignedBigInteger('aves')->default(0);
            $table->decimal('km_rodado', 14, 2)->default(0);
            $table->text('obs')->nullable();
            $table->timestamps();

            $table->index(['data', 'unidade_origem_id']);
            $table->index(['autor_id', 'data']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('freight_spot_entries');
    }
};
