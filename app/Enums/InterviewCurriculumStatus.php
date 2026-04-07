<?php

namespace App\Enums;

enum InterviewCurriculumStatus: string
{
    case Pendente = 'pendente';
    case Recusado = 'recusado';
    case AguardandoEntrevista = 'aguardando_entrevista';
    case AprovadoEntrevista = 'aprovado_entrevista';
    case ReprovadoEntrevista = 'reprovado_entrevista';
}
