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
            'tipo' => ['required', 'string', 'in:confirmado,previsao,passada'],
            'com_abono' => ['required', 'boolean'],
            'dias_ferias' => ['nullable', 'integer', 'in:20,30'],
            'data_inicio' => ['required', 'date'],
            'data_fim' => ['nullable', 'date', 'after_or_equal:data_inicio'],
            'periodo_aquisitivo_inicio' => ['nullable', 'date'],
            'periodo_aquisitivo_fim' => ['nullable', 'date', 'after_or_equal:periodo_aquisitivo_inicio'],
            'observacoes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
