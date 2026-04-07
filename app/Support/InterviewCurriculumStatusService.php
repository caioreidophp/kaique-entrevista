<?php

namespace App\Support;

use App\Enums\HrStatus;
use App\Enums\InterviewCurriculumStatus;
use App\Models\DriverInterview;
use App\Models\InterviewCurriculum;

class InterviewCurriculumStatusService
{
    public function syncFromInterview(DriverInterview $interview): void
    {
        $interview->loadMissing('curriculum');

        $curriculum = $interview->curriculum;

        if (! $curriculum) {
            return;
        }

        $nextStatus = $this->statusFromInterview($interview);

        if ($curriculum->status === $nextStatus) {
            return;
        }

        $curriculum->update([
            'status' => $nextStatus->value,
        ]);
    }

    public function releaseToPending(?InterviewCurriculum $curriculum): void
    {
        if (! $curriculum) {
            return;
        }

        if ($curriculum->status === InterviewCurriculumStatus::Pendente) {
            return;
        }

        $curriculum->update([
            'status' => InterviewCurriculumStatus::Pendente->value,
        ]);
    }

    private function statusFromInterview(DriverInterview $interview): InterviewCurriculumStatus
    {
        if ($interview->hr_status === HrStatus::Reprovado) {
            return InterviewCurriculumStatus::ReprovadoEntrevista;
        }

        if ($interview->hr_status === HrStatus::Aprovado || $interview->foi_contratado) {
            return InterviewCurriculumStatus::AprovadoEntrevista;
        }

        return InterviewCurriculumStatus::AguardandoEntrevista;
    }
}
