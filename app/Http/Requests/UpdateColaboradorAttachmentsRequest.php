<?php

namespace App\Http\Requests;

use App\Support\FileSignatureInspector;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateColaboradorAttachmentsRequest extends FormRequest
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
            'cnh_attachment_file' => [
                'nullable',
                'file',
                'mimes:jpeg,jpg,png,webp,pdf',
                'mimetypes:image/jpeg,image/png,image/webp,application/pdf',
                'max:8192',
            ],
            'work_card_attachment_file' => [
                'nullable',
                'file',
                'mimes:jpeg,jpg,png,webp,pdf',
                'mimetypes:image/jpeg,image/png,image/webp,application/pdf',
                'max:8192',
            ],
            'remove_cnh_attachment' => ['nullable', 'boolean'],
            'remove_work_card_attachment' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'cnh_attachment_file.mimes' => 'O anexo da CNH deve estar em JPG, PNG, WEBP ou PDF.',
            'cnh_attachment_file.max' => 'O anexo da CNH deve ter no maximo 8 MB.',
            'work_card_attachment_file.mimes' => 'O anexo da carteira de trabalho deve estar em JPG, PNG, WEBP ou PDF.',
            'work_card_attachment_file.max' => 'O anexo da carteira de trabalho deve ter no maximo 8 MB.',
        ];
    }

    /**
     * @return array<int, \Closure>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                foreach (['cnh_attachment_file', 'work_card_attachment_file'] as $field) {
                    $file = $this->file($field);

                    if (! $file) {
                        continue;
                    }

                    if (! FileSignatureInspector::matchesAllowedKinds($file, ['pdf', 'jpeg', 'png', 'webp'])) {
                        $validator->errors()->add($field, 'O arquivo enviado nao passou na validacao de assinatura binaria.');
                    }
                }
            },
        ];
    }
}
