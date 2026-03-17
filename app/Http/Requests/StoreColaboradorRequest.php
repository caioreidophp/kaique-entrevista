<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'sexo' => ['nullable', Rule::in(['M', 'F'])],
            'ativo' => ['required', 'boolean'],
            'cpf' => ['required', 'string', 'size:11', 'regex:/^\d{11}$/', 'unique:colaboradores,cpf'],
            'rg' => ['nullable', 'string', 'max:30', 'regex:/^[0-9A-Z]+$/'],
            'cnh' => ['nullable', 'string', 'size:11', 'regex:/^\d{11}$/'],
            'validade_cnh' => ['nullable', 'date'],
            'validade_exame_toxicologico' => ['nullable', 'date'],
            'data_nascimento' => ['nullable', 'date'],
            'data_admissao' => ['nullable', 'date'],
            'data_demissao' => ['nullable', 'date', 'after_or_equal:data_admissao'],
            'telefone' => ['nullable', 'string', 'size:11', 'regex:/^\d{11}$/'],
            'email' => ['nullable', 'email', 'max:255'],
            'cep' => ['nullable', 'string', 'max:9'],
            'logradouro' => ['nullable', 'string', 'max:255'],
            'numero_endereco' => ['nullable', 'string', 'max:20'],
            'complemento' => ['nullable', 'string', 'max:255'],
            'bairro' => ['nullable', 'string', 'max:120'],
            'cidade_uf' => ['nullable', 'string', 'max:120'],
            'endereco_completo' => ['nullable', 'string'],
            'dados_bancarios_1' => ['nullable', 'string', 'max:255'],
            'dados_bancarios_2' => ['nullable', 'string', 'max:255'],
            'chave_pix' => ['nullable', 'string', 'max:255'],
            'nome_banco' => ['nullable', 'string', 'max:255'],
            'numero_banco' => ['nullable', 'string', 'max:20'],
            'numero_agencia' => ['nullable', 'string', 'max:20'],
            'tipo_conta' => ['nullable', Rule::in(['poupanca', 'corrente'])],
            'numero_conta' => ['nullable', 'string', 'max:30'],
            'tipo_chave_pix' => ['nullable', Rule::in(['cpf_cnpj', 'celular', 'email', 'aleatoria'])],
            'banco_salario' => ['nullable', Rule::in(['brasil', 'bradesco'])],
            'numero_agencia_salario' => ['nullable', 'string', 'max:20'],
            'numero_conta_salario' => ['nullable', 'string', 'max:30'],
            'conta_pagamento' => ['nullable', Rule::in(['salario', 'particular'])],
            'cartao_beneficio' => ['nullable', Rule::in(['alelo', 'vr'])],
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
            'rg.max' => 'RG deve conter no máximo 30 caracteres.',
            'rg.regex' => 'RG deve conter apenas letras e números.',
            'cnh.size' => 'CNH deve conter exatamente 11 dígitos.',
            'cnh.regex' => 'CNH deve conter apenas números.',
            'telefone.size' => 'Telefone deve conter exatamente 11 dígitos.',
            'telefone.regex' => 'Telefone deve conter apenas números.',
        ];
    }
}
