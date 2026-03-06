<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreColaboradorRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $cpf = preg_replace('/\D+/', '', (string) $this->input('cpf', ''));
        $rg = strtoupper(preg_replace('/[^0-9A-Za-z]+/', '', (string) $this->input('rg', '')));
        $cnh = preg_replace('/\D+/', '', (string) $this->input('cnh', ''));
        $telefone = preg_replace('/\D+/', '', (string) $this->input('telefone', ''));

        $this->merge([
            'cpf' => $cpf,
            'rg' => $rg !== '' ? $rg : null,
            'cnh' => $cnh !== '' ? $cnh : null,
            'telefone' => $telefone !== '' ? $telefone : null,
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
            'funcao_id' => ['required', 'integer', 'exists:funcoes,id'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'nome' => ['required', 'string', 'max:255'],
            'apelido' => ['nullable', 'string', 'max:255'],
            'sexo' => ['nullable', 'string', 'max:20'],
            'ativo' => ['required', 'boolean'],
            'cpf' => ['required', 'string', 'size:11', 'regex:/^\d{11}$/', 'unique:colaboradores,cpf'],
            'rg' => ['nullable', 'string', 'size:10', 'regex:/^\d{9}[\dA-Z]$/'],
            'cnh' => ['nullable', 'string', 'size:9', 'regex:/^\d{9}$/'],
            'validade_cnh' => ['nullable', 'date'],
            'data_nascimento' => ['nullable', 'date'],
            'data_admissao' => ['nullable', 'date'],
            'data_demissao' => ['nullable', 'date', 'after_or_equal:data_admissao'],
            'telefone' => ['nullable', 'string', 'size:11', 'regex:/^\d{11}$/'],
            'email' => ['nullable', 'email', 'max:255'],
            'endereco_completo' => ['nullable', 'string'],
            'dados_bancarios_1' => ['nullable', 'string', 'max:255'],
            'dados_bancarios_2' => ['nullable', 'string', 'max:255'],
            'chave_pix' => ['nullable', 'string', 'max:255'],
            'nome_banco' => ['nullable', 'string', 'max:255'],
            'numero_banco' => ['nullable', 'string', 'max:20'],
            'numero_agencia' => ['nullable', 'string', 'max:20'],
            'tipo_conta' => ['nullable', 'string', 'max:50'],
            'numero_conta' => ['nullable', 'string', 'max:30'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'cpf.size' => 'CPF deve conter exatamente 11 dígitos.',
            'cpf.regex' => 'CPF deve conter apenas números.',
            'rg.size' => 'RG deve conter exatamente 10 caracteres.',
            'rg.regex' => 'RG deve ter 9 números e 1 número ou letra no final.',
            'cnh.size' => 'CNH deve conter exatamente 9 dígitos.',
            'cnh.regex' => 'CNH deve conter apenas números.',
            'telefone.size' => 'Telefone deve conter exatamente 11 dígitos.',
            'telefone.regex' => 'Telefone deve conter apenas números.',
        ];
    }
}
