<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateInterviewCurriculumRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'full_name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:40'],
            'role_name' => ['required', 'string', 'max:120'],
            'unit_name' => ['required', 'string', 'max:120'],
            'observacao' => ['nullable', 'string', 'max:500'],
            'status' => [
                'nullable',
                'string',
                'in:pendente,convocado_entrevista,descartado,recusado,aguardando_entrevista,aprovado_entrevista,reprovado_entrevista',
            ],
            'interview_date' => [
                'nullable',
                'date',
                'required_if:status,convocado_entrevista,aguardando_entrevista,aprovado_entrevista',
            ],
            'interview_time' => ['nullable', 'date_format:H:i'],
            'discard_reason' => [
                'nullable',
                'string',
                'max:1000',
                'required_if:status,descartado,recusado,reprovado_entrevista',
            ],
            'treatment_notes' => ['nullable', 'string', 'max:1000'],
            'confirmed_interview_date' => ['nullable', 'date'],
            'confirmed_interview_time' => ['nullable', 'date_format:H:i'],
            'confirmation_notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'full_name.required' => 'O nome do candidato é obrigatório.',
            'phone.required' => 'O telefone é obrigatório.',
            'role_name.required' => 'A função é obrigatória.',
            'unit_name.required' => 'A unidade é obrigatória.',
            'interview_date.required_if' => 'Informe a data da entrevista ao convocar o candidato.',
            'discard_reason.required_if' => 'Informe o motivo ao descartar o candidato.',
        ];
    }
}
