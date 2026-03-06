<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Checklist - {{ $interview->full_name }}</title>
    @include('pdf.documents.partials.styles')
</head>
<body>
<div class="document-wrap">
    @include('pdf.documents.partials.header')

    <div class="title">Informações para registro de colaborador</div>

    <div class="row">
        <strong>Nome:</strong>
        <span class="line wide">{{ $interview->full_name }}</span>
    </div>

    <div class="section-title">Documentos Necessários (Cópia ou Digitalizado):</div>
    <ul>
        <li>RG</li>
        <li>CPF</li>
        <li>CNH</li>
        <li>Comprovante de Endereço Atualizado</li>
    </ul>

    <div class="row">Caso tenha filhos menores, providenciar também:</div>
    <ul>
        <li>Certidão de Nascimento com CPF ou</li>
        <li>RG com CPF</li>
    </ul>

    <div class="section-title">Favor preencher os dados abaixo e devolver ao RH da empresa:</div>

    <div class="row">
        Escolaridade / Grau de Instrução:
        <span class="line wide"></span>
    </div>

    <div class="row">
        Estado Civil:
        <span class="line wide">{{ $interview->marital_status }}</span>
    </div>

    <div class="row">
        Email:
        <span class="line wide">{{ $interview->email }}</span>
    </div>

    <div class="row">
        Dados Bancários:
        Banco: <span class="line small"></span>
        Tipo de conta <span class="line small"></span>
    </div>

    <div class="row">
        Ag <span class="line tiny"></span>
        Conta: <span class="line small"></span>
        Chave PIX: <span class="line small"></span>
    </div>

    <div class="checkbox-row">Primeiro Emprego com CTPS Assinada: (&nbsp;&nbsp;) Sim&nbsp;&nbsp;&nbsp;&nbsp;(&nbsp;&nbsp;) Não</div>
    <div class="checkbox-row">Opção por Vale Transporte: (&nbsp;&nbsp;) Sim&nbsp;&nbsp;&nbsp;&nbsp;(&nbsp;&nbsp;) Não</div>
    <div class="checkbox-row">Opção por adiantamento / Vale dia 20: (&nbsp;&nbsp;) Sim&nbsp;&nbsp;&nbsp;&nbsp;(&nbsp;&nbsp;) Não</div>

    <div class="section-title">Informações abaixo devem ser preenchidas pela empresa:</div>

    <div class="row">Data de Registro: ____ / ____ / _________</div>
    <div class="row">Função / Cargo: <span class="line small"></span></div>
    <div class="row">Salário Inicial: R$ <span class="line small"></span></div>
    <div class="row">Contrato de Experiência: (&nbsp;&nbsp;) Sim&nbsp;&nbsp;&nbsp;&nbsp;(&nbsp;&nbsp;) Não</div>
    <div class="row">Se sim, quantos dias: <span class="line tiny"></span> + <span class="line tiny"></span></div>

    @include('pdf.documents.partials.footer-logo')
</div>
</body>
</html>
