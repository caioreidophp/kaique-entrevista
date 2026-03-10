<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTipoPagamentoRequest extends FormRequest
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
            'nome' => ['required', 'string', 'max:255', Rule::unique('tipos_pagamento', 'nome')],
            'gera_encargos' => ['required', 'boolean'],
            'categoria' => ['required', Rule::in(['salario', 'beneficios', 'extras'])],
            'forma_pagamento' => ['required', Rule::in(['deposito', 'cartao_vr', 'cartao_va', 'dinheiro'])],
        ];
    }
}
