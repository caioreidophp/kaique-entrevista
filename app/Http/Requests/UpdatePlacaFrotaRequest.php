<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePlacaFrotaRequest extends FormRequest
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
        $placaFrotaId = $this->route('placaFrota')?->id;

        return [
            'placa' => [
                'required',
                'string',
                'max:10',
                Rule::unique('placas_frota', 'placa')->ignore($placaFrotaId),
            ],
            'unidade_id' => ['required', 'integer', 'exists:unidades,id'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $placa = strtoupper((string) $this->input('placa'));
        $placa = preg_replace('/[^A-Z0-9]/', '', $placa) ?: '';

        $this->merge([
            'placa' => $placa,
        ]);

    }
}
