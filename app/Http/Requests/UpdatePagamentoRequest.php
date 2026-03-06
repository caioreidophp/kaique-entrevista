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
            'colaborador_id' => ['sometimes', 'integer', 'exists:colaboradores,id'],
            'competencia_mes' => ['sometimes', 'integer', 'between:1,12'],
            'competencia_ano' => ['sometimes', 'integer', 'between:2000,2100'],
            'valor' => ['sometimes', 'numeric', 'min:0'],
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
            $targetMes = (int) $this->integer('competencia_mes', (int) $pagamento->competencia_mes);
            $targetAno = (int) $this->integer('competencia_ano', (int) $pagamento->competencia_ano);

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

            $alreadyExists = Pagamento::query()
                ->where('colaborador_id', $targetColaboradorId)
                ->where('competencia_mes', $targetMes)
                ->where('competencia_ano', $targetAno)
                ->whereKeyNot($pagamento->id)
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
