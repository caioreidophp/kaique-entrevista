<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFuncaoRequest extends FormRequest
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
            'nome' => ['required', 'string', 'max:255', Rule::unique('funcoes', 'nome')],
            'descricao' => ['nullable', 'string'],
            'ativo' => ['sometimes', 'boolean'],
        ];
    }
}
