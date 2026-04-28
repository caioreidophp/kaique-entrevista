<?php

namespace App\Http\Requests;

use App\Support\FileSignatureInspector;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateDriverInterviewAttachmentsRequest extends FormRequest
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
            'candidate_photo_file' => [
                'nullable',
                'file',
                'image',
                'mimes:jpeg,jpg,png,webp',
                'mimetypes:image/jpeg,image/png,image/webp',
                'max:5120',
            ],
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
            'remove_candidate_photo' => ['nullable', 'boolean'],
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
            'candidate_photo_file.image' => 'A foto do candidato deve ser uma imagem valida.',
            'candidate_photo_file.mimes' => 'A foto do candidato deve estar em JPG, PNG ou WEBP.',
            'candidate_photo_file.max' => 'A foto do candidato deve ter no maximo 5 MB.',
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
                $fieldKinds = [
                    'candidate_photo_file' => ['jpeg', 'png', 'webp'],
                    'cnh_attachment_file' => ['pdf', 'jpeg', 'png', 'webp'],
                    'work_card_attachment_file' => ['pdf', 'jpeg', 'png', 'webp'],
                ];

                foreach ($fieldKinds as $field => $allowedKinds) {
                    $file = $this->file($field);

                    if (! $file) {
                        continue;
                    }

                    if (! FileSignatureInspector::matchesAllowedKinds($file, $allowedKinds)) {
                        $validator->errors()->add($field, 'O arquivo enviado nao passou na validacao de assinatura binaria.');
                    }
                }
            },
        ];
    }
}
