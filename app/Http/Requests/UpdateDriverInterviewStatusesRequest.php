<?php

namespace App\Http\Requests;

use App\Enums\GuepStatus;
use App\Enums\HrStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDriverInterviewStatusesRequest extends FormRequest
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
            'hr_status' => ['nullable', Rule::in(array_column(HrStatus::cases(), 'value'))],
            'guep_status' => ['nullable', Rule::in(array_column(GuepStatus::cases(), 'value'))],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $interview = $this->route('driverInterview');

            if (! $interview) {
                return;
            }

            $hasHr = $this->filled('hr_status');
            $hasGuep = $this->filled('guep_status');

            if (! $hasHr && ! $hasGuep) {
                $validator->errors()->add(
                    'hr_status',
                    'Informe ao menos um status para atualização.'
                );

                return;
            }

            $nextHrStatus = (string) ($this->input('hr_status') ?? $interview->hr_status->value);
            $guepStatus = $this->input('guep_status');

            if (
                $nextHrStatus === HrStatus::Reprovado->value
                && $guepStatus !== null
                && $guepStatus !== GuepStatus::NaoFazer->value
            ) {
                $validator->errors()->add(
                    'guep_status',
                    'Quando o status RH é reprovado, o status GUEP deve ser "não fazer".'
                );
            }
        });
    }
}
