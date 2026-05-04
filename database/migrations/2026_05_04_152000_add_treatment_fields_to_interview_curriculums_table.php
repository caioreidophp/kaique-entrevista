<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('interview_curriculums', function (Blueprint $table): void {
            if (! Schema::hasColumn('interview_curriculums', 'interview_date')) {
                $table->date('interview_date')->nullable()->after('status');
            }

            if (! Schema::hasColumn('interview_curriculums', 'interview_time')) {
                $table->time('interview_time')->nullable()->after('interview_date');
            }

            if (! Schema::hasColumn('interview_curriculums', 'discard_reason')) {
                $table->text('discard_reason')->nullable()->after('interview_time');
            }

            if (! Schema::hasColumn('interview_curriculums', 'treatment_notes')) {
                $table->text('treatment_notes')->nullable()->after('discard_reason');
            }

            if (! Schema::hasColumn('interview_curriculums', 'treated_at')) {
                $table->timestamp('treated_at')->nullable()->after('treatment_notes');
            }

            if (! Schema::hasColumn('interview_curriculums', 'treated_by')) {
                $table->foreignId('treated_by')
                    ->nullable()
                    ->after('treated_at')
                    ->constrained('users')
                    ->nullOnDelete();
            }

            if (! Schema::hasColumn('interview_curriculums', 'confirmed_interview_date')) {
                $table->date('confirmed_interview_date')->nullable()->after('treated_by');
            }

            if (! Schema::hasColumn('interview_curriculums', 'confirmed_interview_time')) {
                $table->time('confirmed_interview_time')->nullable()->after('confirmed_interview_date');
            }

            if (! Schema::hasColumn('interview_curriculums', 'confirmation_notes')) {
                $table->text('confirmation_notes')->nullable()->after('confirmed_interview_time');
            }
        });

        Schema::table('interview_curriculums', function (Blueprint $table): void {
            $table->index(['status', 'interview_date'], 'interview_curriculums_status_interview_date_index');
        });
    }

    public function down(): void
    {
        Schema::table('interview_curriculums', function (Blueprint $table): void {
            $table->dropIndex('interview_curriculums_status_interview_date_index');
        });

        Schema::table('interview_curriculums', function (Blueprint $table): void {
            $columns = [
                'interview_date',
                'interview_time',
                'discard_reason',
                'treatment_notes',
                'treated_at',
                'treated_by',
                'confirmed_interview_date',
                'confirmed_interview_time',
                'confirmation_notes',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('interview_curriculums', $column)) {
                    if ($column === 'treated_by') {
                        $table->dropConstrainedForeignId($column);
                    } else {
                        $table->dropColumn($column);
                    }
                }
            }
        });
    }
};
