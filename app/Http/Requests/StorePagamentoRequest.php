<?php

namespace App\Http\Requests;

use App\Models\Colaborador;
use App\Models\Pagamento;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StorePagamentoRequest extends FormRequest
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
            'tipo_pagamento_id' => ['nullable', 'integer', 'exists:tipos_pagamento,id'],
            'competencia_mes' => ['nullable', 'integer', 'between:1,12'],
            'competencia_ano' => ['nullable', 'integer', 'between:2000,2100'],
            'valor' => ['required', 'numeric', 'min:0'],
            'descricao' => ['nullable', 'string', 'max:255'],
            'data_pagamento' => ['nullable', 'date'],
            'observacao' => ['nullable', 'string'],
            'lancado_em' => ['nullable', 'date'],
            'autor_id' => ['prohibited'],
            'unidade_id' => ['prohibited'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if (! $this->filled('colaborador_id')) {
                return;
            }

            $colaborador = Colaborador::query()
                ->whereKey((int) $this->integer('colaborador_id'))
                ->where('ativo', true)
                ->first();

            if (! $colaborador) {
                $validator->errors()->add('colaborador_id', 'Colaborador inválido ou inativo.');

                return;
            }

            $tipoPagamentoId = (int) $this->integer('tipo_pagamento_id');
            $dataPagamento = $this->date('data_pagamento')?->toDateString();

            if ($tipoPagamentoId > 0 && $dataPagamento) {
                $alreadyExists = Pagamento::query()
                    ->where('colaborador_id', (int) $this->integer('colaborador_id'))
                    ->where('tipo_pagamento_id', $tipoPagamentoId)
                    ->whereDate('data_pagamento', $dataPagamento)
                    ->exists();

                if ($alreadyExists) {
                    $validator->errors()->add(
                        'tipo_pagamento_id',
                        'Já existe lançamento deste tipo para o colaborador na data informada.',
                    );
                }
                return;
            }

            if (! $this->filled('competencia_mes') || ! $this->filled('competencia_ano')) {
                $validator->errors()->add(
                    'competencia_mes',
                    'Informe competência (mês/ano) quando não houver tipo e data de pagamento.',
                );

                return;
            }

            $alreadyExistsByCompetencia = Pagamento::query()
                ->where('colaborador_id', (int) $this->integer('colaborador_id'))
                ->where('competencia_mes', (int) $this->integer('competencia_mes'))
                ->where('competencia_ano', (int) $this->integer('competencia_ano'))
                ->exists();

            if ($alreadyExistsByCompetencia) {
                $validator->errors()->add(
                    'colaborador_id',
                    'Já existe pagamento para este colaborador na competência informada.',
                );
            }
        });
    }
}
