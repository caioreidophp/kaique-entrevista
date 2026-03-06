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
            $normalized = str_replace(['.', ','], ['', '.'], (string) $this->input('valor'));
            $this->merge(['valor' => $normalized]);
        }
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
            'competencia_mes' => ['required', 'integer', 'between:1,12'],
            'competencia_ano' => ['required', 'integer', 'between:2000,2100'],
            'valor' => ['required', 'numeric', 'min:0'],
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

            $alreadyExists = Pagamento::query()
                ->where('colaborador_id', (int) $this->integer('colaborador_id'))
                ->where('competencia_mes', (int) $this->integer('competencia_mes'))
                ->where('competencia_ano', (int) $this->integer('competencia_ano'))
                ->exists();

            if ($alreadyExists) {
                $validator->errors()->add(
                    'colaborador_id',
                    'Já existe pagamento para este colaborador na competência informada.',
                );
            }
        });
    }
}
