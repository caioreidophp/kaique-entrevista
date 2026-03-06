<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AssignOnboardingResponsibleRequest extends FormRequest
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
            'responsavel_user_id' => ['required', 'integer', 'exists:users,id'],
        ];
    }
}
