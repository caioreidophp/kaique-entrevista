<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAviarioRequest extends FormRequest
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
        $aviarioId = $this->route('aviario')?->id;

        return [
            'nome' => [
                'required',
                'string',
                'max:255',
                Rule::unique('aviarios')->ignore($aviarioId)->where(function ($query): void {
                    $query
                        ->where('nome', trim((string) $this->input('nome')))
                        ->where('cidade', trim((string) $this->input('cidade')));
                }),
            ],
            'cidade' => ['required', 'string', 'max:255'],
            'km' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'nome' => trim((string) $this->input('nome')),
            'cidade' => trim((string) $this->input('cidade')),
            'km' => $this->input('km'),
        ]);

    }
}
