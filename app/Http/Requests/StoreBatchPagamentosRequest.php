<?php

namespace App\Http\Requests;

use App\Models\Colaborador;
use App\Models\Pagamento;
use App\Models\PensaoColaborador;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreBatchPagamentosRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $pagamentos = collect($this->input('pagamentos', []))
            ->map(function ($item) {
                if (! is_array($item)) {
                    return $item;
                }

                $item['selected'] = filter_var($item['selected'] ?? false, FILTER_VALIDATE_BOOLEAN);

                if (isset($item['valores_por_tipo']) && is_array($item['valores_por_tipo'])) {
                    $item['valores_por_tipo'] = collect($item['valores_por_tipo'])
                        ->map(function ($value) {
                            return $this->normalizeDecimalInput($value);
                        })
                        ->all();
                }

                if (isset($item['valores_pensao']) && is_array($item['valores_pensao'])) {
                    $item['valores_pensao'] = collect($item['valores_pensao'])
                        ->map(function ($value) {
                            return $this->normalizeDecimalInput($value);
                        })
                        ->all();
                }

                if (isset($item['pagamentos_existentes_por_tipo']) && is_array($item['pagamentos_existentes_por_tipo'])) {
                    $item['pagamentos_existentes_por_tipo'] = collect($item['pagamentos_existentes_por_tipo'])
                        ->map(function ($entry) {
                            if (! is_array($entry)) {
                                return ['id' => 0];
                            }

                            return [
                                'id' => (int) ($entry['id'] ?? 0),
                            ];
                        })
                        ->all();
                }

                return $item;
            })
            ->all();

        $tipoPagamentoIds = collect((array) $this->input('tipo_pagamento_ids', []))
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        $this->merge([
            'pagamentos' => $pagamentos,
            'tipo_pagamento_ids' => $tipoPagamentoIds,
        ]);
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
            'unidade_id' => ['required', 'integer', 'exists:unidades,id'],
            'descricao' => ['nullable', 'string', 'max:255'],
            'data_pagamento' => ['nullable', 'date'],
            'competencia_mes' => ['nullable', 'integer', 'between:1,12'],
            'competencia_ano' => ['nullable', 'integer', 'between:2000,2100'],
            'tipo_pagamento_ids' => ['nullable', 'array'],
            'tipo_pagamento_ids.*' => ['nullable', 'integer', Rule::exists('tipos_pagamento', 'id')],
            'pagamentos' => ['required', 'array', 'min:1'],
            'pagamentos.*.colaborador_id' => ['required', 'integer', 'exists:colaboradores,id'],
            'pagamentos.*.selected' => ['nullable', 'boolean'],
            'pagamentos.*.valor' => ['nullable', 'numeric', 'min:0'],
            'pagamentos.*.valores_por_tipo' => ['nullable', 'array'],
            'pagamentos.*.valores_pensao' => ['nullable', 'array'],
            'pagamentos.*.pagamentos_existentes_por_tipo' => ['nullable', 'array'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $unidadeId = (int) $this->integer('unidade_id');
            $dataPagamento = $this->date('data_pagamento')?->toDateString();
            $competenciaMes = (int) $this->integer('competencia_mes');
            $competenciaAno = (int) $this->integer('competencia_ano');
            $tipoPagamentoIds = collect((array) $this->input('tipo_pagamento_ids', []))
                ->map(fn ($id) => (int) $id)
                ->filter(fn (int $id) => $id > 0)
                ->unique();
            $isNewMode = $tipoPagamentoIds->isNotEmpty() || (bool) $dataPagamento;

            if ($isNewMode) {
                if (! $dataPagamento) {
                    $validator->errors()->add('data_pagamento', 'Informe a data de pagamento.');
                }

                if ($tipoPagamentoIds->isEmpty()) {
                    $validator->errors()->add('tipo_pagamento_ids', 'Selecione ao menos um tipo de pagamento.');
                }
            } else {
                if ($competenciaMes <= 0 || $competenciaAno <= 0) {
                    $validator->errors()->add('competencia_mes', 'Informe mês e ano da competência para lançamento legado.');
                }
            }

            $uniqueInPayload = [];
            $selectedCount = 0;

            foreach ((array) $this->input('pagamentos', []) as $index => $item) {
                $colaboradorId = (int) ($item['colaborador_id'] ?? 0);
                $selected = (bool) ($item['selected'] ?? false);
                $valoresPorTipo = (array) ($item['valores_por_tipo'] ?? []);
                $valoresPensao = (array) ($item['valores_pensao'] ?? []);
                $pagamentosExistentesPorTipo = collect((array) ($item['pagamentos_existentes_por_tipo'] ?? []))
                    ->mapWithKeys(function ($entry, $tipoId): array {
                        $typedEntry = is_array($entry) ? $entry : [];

                        return [(int) $tipoId => (int) ($typedEntry['id'] ?? 0)];
                    })
                    ->all();
                $valorLegado = (float) ($item['valor'] ?? 0);

                if (! $colaboradorId) {
                    continue;
                }

                if (isset($uniqueInPayload[$colaboradorId])) {
                    $validator->errors()->add("pagamentos.{$index}.colaborador_id", 'Colaborador duplicado no lançamento em lote.');

                    continue;
                }

                $uniqueInPayload[$colaboradorId] = true;

                $colaborador = Colaborador::query()
                    ->whereKey($colaboradorId)
                    ->where('ativo', true)
                    ->first();

                if (! $colaborador) {
                    $validator->errors()->add("pagamentos.{$index}.colaborador_id", 'Colaborador inválido ou inativo.');

                    continue;
                }

                if ((int) $colaborador->unidade_id !== $unidadeId) {
                    $validator->errors()->add("pagamentos.{$index}.colaborador_id", 'Colaborador não pertence à unidade selecionada.');

                    continue;
                }

                if ($isNewMode) {
                    if (! $selected) {
                        continue;
                    }

                    $hasPositiveValue = false;

                    foreach ($tipoPagamentoIds as $tipoPagamentoId) {
                        $raw = (string) ($valoresPorTipo[(string) $tipoPagamentoId] ?? '0');
                        $valor = (float) $raw;

                        if ($valor < 0) {
                            $validator->errors()->add(
                                "pagamentos.{$index}.valores_por_tipo.{$tipoPagamentoId}",
                                'O valor por tipo não pode ser negativo.',
                            );

                            continue;
                        }

                        if ($valor > 0) {
                            $hasPositiveValue = true;
                        }

                        if (! $dataPagamento || $valor <= 0) {
                            continue;
                        }

                        $existingPaymentId = Pagamento::query()
                            ->where('colaborador_id', $colaboradorId)
                            ->where('tipo_pagamento_id', $tipoPagamentoId)
                            ->whereDate('data_pagamento', $dataPagamento)
                            ->value('id');

                        $existingPayloadId = (int) ($pagamentosExistentesPorTipo[$tipoPagamentoId] ?? 0);

                        if ($existingPaymentId && $existingPaymentId !== $existingPayloadId) {
                            $validator->errors()->add(
                                "pagamentos.{$index}.valores_por_tipo.{$tipoPagamentoId}",
                                'Já existe lançamento deste tipo para o colaborador na data informada.',
                            );
                        }
                    }

                    foreach ($valoresPensao as $pensaoIdRaw => $valorPensaoRaw) {
                        $pensaoId = (int) $pensaoIdRaw;
                        $valorPensao = (float) $valorPensaoRaw;

                        if ($pensaoId <= 0) {
                            $validator->errors()->add(
                                "pagamentos.{$index}.valores_pensao",
                                'A pensão informada é inválida.',
                            );

                            continue;
                        }

                        if ($valorPensao < 0) {
                            $validator->errors()->add(
                                "pagamentos.{$index}.valores_pensao.{$pensaoId}",
                                'O valor de pensão não pode ser negativo.',
                            );

                            continue;
                        }

                        if ($valorPensao > 0) {
                            $hasPositiveValue = true;
                        }

                        $pensaoExists = PensaoColaborador::query()
                            ->whereKey($pensaoId)
                            ->where('colaborador_id', $colaboradorId)
                            ->where('ativo', true)
                            ->exists();

                        if (! $pensaoExists) {
                            $validator->errors()->add(
                                "pagamentos.{$index}.valores_pensao.{$pensaoId}",
                                'A pensão informada não pertence ao colaborador selecionado.',
                            );
                        }
                    }

                    if ($hasPositiveValue) {
                        $selectedCount++;
                    }

                    continue;
                }

                if ($valorLegado <= 0) {
                    continue;
                }

                $selectedCount++;

                if ($competenciaMes > 0 && $competenciaAno > 0) {
                    $exists = Pagamento::query()
                        ->where('colaborador_id', $colaboradorId)
                        ->where('competencia_mes', $competenciaMes)
                        ->where('competencia_ano', $competenciaAno)
                        ->exists();

                    if ($exists) {
                        $validator->errors()->add(
                            "pagamentos.{$index}.colaborador_id",
                            'Já existe pagamento para este colaborador na competência informada.',
                        );
                    }
                }
            }

            if ($selectedCount === 0) {
                $validator->errors()->add('pagamentos', 'Informe ao menos um lançamento com valor maior que zero.');
            }
        });
    }
}
