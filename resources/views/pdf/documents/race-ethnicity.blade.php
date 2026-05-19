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

    <div class="document-card">
        <div class="eyebrow">Documento de admissão</div>
        <div class="title">Autodeclaração Étnico-Racial</div>

        <div class="field-grid">
            <div class="field">
                <span class="label">Nome completo</span>
                <strong>{{ $interview->full_name }}</strong>
            </div>
            <div class="field">
                <span class="label">CPF</span>
                <strong>{{ $interview->cpf }}</strong>
            </div>
        </div>

        <div class="row">
            Eu, <strong>{{ $interview->full_name }}</strong>, inscrito no CPF sob nº
            <strong>{{ $interview->cpf }}</strong>, AUTODECLARO, sob as penas da lei,
            minha raça/etnia sendo:
        </div>

        <div class="option-grid">
            <span>(&nbsp;&nbsp;) Branca</span>
            <span>(&nbsp;&nbsp;) Preta</span>
            <span>(&nbsp;&nbsp;) Parda</span>
            <span>(&nbsp;&nbsp;) Amarela</span>
            <span>(&nbsp;&nbsp;) Indígena</span>
        </div>

        <div class="notice">
            Esta autodeclaração atende a exigência do art. 39, § 8º, da Lei 12.288/2010,
            alterado pela Lei nº 14.553/2023 e da Portaria MTE nº 3.784/2023, que obriga
            a prestação da informação nas inclusões, alterações ou retificações cadastrais
            dos trabalhadores ocorridas a partir de 1º de janeiro de 2024, respeitando o
            critério de autodeclaração do trabalhador, em conformidade com a classificação
            utilizada pelo Instituto Brasileiro de Geografia e Estatística - IBGE.
        </div>

        <div class="row">
            Por ser a expressão da verdade, firmo e assino a presente para que a mesma
            produza seus efeitos legais e de direito.
        </div>

        <div class="row signature-date">
            <span>{{ $interview->city ?: '________________' }}</span>,
            <span>{{ now()->format('d') }}</span> /
            <span>{{ now()->format('m') }}</span> /
            <span>{{ now()->format('Y') }}</span>
        </div>

        <div class="signature-area">
            <div class="signature-line"></div>
            <div>Assinatura do colaborador</div>
        </div>
    </div>

    @include('pdf.documents.partials.footer-logo')
</div>
</body>
</html>
