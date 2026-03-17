<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreFreightEntryRequest extends FormRequest
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
            'data' => ['required', 'date'],
            'unidade_id' => ['required', 'integer', 'exists:unidades,id'],
            'frete_total' => ['nullable', 'numeric', 'min:0'],
            'cargas' => ['nullable', 'integer', 'min:0'],
            'aves' => ['nullable', 'integer', 'min:0'],
            'veiculos' => ['nullable', 'integer', 'min:0'],
            'km_rodado' => ['nullable', 'numeric', 'min:0'],
            'km_terceiros' => ['nullable', 'numeric', 'min:0'],
            'frete_terceiros' => ['nullable', 'numeric', 'min:0'],
            'viagens_terceiros' => ['nullable', 'integer', 'min:0'],
            'aves_terceiros' => ['nullable', 'integer', 'min:0'],
            'frete_liquido' => ['nullable', 'numeric', 'min:0'],
            'cargas_liq' => ['nullable', 'integer', 'min:0'],
            'aves_liq' => ['nullable', 'integer', 'min:0'],
            'kaique' => ['nullable', 'numeric', 'min:0'],
            'vdm' => ['nullable', 'numeric', 'min:0'],
            'frete_programado' => ['nullable', 'numeric', 'min:0'],
            'km_programado' => ['nullable', 'numeric', 'min:0'],
            'cargas_programadas' => ['nullable', 'integer', 'min:0'],
            'aves_programadas' => ['nullable', 'integer', 'min:0'],
            'cargas_canceladas_escaladas' => ['nullable', 'integer', 'min:0'],
            'nao_escaladas' => ['nullable', 'integer', 'min:0'],
            'placas' => ['nullable', 'string', 'max:255'],
            'obs' => ['nullable', 'string'],
            'cargas_canceladas_detalhes' => ['nullable', 'array'],
            'cargas_canceladas_detalhes.*.placa' => ['nullable', 'string', 'max:20'],
            'cargas_canceladas_detalhes.*.aviario' => ['nullable', 'string', 'max:255'],
            'cargas_canceladas_detalhes.*.valor' => ['nullable', 'numeric', 'min:0'],
            'cargas_canceladas_detalhes.*.obs' => ['nullable', 'string'],

            'programado_frete' => ['nullable', 'numeric', 'min:0'],
            'programado_viagens' => ['nullable', 'integer', 'min:0'],
            'programado_aves' => ['nullable', 'integer', 'min:0'],
            'programado_km' => ['nullable', 'numeric', 'min:0'],

            'kaique_geral_frete' => ['nullable', 'numeric', 'min:0'],
            'kaique_geral_viagens' => ['nullable', 'integer', 'min:0'],
            'kaique_geral_aves' => ['nullable', 'integer', 'min:0'],
            'kaique_geral_km' => ['nullable', 'numeric', 'min:0'],

            'terceiros_frete' => ['nullable', 'numeric', 'min:0'],
            'terceiros_viagens' => ['nullable', 'integer', 'min:0'],
            'terceiros_aves' => ['nullable', 'integer', 'min:0'],
            'terceiros_km' => ['nullable', 'numeric', 'min:0'],

            'abatedouro_frete' => ['nullable', 'numeric', 'min:0'],
            'abatedouro_viagens' => ['nullable', 'integer', 'min:0'],
            'abatedouro_aves' => ['nullable', 'integer', 'min:0'],
            'abatedouro_km' => ['nullable', 'numeric', 'min:0'],

            'canceladas_sem_escalar_frete' => ['nullable', 'numeric', 'min:0'],
            'canceladas_sem_escalar_viagens' => ['nullable', 'integer', 'min:0'],
            'canceladas_sem_escalar_aves' => ['nullable', 'integer', 'min:0'],
            'canceladas_sem_escalar_km' => ['nullable', 'numeric', 'min:0'],

            'canceladas_escaladas_frete' => ['nullable', 'numeric', 'min:0'],
            'canceladas_escaladas_viagens' => ['nullable', 'integer', 'min:0'],
            'canceladas_escaladas_aves' => ['nullable', 'integer', 'min:0'],
            'canceladas_escaladas_km' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $sumViagens =
                (int) ($this->input('programado_viagens') ?? $this->input('cargas_programadas') ?? 0) +
                (int) ($this->input('kaique_geral_viagens') ?? $this->input('cargas') ?? 0) +
                (int) ($this->input('terceiros_viagens') ?? $this->input('viagens_terceiros') ?? 0) +
                (int) ($this->input('abatedouro_viagens') ?? $this->input('cargas_liq') ?? 0) +
                (int) ($this->input('canceladas_sem_escalar_viagens') ?? $this->input('nao_escaladas') ?? 0) +
                (int) ($this->input('canceladas_escaladas_viagens') ?? $this->input('cargas_canceladas_escaladas') ?? 0);

            if ($sumViagens <= 0) {
                $validator->errors()->add(
                    'kaique_geral_viagens',
                    'Informe pelo menos uma carga/viagem no lançamento.',
                );
            }

            $kmFields = [
                'programado_km',
                'kaique_geral_km',
                'terceiros_km',
                'abatedouro_km',
                'canceladas_sem_escalar_km',
                'canceladas_escaladas_km',
                'km_rodado',
                'km_terceiros',
            ];

            foreach ($kmFields as $field) {
                $raw = $this->input($field);

                if ($raw === null || $raw === '') {
                    continue;
                }

                if ((float) $raw > 10000) {
                    $validator->errors()->add(
                        $field,
                        'KM muito alto para um lançamento diário. Revise o valor informado.',
                    );
                }
            }
        });
    }
}
