<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Entrevista #{{ $interview->id }}</title>
    <style>
        @page {
            margin: 12mm;
        }

        body {
            font-family: DejaVu Sans, sans-serif;
            color: #0f172a;
            font-size: 11px;
            line-height: 1.35;
            margin: 0;
        }

        .doc-header {
            text-align: center;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 10px;
            margin-bottom: 10px;
        }

        .doc-header img {
            max-width: 210px;
            max-height: 64px;
            height: auto;
        }

        .page-title {
            font-size: 22px;
            font-weight: 700;
            margin: 0 0 4px 0;
            color: #0f172a;
        }

        .meta {
            margin: 0 0 10px 0;
            color: #475569;
            font-size: 10px;
        }

        .section {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            margin-bottom: 8px;
            overflow: hidden;
            page-break-inside: avoid;
        }

        .section-title {
            margin: 0;
            padding: 8px 10px;
            font-size: 13px;
            font-weight: 700;
            border-bottom: 1px solid #e2e8f0;
            background: #f8fafc;
            color: #0f172a;
        }

        .grid {
            width: 100%;
            border-collapse: collapse;
        }

        .grid td {
            width: 33.33%;
            vertical-align: top;
            padding: 7px 10px;
            border-right: 1px solid #f1f5f9;
            border-top: 1px solid #f1f5f9;
        }

        .grid td:last-child {
            border-right: none;
        }

        .grid.two td {
            width: 50%;
        }

        .label {
            display: block;
            font-size: 9px;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 2px;
            letter-spacing: .2px;
        }

        .value {
            font-size: 11px;
            color: #0f172a;
            word-break: break-word;
        }

        .obs {
            padding: 8px 10px;
            border-top: 1px solid #f1f5f9;
        }

        .obs p {
            margin: 0 0 6px 0;
        }

        .obs p:last-child {
            margin-bottom: 0;
        }

        .badge {
            display: inline-block;
            margin-left: 8px;
            padding: 1px 8px;
            border-radius: 999px;
            background: #f1f5f9;
            color: #334155;
            font-size: 10px;
            font-weight: 600;
        }
    </style>
</head>
<body>
@php
    $hrLabel = match ((string) ($interview->hr_status?->value ?? $interview->hr_status)) {
        'aprovado' => 'Aprovado',
        'reprovado' => 'Reprovado',
        'aguardando_vaga' => 'Aguardando vaga',
        'guep' => 'GUEP',
        default => 'Teste prático',
    };

    $guepLabel = match ((string) ($interview->guep_status?->value ?? $interview->guep_status)) {
        'nao_fazer' => 'Não fazer',
        'a_fazer' => 'A fazer',
        'aprovado' => 'Aprovado',
        'reprovado' => 'Reprovado',
        default => 'Aguardando',
    };
@endphp

<div class="doc-header">
    @if (!empty($logoDataUri))
        <img src="{{ $logoDataUri }}" alt="Kaique Transportes" />
    @endif
</div>

<h1 class="page-title">
    {{ $interview->full_name }}
    <span class="badge">{{ $hrLabel }}</span>
</h1>
<p class="meta">
    ID: {{ $interview->id }} |
    Entrevistador: {{ $interview->author?->name ?? 'N/A' }} |
    Data: {{ optional($interview->created_at)->format('d/m/Y H:i') }}
</p>

<div class="section">
    <h2 class="section-title">Dados pessoais</h2>
    <table class="grid">
        <tr>
            <td><span class="label">Nome preferido</span><span class="value">{{ $interview->preferred_name }}</span></td>
            <td><span class="label">Entrevistador</span><span class="value">{{ $interview->author?->name ?? 'N/A' }}</span></td>
            <td><span class="label">Telefone</span><span class="value">{{ $interview->phone }}</span></td>
        </tr>
        <tr>
            <td><span class="label">E-mail</span><span class="value">{{ $interview->email }}</span></td>
            <td><span class="label">Cidade</span><span class="value">{{ $interview->city }}</span></td>
            <td><span class="label">Estado civil</span><span class="value">{{ $interview->marital_status }}</span></td>
        </tr>
        <tr>
            <td><span class="label">Possui filhos</span><span class="value">{{ $interview->has_children ? 'Sim' : 'Não' }}</span></td>
            <td><span class="label">Status RH</span><span class="value">{{ $hrLabel }}</span></td>
            <td><span class="label">Status GUEP</span><span class="value">{{ $guepLabel }}</span></td>
        </tr>
    </table>
</div>

<div class="section">
    <h2 class="section-title">Documentos e habilitação</h2>
    <table class="grid">
        <tr>
            <td><span class="label">CPF</span><span class="value">{{ $interview->cpf }}</span></td>
            <td><span class="label">RG</span><span class="value">{{ $interview->rg }}</span></td>
            <td><span class="label">CNH</span><span class="value">{{ $interview->cnh_number }}</span></td>
        </tr>
        <tr>
            <td><span class="label">Categoria</span><span class="value">{{ $interview->cnh_category }}</span></td>
            <td><span class="label">Validade CNH</span><span class="value">{{ optional($interview->cnh_expiration_date)->format('d/m/Y') }}</span></td>
            <td><span class="label">EAR</span><span class="value">{{ $interview->ear ? 'Sim' : 'Não' }}</span></td>
        </tr>
    </table>
</div>

<div class="section">
    <h2 class="section-title">Experiência e disponibilidade</h2>
    <table class="grid two">
        <tr>
            <td><span class="label">Última empresa</span><span class="value">{{ $interview->last_company }}</span></td>
            <td><span class="label">Última função</span><span class="value">{{ $interview->last_role }}</span></td>
        </tr>
        <tr>
            <td><span class="label">Última cidade</span><span class="value">{{ $interview->last_city }}</span></td>
            <td><span class="label">Período última</span><span class="value">{{ optional($interview->last_period_start)->format('d/m/Y') }} até {{ optional($interview->last_period_end)->format('d/m/Y') }}</span></td>
        </tr>
        <tr>
            <td><span class="label">Motivo última saída</span><span class="value">{{ $interview->last_exit_reason }}</span></td>
            <td><span class="label">Penúltima empresa</span><span class="value">{{ $interview->previous_company }}</span></td>
        </tr>
        <tr>
            <td><span class="label">Penúltima função</span><span class="value">{{ $interview->previous_role }}</span></td>
            <td><span class="label">Penúltima cidade</span><span class="value">{{ $interview->previous_city }}</span></td>
        </tr>
        <tr>
            <td><span class="label">Período penúltima</span><span class="value">{{ optional($interview->previous_period_start)->format('d/m/Y') }} até {{ optional($interview->previous_period_end)->format('d/m/Y') }}</span></td>
            <td><span class="label">Motivo penúltima saída</span><span class="value">{{ $interview->previous_exit_reason }}</span></td>
        </tr>
        <tr>
            <td><span class="label">Trabalho noturno</span><span class="value">{{ $interview->night_shift_experience ? 'Sim' : 'Não' }}</span></td>
            <td><span class="label">Transporte de aves vivas</span><span class="value">{{ $interview->live_animals_transport_experience ? 'Sim' : 'Não' }}</span></td>
        </tr>
        <tr>
            <td><span class="label">Acidente</span><span class="value">{{ $interview->accident_history ? 'Sim' : 'Não' }}</span></td>
            <td><span class="label">Detalhes do acidente</span><span class="value">{{ $interview->accident_details ?: 'N/A' }}</span></td>
        </tr>
        <tr>
            <td><span class="label">Disponibilidade de escala</span><span class="value">{{ $interview->schedule_availability }}</span></td>
            <td><span class="label">Início disponível</span><span class="value">{{ optional($interview->start_availability_date)->format('d/m/Y') }}</span></td>
        </tr>
        <tr>
            <td><span class="label">Conhece alguém na empresa</span><span class="value">{{ $interview->knows_company_contact ? 'Sim' : 'Não' }}</span></td>
            <td><span class="label">Contato conhecido</span><span class="value">{{ $interview->contact_name ?: 'N/A' }}</span></td>
        </tr>
    </table>
</div>

<div class="section">
    <h2 class="section-title">Avaliação final</h2>
    <table class="grid">
        <tr>
            <td><span class="label">Último salário</span><span class="value">R$ {{ number_format((float) $interview->last_salary, 2, ',', '.') }}</span></td>
            <td><span class="label">Pretensão salarial</span><span class="value">R$ {{ number_format((float) $interview->salary_expectation, 2, ',', '.') }}</span></td>
            <td><span class="label">Interesse</span><span class="value">{{ $interview->candidate_interest?->value ?? $interview->candidate_interest }}</span></td>
        </tr>
        <tr>
            <td><span class="label">Atende disponibilidade</span><span class="value">{{ $interview->availability_matches ? 'Sim' : 'Não' }}</span></td>
            <td><span class="label">Nota geral</span><span class="value">{{ $interview->overall_score }}</span></td>
            <td><span class="label">Postura e comunicação</span><span class="value">{{ $interview->posture_communication }}</span></td>
        </tr>
        <tr>
            <td><span class="label">Experiência percebida</span><span class="value">{{ $interview->perceived_experience }}</span></td>
            <td><span class="label">Tipos de caminhão</span><span class="value">{{ $interview->truck_types_operated }}</span></td>
            <td><span class="label">Expectativas sobre a empresa</span><span class="value">{{ $interview->expectations_about_company }}</span></td>
        </tr>
    </table>
    <div class="obs">
        <p><strong>Experiência relevante:</strong> {{ $interview->relevant_experience }}</p>
        <p><strong>Observações gerais:</strong> {{ $interview->general_observations }}</p>
    </div>
</div>
</body>
</html>
