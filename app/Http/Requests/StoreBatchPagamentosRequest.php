<?php

namespace App\Http\Requests;

use App\Models\Colaborador;
use App\Models\Pagamento;
use Illuminate\Foundation\Http\FormRequest;
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

                if (array_key_exists('valor', $item)) {
                    $item['valor'] = str_replace(['.', ','], ['', '.'], (string) $item['valor']);
                }

                return $item;
            })
            ->all();

        $this->merge([
            'pagamentos' => $pagamentos,
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
            'unidade_id' => ['required', 'integer', 'exists:unidades,id'],
            'competencia_mes' => ['required', 'integer', 'between:1,12'],
            'competencia_ano' => ['required', 'integer', 'between:2000,2100'],
            'pagamentos' => ['required', 'array', 'min:1'],
            'pagamentos.*.colaborador_id' => ['required', 'integer', 'exists:colaboradores,id'],
            'pagamentos.*.valor' => ['required', 'numeric', 'min:0'],
            'pagamentos.*.observacao' => ['nullable', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $unidadeId = (int) $this->integer('unidade_id');
            $mes = (int) $this->integer('competencia_mes');
            $ano = (int) $this->integer('competencia_ano');

            $uniqueInPayload = [];

            foreach ((array) $this->input('pagamentos', []) as $index => $item) {
                $colaboradorId = (int) ($item['colaborador_id'] ?? 0);

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

                $exists = Pagamento::query()
                    ->where('colaborador_id', $colaboradorId)
                    ->where('competencia_mes', $mes)
                    ->where('competencia_ano', $ano)
                    ->exists();

                if ($exists) {
                    $validator->errors()->add(
                        "pagamentos.{$index}.colaborador_id",
                        'Já existe pagamento para este colaborador na competência informada.',
                    );
                }
            }
        });
    }
}
