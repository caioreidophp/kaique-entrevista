<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateRegistryUserRequest extends FormRequest
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
        $user = $this->route('user');
        $userId = $user instanceof User ? $user->id : null;

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($userId),
            ],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
            'role' => ['required', Rule::in(['master_admin', 'admin', 'usuario'])],
            'colaborador_id' => ['nullable', 'integer', 'exists:colaboradores,id'],
            'access_scopes' => ['nullable', 'array'],
            'access_scopes.*.module_key' => ['required_with:access_scopes', 'string', Rule::in(\App\Support\AccessScopeCatalog::moduleKeys())],
            'access_scopes.*.data_scope' => ['nullable', 'string', Rule::in(\App\Support\AccessScopeCatalog::dataScopes())],
            'access_scopes.*.allowed_unit_ids' => ['nullable', 'array'],
            'access_scopes.*.allowed_unit_ids.*' => ['integer', 'exists:unidades,id'],
        ];
    }
}
