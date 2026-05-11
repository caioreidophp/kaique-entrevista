<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->text('cpf')->change();
            $table->text('rg')->change();
            $table->text('cnh_number')->change();
        });
    }

    public function down(): void
    {
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->string('cpf', 11)->change();
            $table->string('rg', 30)->change();
            $table->string('cnh_number', 9)->change();
        });
    }
};
