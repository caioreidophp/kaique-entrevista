<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ImportColaboradoresSpreadsheetRequest extends FormRequest
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
                'mimes:xlsx',
                'mimetypes:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'max:10240',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.required' => 'Selecione um arquivo para importação.',
            'file.mimes' => 'Envie um arquivo Excel no formato .xlsx.',
            'file.max' => 'O arquivo de importação deve ter no máximo 10 MB.',
        ];
    }
}
