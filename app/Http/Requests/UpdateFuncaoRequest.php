<?php

namespace App\Http\Requests;

use App\Models\Funcao;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateFuncaoRequest extends FormRequest
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
        /** @var Funcao|null $funcao */
        $funcao = $this->route('funcao');

        return [
            'nome' => [
                'required',
                'string',
                'max:255',
                Rule::unique('funcoes', 'nome')->ignore($funcao?->id),
            ],
            'descricao' => ['nullable', 'string'],
            'ativo' => ['sometimes', 'boolean'],
        ];
    }
}
