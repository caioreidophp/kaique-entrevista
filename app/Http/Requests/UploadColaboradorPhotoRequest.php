<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

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
            'foto.image' => 'O arquivo enviado precisa ser uma imagem válida.',
            'foto.mimes' => 'A foto deve estar em JPG, PNG ou WEBP.',
            'foto.max' => 'A foto deve ter no máximo 3 MB.',
        ];
    }
}
