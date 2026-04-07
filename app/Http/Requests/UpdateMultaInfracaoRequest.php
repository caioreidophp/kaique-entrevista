<?php

namespace App\Http\Requests;

use App\Models\MultaInfracao;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMultaInfracaoRequest extends FormRequest
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
        /** @var MultaInfracao|null $infracao */
        $infracao = $this->route('infracaoMulta');

        return [
            'nome' => [
                'required',
                'string',
                'max:255',
                Rule::unique('multa_infracoes', 'nome')->ignore($infracao?->id),
            ],
            'ativo' => ['sometimes', 'boolean'],
        ];
    }
}
