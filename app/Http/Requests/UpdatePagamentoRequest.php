<?php

namespace App\Http\Requests;

use App\Models\Colaborador;
use App\Models\Pagamento;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdatePagamentoRequest extends FormRequest
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
            'colaborador_id' => ['sometimes', 'integer', 'exists:colaboradores,id'],
            'tipo_pagamento_id' => ['nullable', 'integer', 'exists:tipos_pagamento,id'],
            'competencia_mes' => ['sometimes', 'integer', 'between:1,12'],
            'competencia_ano' => ['sometimes', 'integer', 'between:2000,2100'],
            'valor' => ['sometimes', 'numeric', 'min:0'],
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
            /** @var Pagamento|null $pagamento */
            $pagamento = $this->route('pagamento');

            if (! $pagamento) {
                return;
            }

            $targetColaboradorId = (int) $this->integer('colaborador_id', (int) $pagamento->colaborador_id);
            $targetTipoPagamentoId = (int) $this->integer('tipo_pagamento_id', (int) ($pagamento->tipo_pagamento_id ?? 0));
            $targetDataPagamento = $this->date('data_pagamento')?->toDateString()
                ?? $pagamento->data_pagamento?->toDateString();

            if ($this->filled('colaborador_id')) {
                $colaborador = Colaborador::query()
                    ->whereKey($targetColaboradorId)
                    ->where('ativo', true)
                    ->first();

                if (! $colaborador) {
                    $validator->errors()->add('colaborador_id', 'Colaborador inválido ou inativo.');

                    return;
                }
            }

            if ($targetTipoPagamentoId > 0 && $targetDataPagamento) {
                $alreadyExists = Pagamento::query()
                    ->where('colaborador_id', $targetColaboradorId)
                    ->where('tipo_pagamento_id', $targetTipoPagamentoId)
                    ->whereDate('data_pagamento', $targetDataPagamento)
                    ->whereKeyNot($pagamento->id)
                    ->exists();

                if ($alreadyExists) {
                    $validator->errors()->add(
                        'tipo_pagamento_id',
                        'Já existe lançamento deste tipo para o colaborador na data informada.',
                    );
                }

                return;
            }

            $targetMes = (int) $this->integer('competencia_mes', (int) $pagamento->competencia_mes);
            $targetAno = (int) $this->integer('competencia_ano', (int) $pagamento->competencia_ano);

            $alreadyExistsByCompetencia = Pagamento::query()
                ->where('colaborador_id', $targetColaboradorId)
                ->where('competencia_mes', $targetMes)
                ->where('competencia_ano', $targetAno)
                ->whereKeyNot($pagamento->id)
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
