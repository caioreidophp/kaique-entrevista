<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDescontoColaboradorRequest extends FormRequest
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
            'descricao' => ['required', 'string', 'max:255'],
            'tipo_saida' => ['required', Rule::in(['extras', 'salario', 'beneficios', 'direto'])],
            'forma_pagamento' => ['required', Rule::in(['dinheiro', 'pix', 'desconto_folha'])],
            'valor' => ['required', 'numeric', 'min:0.01'],
            'parcelado' => ['required', 'boolean'],
            'total_parcelas' => ['nullable', 'integer', 'min:2', 'max:120'],
            'parcela_atual' => ['nullable', 'integer', 'min:1', 'max:120'],
            'data_referencia' => ['nullable', 'date'],
        ];
    }
}
