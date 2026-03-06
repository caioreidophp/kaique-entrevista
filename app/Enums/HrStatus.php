<?php

namespace App\Enums;

enum HrStatus: string
{
    case Aprovado = 'aprovado';
    case Reprovado = 'reprovado';
    case EmAnalise = 'em_analise';
    case AguardandoVaga = 'aguardando_vaga';
    case Guep = 'guep';
    case TestePratico = 'teste_pratico';
}
