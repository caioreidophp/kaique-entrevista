<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreEmprestimoColaboradorRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        foreach (['valor_total', 'valor_parcela'] as $field) {
            if ($this->filled($field)) {
                $this->merge([$field => $this->normalizeDecimalInput($this->input($field))]);
            }
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
            'valor_total' => ['required', 'numeric', 'min:0.01'],
            'valor_parcela' => ['required', 'numeric', 'min:0.01'],
            'total_parcelas' => ['required', 'integer', 'min:1', 'max:120'],
            'parcelas_pagas' => ['nullable', 'integer', 'min:0', 'max:120'],
            'data_inicio' => ['required', 'date'],
            'ativo' => ['required', 'boolean'],
        ];
    }
}
