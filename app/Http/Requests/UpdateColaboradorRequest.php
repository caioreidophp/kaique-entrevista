<?php

namespace App\Http\Requests;

use App\Models\Colaborador;
use Illuminate\Validation\Rule;

class UpdateColaboradorRequest extends StoreColaboradorRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Colaborador|null $colaborador */
        $colaborador = $this->route('colaborador');

        $rules = parent::rules();
        $rules['cpf'] = [
            'required',
            'string',
            'size:11',
            'regex:/^\d{11}$/',
            Rule::unique('colaboradores', 'cpf_hash')->ignore($colaborador?->id),
        ];

        return $rules;
    }
}
