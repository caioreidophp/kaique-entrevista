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

    <div class="document-card">
        <div class="eyebrow">Checklist de admissão</div>
        <div class="title">Informações para registro de colaborador</div>

        <div class="field-grid">
            <div class="field wide">
                <span class="label">Nome completo</span>
                <strong>{{ $interview->full_name }}</strong>
            </div>
            <div class="field">
                <span class="label">CPF</span>
                <strong>{{ $interview->cpf }}</strong>
            </div>
        </div>

        <div class="section-title">Documentos necessários</div>
        <div class="checklist-grid">
            <div>(&nbsp;&nbsp;) RG</div>
            <div>(&nbsp;&nbsp;) CPF</div>
            <div>(&nbsp;&nbsp;) CNH</div>
            <div>(&nbsp;&nbsp;) Comprovante de endereço atualizado</div>
        </div>

        <div class="section-title">Caso tenha filhos menores</div>
        <div class="checklist-grid">
            <div>(&nbsp;&nbsp;) Certidão de nascimento com CPF</div>
            <div>(&nbsp;&nbsp;) RG com CPF</div>
        </div>

        <div class="section-title">Dados a preencher</div>

        <div class="form-grid">
            <div class="fill-line">Escolaridade / Grau de Instrução</div>
            <div class="fill-line">Estado Civil: {{ $interview->marital_status }}</div>
            <div class="fill-line">Email: {{ $interview->email }}</div>
            <div class="fill-line">Banco</div>
            <div class="fill-line">Tipo de conta</div>
            <div class="fill-line">Agência</div>
            <div class="fill-line">Conta</div>
            <div class="fill-line">Chave PIX</div>
        </div>

        <div class="section-title">Opções do colaborador</div>
        <div class="checklist-grid">
            <div>Primeiro Emprego com CTPS Assinada: (&nbsp;&nbsp;) Sim&nbsp;&nbsp;(&nbsp;&nbsp;) Não</div>
            <div>Opção por Vale Transporte: (&nbsp;&nbsp;) Sim&nbsp;&nbsp;(&nbsp;&nbsp;) Não</div>
            <div>Opção por adiantamento / Vale dia 20: (&nbsp;&nbsp;) Sim&nbsp;&nbsp;(&nbsp;&nbsp;) Não</div>
        </div>

        <div class="section-title">Preenchimento da empresa</div>
        <div class="form-grid">
            <div class="fill-line">Data de Registro: ____ / ____ / _________</div>
            <div class="fill-line">Função / Cargo</div>
            <div class="fill-line">Salário Inicial: R$</div>
            <div class="fill-line">Contrato de Experiência: (&nbsp;&nbsp;) Sim&nbsp;&nbsp;(&nbsp;&nbsp;) Não</div>
            <div class="fill-line">Se sim, quantos dias: ______ + ______</div>
        </div>

        <div class="signature-area modern-signature">
            <div class="signature-line"></div>
            <div>Conferência RH</div>
        </div>
    </div>

    @include('pdf.documents.partials.footer-logo')
</div>
</body>
</html>
