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
        Schema::create('driver_interviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            $table->string('full_name');
            $table->string('preferred_name');
            $table->string('phone');
            $table->string('email');
            $table->string('city');
            $table->string('marital_status');
            $table->boolean('has_children');

            $table->string('cpf');
            $table->string('rg');
            $table->string('cnh_number');
            $table->string('cnh_category', 10);
            $table->date('cnh_expiration_date');
            $table->boolean('ear');

            $table->string('last_company');
            $table->string('last_role');
            $table->string('last_city');
            $table->date('last_period_start');
            $table->date('last_period_end');
            $table->string('last_exit_reason');

            $table->string('previous_company');
            $table->string('previous_role');
            $table->string('previous_city');
            $table->date('previous_period_start');
            $table->date('previous_period_end');
            $table->string('previous_exit_reason');
            $table->text('relevant_experience');

            $table->text('truck_types_operated');
            $table->boolean('night_shift_experience');
            $table->boolean('live_animals_transport_experience');
            $table->boolean('accident_history');
            $table->text('accident_details')->nullable();

            $table->string('schedule_availability');
            $table->date('start_availability_date');
            $table->boolean('knows_company_contact');
            $table->string('contact_name')->nullable();
            $table->text('expectations_about_company');

            $table->decimal('last_salary', 10, 2);
            $table->decimal('salary_expectation', 10, 2);

            $table->text('posture_communication');
            $table->text('perceived_experience');
            $table->text('general_observations');
            $table->enum('candidate_interest', ['baixo', 'medio', 'alto']);
            $table->boolean('availability_matches');
            $table->unsignedTinyInteger('overall_score');
            $table->enum('hr_status', ['aprovado', 'banco_de_talentos', 'reprovado', 'requer_atencao']);

            $table->timestamps();
            $table->softDeletes();

            $table->index('full_name');
            $table->index('hr_status');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('driver_interviews');
    }
};
