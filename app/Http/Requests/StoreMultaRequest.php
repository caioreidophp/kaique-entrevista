<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMultaRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (! $this->has('valor')) {
            return;
        }

        $this->merge([
            'valor' => $this->normalizeDecimalInput($this->input('valor')),
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
        $isNotification = $this->input('tipo_registro', 'multa') === 'notificacao';

        return [
            'tipo_registro' => ['nullable', Rule::in(['multa', 'notificacao'])],
            'data' => ['required', 'date_format:Y-m-d'],
            'hora' => ['required', 'date_format:H:i'],
            'placa_frota_id' => ['required', 'integer', 'exists:placas_frota,id'],
            'multa_infracao_id' => ['required', 'integer', 'exists:multa_infracoes,id'],
            'descricao' => ['nullable', 'string'],
            'numero_auto_infracao' => ['nullable', 'string', 'max:120'],
            'multa_orgao_autuador_id' => ['required', 'integer', 'exists:multa_orgaos_autuadores,id'],
            'colaborador_id' => [$isNotification ? 'nullable' : 'required', 'integer', 'exists:colaboradores,id'],
            'indicado_condutor' => [$isNotification ? 'nullable' : 'required', 'boolean'],
            'culpa' => [$isNotification ? 'nullable' : 'required', Rule::in(['empresa', 'motorista'])],
            'valor' => [$isNotification ? 'nullable' : 'required', 'numeric', 'min:0'],
            'tipo_valor' => [$isNotification ? 'nullable' : 'required', Rule::in(['normal', '20_percent', '40_percent'])],
            'vencimento' => [$isNotification ? 'nullable' : 'required', 'date_format:Y-m-d'],
            'status' => ['required', Rule::in(['aguardando_motorista', 'solicitado_boleto', 'boleto_ok', 'pago'])],
            'descontar' => [$isNotification ? 'nullable' : 'required', 'boolean'],
        ];
    }

    private function normalizeDecimalInput(mixed $value): mixed
    {
        if (! is_string($value)) {
            return $value;
        }

        $normalized = trim($value);

        if ($normalized === '') {
            return $value;
        }

        $normalized = str_replace(["\u{00A0}", ' '], '', $normalized);
        $normalized = preg_replace('/[^0-9,\.\-]/', '', $normalized) ?? $normalized;

        $lastComma = strrpos($normalized, ',');
        $lastDot = strrpos($normalized, '.');

        if ($lastComma !== false && $lastDot !== false) {
            if ($lastComma > $lastDot) {
                $normalized = str_replace('.', '', $normalized);
                $normalized = str_replace(',', '.', $normalized);
            } else {
                $normalized = str_replace(',', '', $normalized);
            }
        } elseif ($lastComma !== false) {
            $normalized = str_replace('.', '', $normalized);
            $normalized = str_replace(',', '.', $normalized);
        }

        return $normalized;
    }
}
