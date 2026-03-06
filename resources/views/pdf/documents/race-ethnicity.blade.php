<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Raça e Etnia - {{ $interview->full_name }}</title>
    @include('pdf.documents.partials.styles')
</head>
<body>
<div class="document-wrap">
    @include('pdf.documents.partials.header')

    @for ($i = 0; $i < 2; $i++)
        <div class="double-copy">
            <div class="title">Autodeclaração Étnico-Racial</div>

            <div class="row">
                Eu, <span class="line wide">{{ $interview->full_name }}</span>,
                inscrito no CPF sob nº <span class="line small">{{ $interview->cpf }}</span>,
                AUTODECLARO, sob as penas da lei, minha raça/etnia sendo:
            </div>

            <div class="checkbox-row">(&nbsp;&nbsp;) Branca &nbsp;&nbsp; (&nbsp;&nbsp;) Preta &nbsp;&nbsp; (&nbsp;&nbsp;) Parda &nbsp;&nbsp; (&nbsp;&nbsp;) Amarela &nbsp;&nbsp; (&nbsp;&nbsp;) Indígena</div>

            <div class="row muted">
                Esta autodeclaração atende a exigência do art. 39, § 8º, da Lei 12.288/2010, alterado pela Lei nº 14.553/2023 e da Portaria MTE nº 3.784/2023, que obriga a prestação da informação nas inclusões, alterações ou retificações cadastrais dos trabalhadores ocorridas a partir de 1º de janeiro de 2024, respeitando o critério de autodeclaração do trabalhador, em conformidade com a classificação utilizada pelo Instituto Brasileiro de Geografia e Estatística - IBGE.
            </div>

            <div class="row">
                Por ser a expressão da verdade, firmo e assino a presente para que a mesma produza seus efeitos legais e de direito.
            </div>

            <div class="row">
                <span class="line small">{{ $interview->city }}</span>,
                <span class="line tiny">{{ now()->format('d') }}</span> /
                <span class="line tiny">{{ now()->format('m') }}</span> /
                <span class="line tiny">{{ now()->format('Y') }}</span>
            </div>

            <div class="signature-area">
                <div class="signature-line"></div>
                <div>Assinatura</div>
            </div>

            @include('pdf.documents.partials.footer-logo')
        </div>
    @endfor
</div>
</body>
</html>
