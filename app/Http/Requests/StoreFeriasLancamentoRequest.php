<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFeriasLancamentoRequest extends FormRequest
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
            'colaborador_id' => ['required', 'integer', 'exists:colaboradores,id'],
            'com_abono' => ['required', 'boolean'],
            'data_inicio' => ['required', 'date'],
            'data_fim' => ['nullable', 'date', 'after_or_equal:data_inicio'],
            'periodo_aquisitivo_inicio' => ['required', 'date'],
            'periodo_aquisitivo_fim' => ['required', 'date', 'after_or_equal:periodo_aquisitivo_inicio'],
        ];
    }
}
