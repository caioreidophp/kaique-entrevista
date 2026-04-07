<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('colaboradores')->update(['sexo' => 'M']);
    }

    public function down(): void
    {
        DB::table('colaboradores')->where('sexo', 'M')->update(['sexo' => null]);
    }
};
