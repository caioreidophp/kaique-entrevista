<?php

namespace App\Http\Requests;

use App\Support\FileSignatureInspector;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UploadColaboradorPhotoRequest extends FormRequest
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
            'foto' => [
                'required',
                'file',
                'image',
                'mimes:jpeg,jpg,png,webp',
                'mimetypes:image/jpeg,image/png,image/webp',
                'max:3072',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'foto.required' => 'Envie uma foto 3x4.',
            'foto.image' => 'O arquivo enviado precisa ser uma imagem valida.',
            'foto.mimes' => 'A foto deve estar em JPG, PNG ou WEBP.',
            'foto.max' => 'A foto deve ter no maximo 3 MB.',
        ];
    }

    /**
     * @return array<int, \Closure>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $file = $this->file('foto');

                if (! $file) {
                    return;
                }

                if (! FileSignatureInspector::matchesAllowedKinds($file, ['jpeg', 'png', 'webp'])) {
                    $validator->errors()->add('foto', 'A imagem enviada nao passou na validacao de assinatura binaria.');
                }
            },
        ];
    }
}
