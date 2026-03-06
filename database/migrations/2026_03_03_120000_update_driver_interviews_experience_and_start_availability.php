<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->string('last_company')->nullable()->change();
            $table->string('last_role')->nullable()->change();
            $table->string('last_city')->nullable()->change();
            $table->date('last_period_start')->nullable()->change();
            $table->date('last_period_end')->nullable()->change();
            $table->string('last_exit_reason')->nullable()->change();

            $table->string('previous_company')->nullable()->change();
            $table->string('previous_role')->nullable()->change();
            $table->string('previous_city')->nullable()->change();
            $table->date('previous_period_start')->nullable()->change();
            $table->date('previous_period_end')->nullable()->change();
            $table->string('previous_exit_reason')->nullable()->change();

            $table->text('relevant_experience')->nullable()->change();

            $table->date('start_availability_date')->nullable()->change();
            $table->string('start_availability_note', 100)->nullable()->after('start_availability_date');

            $table->string('other_company')->nullable()->after('previous_exit_reason');
            $table->string('other_role')->nullable()->after('other_company');
            $table->string('other_city')->nullable()->after('other_role');
            $table->date('other_period_start')->nullable()->after('other_city');
            $table->date('other_period_end')->nullable()->after('other_period_start');
            $table->string('other_exit_reason')->nullable()->after('other_period_end');
        });
    }

    public function down(): void
    {
        Schema::table('driver_interviews', function (Blueprint $table): void {
            $table->dropColumn([
                'start_availability_note',
                'other_company',
                'other_role',
                'other_city',
                'other_period_start',
                'other_period_end',
                'other_exit_reason',
            ]);

            $table->string('last_company')->nullable(false)->change();
            $table->string('last_role')->nullable(false)->change();
            $table->string('last_city')->nullable(false)->change();
            $table->date('last_period_start')->nullable(false)->change();
            $table->date('last_period_end')->nullable(false)->change();
            $table->string('last_exit_reason')->nullable(false)->change();

            $table->string('previous_company')->nullable(false)->change();
            $table->string('previous_role')->nullable(false)->change();
            $table->string('previous_city')->nullable(false)->change();
            $table->date('previous_period_start')->nullable(false)->change();
            $table->date('previous_period_end')->nullable(false)->change();
            $table->string('previous_exit_reason')->nullable(false)->change();

            $table->text('relevant_experience')->nullable(false)->change();

            $table->date('start_availability_date')->nullable(false)->change();
        });
    }
};
