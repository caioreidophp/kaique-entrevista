<?php

namespace App\Enums;

enum GuepStatus: string
{
    case NaoFazer = 'nao_fazer';
    case AFazer = 'a_fazer';
    case Aprovado = 'aprovado';
    case Reprovado = 'reprovado';
    case Aguardando = 'aguardando';
}
