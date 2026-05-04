<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('unidades', function (Blueprint $table): void {
            if (! Schema::hasColumn('unidades', 'ativo')) {
                $table->boolean('ativo')->default(true)->after('slug');
            }
        });

        if (Schema::hasColumn('unidades', 'ativo')) {
            DB::table('unidades')->update(['ativo' => true]);
        }
    }

    public function down(): void
    {
        Schema::table('unidades', function (Blueprint $table): void {
            if (Schema::hasColumn('unidades', 'ativo')) {
                $table->dropColumn('ativo');
            }
        });
    }
};
