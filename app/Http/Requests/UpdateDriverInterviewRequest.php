<?php

namespace App\Http\Requests;

use App\Enums\GuepStatus;
use App\Enums\HrStatus;
use Illuminate\Validation\Rule;

class UpdateDriverInterviewRequest extends StoreDriverInterviewRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = parent::rules();

        $rules['guep_status'] = ['nullable', Rule::in(array_column(GuepStatus::cases(), 'value'))];

        return $rules;
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $interview = $this->route('driverInterview');

            if (! $interview) {
                return;
            }

            $newHrStatus = (string) ($this->input('hr_status') ?? $interview->hr_status->value);
            $guepStatus = $this->input('guep_status');

            if ($newHrStatus === HrStatus::Reprovado->value && $guepStatus !== null) {
                $validator->errors()->add(
                    'guep_status',
                    'Não é permitido editar GUEP quando o status RH é reprovado.'
                );
            }

        });
    }
}
