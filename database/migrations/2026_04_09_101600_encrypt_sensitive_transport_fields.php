<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        try {
            Schema::table('colaboradores', function (Blueprint $table): void {
                $table->dropUnique('colaboradores_cpf_unique');
            });
        } catch (Throwable) {
            // Index can already be absent in some environments.
        }

        Schema::table('colaboradores', function (Blueprint $table): void {
            if (! Schema::hasColumn('colaboradores', 'cpf_hash')) {
                $table->string('cpf_hash', 64)->nullable()->after('cpf');
            }

            $table->string('cpf', 255)->change();
            $table->string('rg', 255)->nullable()->change();
            $table->string('cnh', 255)->nullable()->change();
        });

        Schema::table('colaboradores', function (Blueprint $table): void {
            $table->unique('cpf_hash', 'colaboradores_cpf_hash_unique');
        });

        DB::table('colaboradores')
            ->select(['id', 'cpf'])
            ->orderBy('id')
            ->chunk(200, function ($rows): void {
                foreach ($rows as $row) {
                    $cpf = preg_replace('/\D+/', '', (string) ($row->cpf ?? ''));

                    DB::table('colaboradores')
                        ->where('id', (int) $row->id)
                        ->update([
                            'cpf_hash' => $cpf !== '' ? hash('sha256', $cpf) : null,
                        ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('colaboradores', function (Blueprint $table): void {
            try {
                $table->dropUnique('colaboradores_cpf_hash_unique');
            } catch (Throwable) {
                // Ignore if absent.
            }

            if (Schema::hasColumn('colaboradores', 'cpf_hash')) {
                $table->dropColumn('cpf_hash');
            }

            $table->string('cpf', 11)->change();
            $table->string('rg', 10)->nullable()->change();
            $table->string('cnh', 11)->nullable()->change();
            $table->unique('cpf', 'colaboradores_cpf_unique');
        });
    }
};
