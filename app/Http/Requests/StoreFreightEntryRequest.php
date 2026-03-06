<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFreightEntryRequest extends FormRequest
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
            'data' => ['required', 'date'],
            'unidade_id' => ['required', 'integer', 'exists:unidades,id'],
            'frete_total' => ['required', 'numeric', 'min:0'],
            'cargas' => ['nullable', 'integer', 'min:0'],
            'aves' => ['nullable', 'integer', 'min:0'],
            'veiculos' => ['nullable', 'integer', 'min:0'],
            'km_rodado' => ['nullable', 'numeric', 'min:0'],
            'frete_terceiros' => ['nullable', 'numeric', 'min:0'],
            'viagens_terceiros' => ['nullable', 'integer', 'min:0'],
            'aves_terceiros' => ['nullable', 'integer', 'min:0'],
            'frete_liquido' => ['nullable', 'numeric', 'min:0'],
            'cargas_liq' => ['nullable', 'integer', 'min:0'],
            'aves_liq' => ['nullable', 'integer', 'min:0'],
            'kaique' => ['nullable', 'numeric', 'min:0'],
            'vdm' => ['nullable', 'numeric', 'min:0'],
            'frete_programado' => ['nullable', 'numeric', 'min:0'],
            'cargas_programadas' => ['nullable', 'integer', 'min:0'],
            'aves_programadas' => ['nullable', 'integer', 'min:0'],
            'cargas_canceladas_escaladas' => ['nullable', 'integer', 'min:0'],
            'nao_escaladas' => ['nullable', 'integer', 'min:0'],
            'placas' => ['nullable', 'string', 'max:255'],
            'obs' => ['nullable', 'string'],
        ];
    }
}
