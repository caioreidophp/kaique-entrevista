<?php

namespace App\Http\Requests;

use App\Enums\CandidateInterest;
use App\Enums\HrStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDriverInterviewRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $cpf = preg_replace('/[\.\-\s]+/', '', (string) $this->input('cpf', ''));
        $phone = preg_replace('/[\(\)\-\s]+/', '', (string) $this->input('phone', ''));
        $rgSanitized = strtoupper(
            preg_replace('/[^0-9A-Za-z]+/', '', (string) $this->input('rg', ''))
        );
        $cnhNumber = preg_replace('/\D+/', '', (string) $this->input('cnh_number', ''));
        $cnhCategory = strtoupper(
            preg_replace('/[^A-Za-z]+/', '', (string) $this->input('cnh_category', ''))
        );

        $this->merge([
            'cpf' => $cpf,
            'phone' => $phone,
            'rg' => $rgSanitized,
            'cnh_number' => $cnhNumber,
            'cnh_category' => $cnhCategory,
            'cargo_pretendido' => $this->filled('cargo_pretendido')
                ? trim((string) $this->input('cargo_pretendido'))
                : null,
            'children_situation' => $this->filled('children_situation')
                ? trim((string) $this->input('children_situation'))
                : null,
            'other_company' => $this->filled('other_company')
                ? trim((string) $this->input('other_company'))
                : null,
            'other_role' => $this->filled('other_role')
                ? trim((string) $this->input('other_role'))
                : null,
            'other_city' => $this->filled('other_city')
                ? trim((string) $this->input('other_city'))
                : null,
            'other_exit_reason' => $this->filled('other_exit_reason')
                ? trim((string) $this->input('other_exit_reason'))
                : null,
            'last_company_observation' => $this->filled('last_company_observation')
                ? trim((string) $this->input('last_company_observation'))
                : null,
            'previous_company_observation' => $this->filled('previous_company_observation')
                ? trim((string) $this->input('previous_company_observation'))
                : null,
            'salary_observation' => $this->filled('salary_observation')
                ? trim((string) $this->input('salary_observation'))
                : null,
            'hr_rejection_reason' => $this->filled('hr_rejection_reason')
                ? trim((string) $this->input('hr_rejection_reason'))
                : null,
            'start_availability_note' => $this->filled('start_availability_note')
                ? trim((string) $this->input('start_availability_note'))
                : null,
            'relevant_experience' => $this->filled('relevant_experience')
                ? trim((string) $this->input('relevant_experience'))
                : null,
            'expectations_about_company' => $this->filled('expectations_about_company')
                ? trim((string) $this->input('expectations_about_company'))
                : null,
            'posture_communication' => $this->filled('posture_communication')
                ? trim((string) $this->input('posture_communication'))
                : null,
            'perceived_experience' => $this->filled('perceived_experience')
                ? trim((string) $this->input('perceived_experience'))
                : null,
            'general_observations' => $this->filled('general_observations')
                ? trim((string) $this->input('general_observations'))
                : null,
        ]);
    }

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return $this->baseRules();
    }

    /**
     * @return array<string, mixed>
     */
    protected function baseRules(): array
    {
        return [
            'full_name' => ['required', 'string', 'max:255'],
            'preferred_name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'size:11', 'regex:/^\d{11}$/'],
            'email' => ['required', 'email', 'max:255'],
            'city' => ['required', 'string', 'max:255'],
            'cargo_pretendido' => ['nullable', 'string', 'max:255'],
            'hiring_unidade_id' => ['nullable', 'integer', 'exists:unidades,id'],
            'marital_status' => ['required', 'string', 'max:100'],
            'has_children' => ['required', 'boolean'],
            'children_situation' => ['nullable', 'string'],

            'cpf' => ['required', 'string', 'size:11', 'regex:/^\d{11}$/'],
            'rg' => ['required', 'string', 'min:3', 'max:30', 'regex:/^[0-9A-Z]+$/'],
            'cnh_number' => ['required', 'string', 'size:11', 'regex:/^\d{11}$/'],
            'cnh_category' => ['required', 'string', 'min:1', 'max:2', 'regex:/^[A-Z]{1,2}$/'],
            'cnh_expiration_date' => ['required', 'date'],
            'ear' => ['required', 'boolean'],

            'last_company' => ['nullable', 'string', 'max:255'],
            'last_role' => ['nullable', 'string', 'max:255'],
            'last_city' => ['nullable', 'string', 'max:255'],
            'last_period_start' => ['nullable', 'date'],
            'last_period_end' => ['nullable', 'date'],
            'last_exit_type' => ['nullable', Rule::in(['pedido', 'despensa'])],
            'last_exit_reason' => ['nullable', 'string', 'max:255'],
            'last_company_observation' => ['nullable', 'string'],

            'previous_company' => ['nullable', 'string', 'max:255'],
            'previous_role' => ['nullable', 'string', 'max:255'],
            'previous_city' => ['nullable', 'string', 'max:255'],
            'previous_period_start' => ['nullable', 'date'],
            'previous_period_end' => ['nullable', 'date'],
            'previous_exit_type' => ['nullable', Rule::in(['pedido', 'despensa'])],
            'previous_exit_reason' => ['nullable', 'string', 'max:255'],
            'previous_company_observation' => ['nullable', 'string'],
            'other_company' => ['nullable', 'string', 'max:255'],
            'other_role' => ['nullable', 'string', 'max:255'],
            'other_city' => ['nullable', 'string', 'max:255'],
            'other_period_start' => ['nullable', 'date'],
            'other_period_end' => ['nullable', 'date'],
            'other_exit_reason' => ['nullable', 'string', 'max:255'],
            'relevant_experience' => ['nullable', 'string'],

            'truck_types_operated' => ['nullable', 'string'],
            'night_shift_experience' => ['required', 'boolean'],
            'live_animals_transport_experience' => ['required', 'boolean'],
            'accident_history' => ['required', 'boolean'],
            'accident_details' => ['nullable', 'required_if:accident_history,true', 'string'],

            'schedule_availability' => ['required', 'string', 'max:255'],
            'start_availability_date' => ['nullable', 'date'],
            'start_availability_note' => ['nullable', 'string', 'max:100'],
            'knows_company_contact' => ['required', 'boolean'],
            'contact_name' => ['nullable', 'required_if:knows_company_contact,true', 'string', 'max:255'],
            'expectations_about_company' => ['nullable', 'string'],

            'last_salary' => ['required', 'numeric', 'min:0'],
            'salary_expectation' => ['required', 'numeric', 'min:0'],
            'salary_observation' => ['nullable', 'string'],

            'posture_communication' => ['nullable', 'string'],
            'perceived_experience' => ['nullable', 'string'],
            'general_observations' => ['nullable', 'string'],
            'candidate_interest' => ['required', Rule::in(array_column(CandidateInterest::cases(), 'value'))],
            'availability_matches' => ['required', 'boolean'],
            'overall_score' => ['required', 'numeric', 'between:0,10', 'multiple_of:0.5'],
            'hr_status' => ['required', Rule::in(array_column(HrStatus::cases(), 'value'))],
            'hr_rejection_reason' => ['nullable', 'string', 'max:2000'],
            'guep_status' => ['prohibited'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'required' => 'O campo :attribute é obrigatório.',
            'required_if' => 'O campo :attribute é obrigatório.',
            'string' => 'O campo :attribute deve ser um texto.',
            'date' => 'O campo :attribute deve ser uma data válida.',
            'email' => 'O campo :attribute deve ser um e-mail válido.',
            'numeric' => 'O campo :attribute deve ser um número.',
            'min.string' => 'O campo :attribute deve ter no mínimo :min caracteres.',
            'max.string' => 'O campo :attribute deve ter no máximo :max caracteres.',
            'between.numeric' => 'O campo :attribute deve estar entre :min e :max.',
            'after_or_equal' => 'O campo :attribute deve ser uma data posterior ou igual a :date.',
            'cpf.size' => 'CPF deve conter exatamente 11 dígitos.',
            'cpf.regex' => 'CPF deve conter apenas números.',
            'rg.min' => 'RG deve conter no mínimo 3 caracteres.',
            'rg.max' => 'RG deve conter no máximo 30 caracteres.',
            'rg.regex' => 'RG deve conter apenas letras e números.',
            'phone.size' => 'Telefone deve conter exatamente 11 dígitos.',
            'phone.regex' => 'Telefone deve conter apenas números.',
            'cnh_number.size' => 'CNH deve conter exatamente 11 dígitos.',
            'cnh_number.regex' => 'CNH deve conter apenas números.',
            'cnh_category.min' => 'Categoria da CNH deve conter no mínimo 1 letra.',
            'cnh_category.max' => 'Categoria da CNH deve conter no máximo 2 letras.',
            'cnh_category.regex' => 'Categoria da CNH deve conter de 1 a 2 letras.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'full_name' => 'nome completo',
            'preferred_name' => 'como prefere ser chamado',
            'phone' => 'telefone',
            'email' => 'e-mail',
            'city' => 'cidade',
            'cargo_pretendido' => 'cargo pretendido',
            'marital_status' => 'estado civil',
            'has_children' => 'possui filhos',
            'children_situation' => 'situação dos filhos',
            'cpf' => 'CPF',
            'rg' => 'RG',
            'cnh_number' => 'número da CNH',
            'cnh_category' => 'categoria da CNH',
            'cnh_expiration_date' => 'validade da CNH',
            'ear' => 'EAR',
            'night_shift_experience' => 'experiência no turno noturno',
            'live_animals_transport_experience' => 'experiência com transporte de animais vivos',
            'accident_history' => 'histórico de acidentes',
            'accident_details' => 'detalhes do acidente',
            'schedule_availability' => 'disponibilidade de horário',
            'start_availability_date' => 'data de disponibilidade',
            'start_availability_note' => 'observação de disponibilidade',
            'knows_company_contact' => 'conhece alguém na empresa',
            'contact_name' => 'nome do contato',
            'last_salary' => 'último salário',
            'salary_expectation' => 'pretensão salarial',
            'salary_observation' => 'observação salarial',
            'candidate_interest' => 'interesse do candidato',
            'availability_matches' => 'disponibilidade compatível',
            'overall_score' => 'nota geral',
            'hr_status' => 'status RH',
            'hr_rejection_reason' => 'motivo da reprovação',
            'hiring_unidade_id' => 'unidade de contratação',
        ];
    }
}
