<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFreightSpotEntryRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'frete_spot' => $this->parseLocalizedNumber($this->input('frete_spot')),
            'km_rodado' => $this->parseLocalizedNumber($this->input('km_rodado')),
            'cargas' => $this->parseLocalizedInteger($this->input('cargas')),
            'aves' => $this->parseLocalizedInteger($this->input('aves')),
            'obs' => $this->filled('obs')
                ? trim((string) $this->input('obs'))
                : null,
        ]);
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
            'data' => ['required', 'date'],
            'unidade_origem_id' => ['required', 'integer', 'exists:unidades,id'],
            'frete_spot' => ['required', 'numeric', 'min:0'],
            'cargas' => ['nullable', 'integer', 'min:0'],
            'aves' => ['nullable', 'integer', 'min:0'],
            'km_rodado' => ['nullable', 'numeric', 'min:0'],
            'obs' => ['nullable', 'string'],
        ];
    }

    private function parseLocalizedInteger(mixed $value): ?int
    {
        $number = $this->parseLocalizedNumber($value);

        if ($number === null) {
            return null;
        }

        return (int) round($number);
    }

    private function parseLocalizedNumber(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_int($value) || is_float($value)) {
            return (float) $value;
        }

        $raw = preg_replace('/\s+/', '', (string) $value);

        if (! is_string($raw) || $raw === '') {
            return null;
        }

        $raw = preg_replace('/[^0-9,\.\-]/', '', $raw);

        if (! is_string($raw) || $raw === '') {
            return null;
        }

        $sanitized = preg_replace('/(?!^)-/', '', $raw);

        if (! is_string($sanitized) || $sanitized === '') {
            return null;
        }

        $hasComma = str_contains($sanitized, ',');
        $hasDot = str_contains($sanitized, '.');

        if ($hasComma && $hasDot) {
            $lastComma = strrpos($sanitized, ',');
            $lastDot = strrpos($sanitized, '.');

            if ($lastComma !== false && $lastDot !== false && $lastComma > $lastDot) {
                $sanitized = str_replace('.', '', $sanitized);
                $sanitized = str_replace(',', '.', $sanitized);
            } else {
                $sanitized = str_replace(',', '', $sanitized);
            }
        } elseif ($hasComma) {
            if (preg_match('/^-?\d{1,3}(,\d{3})+$/', $sanitized) === 1) {
                $sanitized = str_replace(',', '', $sanitized);
            } else {
                $sanitized = str_replace(',', '.', $sanitized);
            }
        } elseif ($hasDot) {
            if (
                preg_match('/^-?\d{1,3}(\.\d{3})+$/', $sanitized) === 1
                || preg_match('/^-?\d+\.\d{3}$/', $sanitized) === 1
            ) {
                $sanitized = str_replace('.', '', $sanitized);
            }
        }

        if (is_numeric($sanitized)) {
            return (float) $sanitized;
        }

        $digitsOnly = preg_replace('/\D/', '', $sanitized);

        if (! is_string($digitsOnly) || $digitsOnly === '') {
            return null;
        }

        return (float) $digitsOnly;
    }
}
