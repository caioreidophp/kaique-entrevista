<?php

namespace App\Http\Requests;

use App\Support\FileSignatureInspector;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UploadOnboardingItemAttachmentRequest extends FormRequest
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
            'file' => [
                'required',
                'file',
                'mimes:pdf,jpg,jpeg,png',
                'mimetypes:application/pdf,image/jpeg,image/png',
                'max:5120',
            ],
        ];
    }

    /**
     * @return array<int, \Closure>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $file = $this->file('file');

                if (! $file) {
                    return;
                }

                if (! FileSignatureInspector::matchesAllowedKinds($file, ['pdf', 'jpeg', 'png'])) {
                    $validator->errors()->add('file', 'O arquivo enviado nao passou na validacao de assinatura binaria.');
                }
            },
        ];
    }
}
