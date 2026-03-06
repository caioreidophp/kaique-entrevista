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
            ->select(['id', 'cpf', 'rg', 'phone'])
            ->orderBy('id')
            ->chunkById(200, function ($rows): void {
                foreach ($rows as $row) {
                    $cpf = preg_replace('/\D+/', '', (string) $row->cpf);
                    $phone = preg_replace('/\D+/', '', (string) $row->phone);
                    $rgInput = strtoupper((string) $row->rg);

                    $rg = '';
                    $lastIndex = strlen($rgInput) - 1;

                    for ($index = 0; $index <= $lastIndex; $index++) {
                        $char = $rgInput[$index] ?? '';

                        if (ctype_digit($char)) {
                            $rg .= $char;

                            continue;
                        }

                        if ($index === $lastIndex && ctype_alpha($char)) {
                            $rg .= $char;
                        }
                    }

                    DB::table('driver_interviews')
                        ->where('id', $row->id)
                        ->update([
                            'cpf' => substr($cpf, 0, 11),
                            'rg' => substr($rg, 0, 9),
                            'phone' => substr($phone, 0, 11),
                        ]);
                }
            });

        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->string('cpf', 11)->change();
            $table->string('rg', 9)->change();
            $table->string('phone', 11)->change();
            $table->text('general_observations')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('driver_interviews')
            ->whereNull('general_observations')
            ->update(['general_observations' => '']);

        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->string('cpf')->change();
            $table->string('rg')->change();
            $table->string('phone')->change();
            $table->text('general_observations')->nullable(false)->change();
        });
    }
};
