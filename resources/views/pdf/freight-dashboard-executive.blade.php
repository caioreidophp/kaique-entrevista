<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <title>Resumo executivo de fretes</title>
    <style>
        @page { margin: 22px 24px; }
        * { box-sizing: border-box; }
        body {
            color: #0f172a;
            font-family: DejaVu Sans, sans-serif;
            font-size: 10px;
            line-height: 1.35;
        }
        .header {
            border-bottom: 1px solid #cbd5e1;
            margin-bottom: 12px;
            padding-bottom: 10px;
        }
        .eyebrow {
            color: #475569;
            font-size: 9px;
            letter-spacing: .06em;
            margin: 0 0 3px;
            text-transform: uppercase;
        }
        h1 {
            font-size: 20px;
            line-height: 1.1;
            margin: 0;
        }
        .meta {
            color: #475569;
            margin-top: 5px;
        }
        .grid {
            display: table;
            table-layout: fixed;
            width: 100%;
        }
        .cell {
            display: table-cell;
            padding-right: 8px;
            vertical-align: top;
        }
        .card {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 9px 10px;
        }
        .kpi-label {
            color: #475569;
            font-size: 8px;
            text-transform: uppercase;
        }
        .kpi-value {
            font-size: 16px;
            font-weight: 700;
            margin-top: 2px;
        }
        .kpi-detail {
            color: #64748b;
            margin-top: 2px;
        }
        .section-title {
            font-size: 12px;
            font-weight: 700;
            margin: 14px 0 6px;
        }
        .note {
            border-left: 3px solid #0284c7;
            padding: 4px 0 4px 8px;
        }
        .note strong {
            display: block;
            font-size: 11px;
        }
        .note span {
            color: #475569;
        }
        table {
            border-collapse: collapse;
            width: 100%;
        }
        th {
            background: #f1f5f9;
            color: #475569;
            font-size: 8px;
            font-weight: 700;
            padding: 5px 6px;
            text-align: right;
            text-transform: uppercase;
        }
        th:first-child,
        td:first-child {
            text-align: left;
        }
        td {
            border-bottom: 1px solid #e2e8f0;
            padding: 5px 6px;
            text-align: right;
        }
        .muted { color: #64748b; }
        .footer {
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 8px;
            margin-top: 12px;
            padding-top: 6px;
        }
    </style>
</head>
<body>
@php
    $money = fn ($value) => 'R$ '.number_format((float) $value, 2, ',', '.');
    $integer = fn ($value) => number_format((float) $value, 0, ',', '.');
    $decimal = fn ($value, $places = 2) => number_format((float) $value, $places, ',', '.');
    $leader = $rows->first();
    $bestKm = $rows
        ->filter(fn ($row) => (float) ($row['frete_por_km'] ?? 0) > 0)
        ->sortBy(fn ($row) => (float) ($row['frete_por_km'] ?? 0))
        ->first();
    $topRows = $rows->take(6);
@endphp

<div class="header">
    <p class="eyebrow">Kaique Transportes · Fretes</p>
    <h1>Resumo executivo de fretes</h1>
    <div class="meta">
        Período: {{ $periodLabel }} · Unidade: {{ $unitLabel }} · Base:
        {{ $includeSpot ? 'Kaique + spot' : 'Kaique sem spot' }} · Gerado em {{ $generatedAt }}
    </div>
</div>

<div class="grid">
    <div class="cell">
        <div class="card">
            <div class="kpi-label">Frete Kaique</div>
            <div class="kpi-value">{{ $money($totals['frete']) }}</div>
            <div class="kpi-detail">{{ $integer($totals['lancamentos']) }} lançamento(s)</div>
        </div>
    </div>
    <div class="cell">
        <div class="card">
            <div class="kpi-label">Viagens</div>
            <div class="kpi-value">{{ $integer($totals['viagens']) }}</div>
            <div class="kpi-detail">{{ $integer($totals['aves']) }} aves</div>
        </div>
    </div>
    <div class="cell">
        <div class="card">
            <div class="kpi-label">KM Kaique</div>
            <div class="kpi-value">{{ $integer($totals['km']) }}</div>
            <div class="kpi-detail">{{ $money($totals['frete_por_km']) }} por km</div>
        </div>
    </div>
    <div class="cell" style="padding-right: 0">
        <div class="card">
            <div class="kpi-label">Spot / terceiros</div>
            <div class="kpi-value">{{ $decimal($totals['spot_percent']) }}%</div>
            <div class="kpi-detail">{{ $decimal($totals['terceiros_percent']) }}% terceiros</div>
        </div>
    </div>
</div>

<div class="section-title">Leitura operacional</div>
<div class="grid">
    <div class="cell">
        <div class="note">
            <strong>{{ $leader['unidade_nome'] ?? 'Sem unidade' }}</strong>
            <span>maior frete no período, com {{ $money($leader['total_frete'] ?? 0) }} e {{ $integer($leader['total_viagens_kaique'] ?? 0) }} viagens.</span>
        </div>
    </div>
    <div class="cell">
        <div class="note">
            <strong>{{ $bestKm['unidade_nome'] ?? 'Sem referência' }}</strong>
            <span>menor custo por km entre unidades com KM informado: {{ $money($bestKm['frete_por_km'] ?? 0) }}.</span>
        </div>
    </div>
    <div class="cell" style="padding-right: 0">
        <div class="note">
            <strong>{{ count($dashboard['alerts'] ?? []) }} alerta(s)</strong>
            <span>{{ count($dashboard['alerts'] ?? []) > 0 ? 'Há pontos para conferência operacional.' : 'Sem alertas automáticos para o período.' }}</span>
        </div>
    </div>
</div>

<div class="section-title">Ranking por unidade</div>
<table>
    <thead>
        <tr>
            <th>Unidade</th>
            <th>Frete</th>
            <th>Viagens</th>
            <th>KM</th>
            <th>R$/KM</th>
            <th>Aves</th>
            <th>3º / prog.</th>
        </tr>
    </thead>
    <tbody>
        @forelse ($topRows as $row)
            <tr>
                <td>{{ $row['unidade_nome'] ?? 'Sem unidade' }}</td>
                <td>{{ $money($row['total_frete'] ?? 0) }}</td>
                <td>{{ $integer($row['total_viagens_kaique'] ?? 0) }}</td>
                <td>{{ $integer($row['total_km'] ?? 0) }}</td>
                <td>{{ $money($row['frete_por_km'] ?? 0) }}</td>
                <td>{{ $integer($row['total_aves'] ?? 0) }}</td>
                <td>{{ $decimal($row['percentual_frete_terceiros_sobre_programado'] ?? 0) }}%</td>
            </tr>
        @empty
            <tr>
                <td colspan="7" class="muted">Sem dados no período.</td>
            </tr>
        @endforelse
    </tbody>
</table>

@if (! empty($dashboard['alerts']))
    <div class="section-title">Conferências recomendadas</div>
    @foreach (array_slice($dashboard['alerts'], 0, 3) as $alert)
        <div class="muted">· {{ $alert['message'] }}</div>
    @endforeach
@endif

<div class="footer">
    Relatório compacto para conferência executiva. A tela do sistema mantém o detalhamento diário completo.
</div>
</body>
</html>
