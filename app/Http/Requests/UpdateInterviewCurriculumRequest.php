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
        ];
    }
}
