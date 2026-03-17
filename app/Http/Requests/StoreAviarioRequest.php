<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAviarioRequest extends FormRequest
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
            'nome' => [
                'required',
                'string',
                'max:255',
                Rule::unique('aviarios')->where(function ($query): void {
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
