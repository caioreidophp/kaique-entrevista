<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('colaboradores', function (Blueprint $table): void {
            $table->text('cpf')->change();
            $table->text('rg')->nullable()->change();
            $table->text('cnh')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('colaboradores', function (Blueprint $table): void {
            $table->string('cpf', 255)->change();
            $table->string('rg', 255)->nullable()->change();
            $table->string('cnh', 255)->nullable()->change();
        });
    }
};
