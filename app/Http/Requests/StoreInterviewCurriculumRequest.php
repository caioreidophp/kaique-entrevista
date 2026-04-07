<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreInterviewCurriculumRequest extends FormRequest
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
            'full_name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:40'],
            'role_name' => ['required', 'string', 'max:120'],
            'unit_name' => ['required', 'string', 'max:120'],
            'curriculum_file' => [
                'required',
                'file',
                'mimes:pdf,doc,docx,jpeg,jpg',
                'mimetypes:application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg',
                'max:10240',
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
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'full_name.required' => 'O nome do candidato é obrigatório.',
            'phone.required' => 'O telefone é obrigatório.',
            'role_name.required' => 'A função é obrigatória.',
            'unit_name.required' => 'A unidade é obrigatória.',
            'curriculum_file.required' => 'O arquivo do currículo é obrigatório.',
            'curriculum_file.mimes' => 'O currículo deve estar em PDF, DOC, DOCX ou JPEG.',
            'curriculum_file.max' => 'O currículo deve ter no máximo 10 MB.',
            'cnh_attachment_file.mimes' => 'O anexo da CNH deve estar em JPG, PNG, WEBP ou PDF.',
            'cnh_attachment_file.max' => 'O anexo da CNH deve ter no máximo 8 MB.',
            'work_card_attachment_file.mimes' => 'O anexo da carteira de trabalho deve estar em JPG, PNG, WEBP ou PDF.',
            'work_card_attachment_file.max' => 'O anexo da carteira de trabalho deve ter no máximo 8 MB.',
        ];
    }
}
