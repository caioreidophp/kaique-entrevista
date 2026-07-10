<?php

namespace App\Http\Requests;

use App\Models\FreightDisplacement;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFreightDisplacementRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'descricao' => $this->normalizeNullableText($this->input('descricao')),
            'placas' => $this->normalizeNullableText($this->input('placas')),
            'origem' => $this->normalizeNullableText($this->input('origem')),
            'destino' => $this->normalizeNullableText($this->input('destino')),
            'quantidade_caminhoes' => $this->parseLocalizedInteger($this->input('quantidade_caminhoes')),
            'km_aproximado' => $this->parseLocalizedNumber($this->input('km_aproximado')),
            'valor_aproximado' => $this->parseLocalizedNumber($this->input('valor_aproximado')),
            'status' => $this->normalizeStatus($this->input('status')),
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
            'descricao' => ['required', 'string'],
            'unidade_veiculos_id' => ['required', 'integer', 'exists:unidades,id'],
            'quantidade_caminhoes' => ['required', 'integer', 'min:0'],
            'placas' => ['nullable', 'string'],
            'origem' => ['required', 'string', 'max:255'],
            'destino' => ['required', 'string', 'max:255'],
            'km_aproximado' => ['required', 'numeric', 'min:0'],
            'valor_aproximado' => ['required', 'numeric', 'min:0'],
            'unidade_pagadora_id' => ['required', 'integer', 'exists:unidades,id'],
            'status' => ['required', Rule::in(FreightDisplacement::STATUSES)],
        ];
    }

    private function normalizeNullableText(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);

        return $text !== '' ? $text : null;
    }

    private function normalizeStatus(mixed $value): string
    {
        $status = strtolower(trim((string) $value));

        return $status !== '' ? $status : FreightDisplacement::STATUS_PENDENTE;
    }

    private function parseLocalizedInteger(mixed $value): ?int
    {
        $number = $this->parseLocalizedNumber($value);

        return $number === null ? null : (int) round($number);
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
        } elseif ($hasDot && preg_match('/^-?\d{1,3}(\.\d{3})+$/', $sanitized) === 1) {
            $sanitized = str_replace('.', '', $sanitized);
        }

        return is_numeric($sanitized) ? (float) $sanitized : null;
    }
}
