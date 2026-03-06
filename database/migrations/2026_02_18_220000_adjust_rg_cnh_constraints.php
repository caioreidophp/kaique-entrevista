<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('driver_interviews')
            ->select(['id', 'rg', 'cnh_number', 'cnh_category'])
            ->orderBy('id')
            ->chunkById(200, function ($rows): void {
                foreach ($rows as $row) {
                    $rgRaw = strtoupper((string) $row->rg);
                    $rgAlnum = preg_replace('/[^0-9A-Z]+/', '', $rgRaw);
                    $rgDigits = preg_replace('/\D+/', '', $rgAlnum);
                    $rgPrefix = substr($rgDigits, 0, 9);
                    $rgLast = '';

                    if ($rgAlnum !== '') {
                        $lastChar = substr($rgAlnum, -1);

                        if ($lastChar !== false && (ctype_digit($lastChar) || ctype_alpha($lastChar))) {
                            $rgLast = $lastChar;
                        }
                    }

                    $cnhNumber = substr(
                        preg_replace('/\D+/', '', (string) $row->cnh_number),
                        0,
                        9
                    );

                    $cnhCategory = substr(
                        strtoupper(preg_replace('/[^A-Za-z]+/', '', (string) $row->cnh_category)),
                        0,
                        2
                    );

                    DB::table('driver_interviews')
                        ->where('id', $row->id)
                        ->update([
                            'rg' => substr("{$rgPrefix}{$rgLast}", 0, 10),
                            'cnh_number' => $cnhNumber,
                            'cnh_category' => $cnhCategory,
                        ]);
                }
            });

        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->string('rg', 10)->change();
            $table->string('cnh_number', 9)->change();
            $table->string('cnh_category', 2)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->string('rg', 9)->change();
            $table->string('cnh_number')->change();
            $table->string('cnh_category', 10)->change();
        });
    }
};
