<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFreightSpotEntryRequest extends FormRequest
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
            'unidade_origem_id' => ['required', 'integer', 'exists:unidades,id'],
            'frete_spot' => ['required', 'numeric', 'min:0'],
            'cargas' => ['nullable', 'integer', 'min:0'],
            'aves' => ['nullable', 'integer', 'min:0'],
            'km_rodado' => ['nullable', 'numeric', 'min:0'],
            'obs' => ['nullable', 'string'],
        ];
    }
}
