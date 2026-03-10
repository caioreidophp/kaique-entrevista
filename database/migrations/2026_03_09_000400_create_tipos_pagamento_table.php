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
        Schema::create('tipos_pagamento', function (Blueprint $table): void {
            $table->id();
            $table->string('nome')->unique();
            $table->boolean('gera_encargos')->default(false);
            $table->string('categoria', 30);
            $table->string('forma_pagamento', 30);
            $table->timestamps();
            $table->softDeletes();

            $table->index('categoria');
            $table->index('forma_pagamento');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tipos_pagamento');
    }
};
