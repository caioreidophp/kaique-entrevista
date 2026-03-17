<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePensaoColaboradorRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->filled('valor')) {
            $this->merge(['valor' => $this->normalizeDecimalInput($this->input('valor'))]);
        }
    }

    private function normalizeDecimalInput(mixed $value): string
    {
        $raw = trim((string) $value);
        $clean = preg_replace('/[^0-9,.-]/', '', $raw) ?? '';

        if (str_contains($clean, ',')) {
            $clean = str_replace('.', '', $clean);
            $clean = str_replace(',', '.', $clean);
        } elseif (substr_count($clean, '.') > 1) {
            $lastDot = strrpos($clean, '.');

            if ($lastDot !== false) {
                $intPart = str_replace('.', '', substr($clean, 0, $lastDot));
                $decimalPart = substr($clean, $lastDot + 1);
                $clean = $intPart.'.'.$decimalPart;
            }
        }

        return $clean;
    }

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
            'nome_beneficiaria' => ['required', 'string', 'max:255'],
            'cpf_beneficiaria' => ['nullable', 'string', 'max:20'],
            'valor' => ['nullable', 'numeric', 'min:0'],
            'nome_banco' => ['required', 'string', 'max:120'],
            'numero_banco' => ['nullable', 'string', 'max:20'],
            'numero_agencia' => ['required', 'string', 'max:30'],
            'tipo_conta' => ['required', 'string', 'max:40'],
            'numero_conta' => ['required', 'string', 'max:40'],
            'tipo_chave_pix' => ['nullable', 'string', 'max:40'],
            'chave_pix' => ['nullable', 'string', 'max:255'],
            'observacao' => ['nullable', 'string'],
            'ativo' => ['sometimes', 'boolean'],
        ];
    }
}
