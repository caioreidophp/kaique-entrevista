<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MarkInterviewAsHiredRequest extends FormRequest
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
            'foi_contratado' => ['required', 'boolean'],
            'colaborador_id' => ['nullable', 'integer', 'exists:colaboradores,id'],
        ];
    }
}
