import { AlertTriangle, LoaderCircle, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { apiGet } from '@/lib/api-client';
import { formatCurrencyBR, formatIntegerBR, formatPercentBR } from '@/lib/transport-format';

interface DashboardPagamento {
    id: number;
    competencia_mes: number;
    competencia_ano: number;
    valor: string;
    colaborador?: { nome: string };
    unidade?: { nome: string };
}

interface PayrollDashboard {
    competencia_mes: number;
    competencia_ano: number;
    colaboradores_pagos_mes: number;
    total_pagamentos_a_fazer: number;
    total_pagamentos_lancados: number;
    colaboradores_ativos: number;
    total_a_pagar_mes_atual: number;
    totais_por_tipo: Array<{
        tipo_pagamento_id: number | null;
        tipo_pagamento_nome: string;
        total_lancamentos: number;
        total_valor: number;
    }>;
    totais_por_unidade: Array<{
        unidade_id: number;
        unidade_nome: string | null;
        total_lancamentos: number;
        total_valor: number;
    }>;
    pagamentos_recentes: DashboardPagamento[];
}

interface PayrollDashboardPageResponse {
    dashboard: PayrollDashboard;
    summary: {
        competencia_mes: number;
        competencia_ano: number;
        total_lancamentos: number;
        total_colaboradores: number;
        total_valor: number;
        por_unidade: Array<{
            unidade_id: number;
            unidade_nome: string | null;
            total_lancamentos: number;
            total_valor: number;
        }>;
    };
}

interface DonutSlice {
    label: string;
    value: number;
    percent: number;
    color: string;
    path: string;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return {
        x: cx + radius * Math.cos(angleRad),
        y: cy + radius * Math.sin(angleRad),
    };
}

function donutPath(cx: number, cy: number, outerRadius: number, innerRadius: number, startAngle: number, endAngle: number): string {
    const angleDelta = Math.abs(endAngle - startAngle);

    if (angleDelta >= 359.999) {
        return [
            `M ${cx} ${cy - outerRadius}`,
            `A ${outerRadius} ${outerRadius} 0 1 1 ${cx} ${cy + outerRadius}`,
            `A ${outerRadius} ${outerRadius} 0 1 1 ${cx} ${cy - outerRadius}`,
            `L ${cx} ${cy - innerRadius}`,
            `A ${innerRadius} ${innerRadius} 0 1 0 ${cx} ${cy + innerRadius}`,
            `A ${innerRadius} ${innerRadius} 0 1 0 ${cx} ${cy - innerRadius}`,
            'Z',
        ].join(' ');
    }

    const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
    const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
    const innerStart = polarToCartesian(cx, cy, innerRadius, endAngle);
    const innerEnd = polarToCartesian(cx, cy, innerRadius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return [
        `M ${outerStart.x} ${outerStart.y}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
        `L ${innerEnd.x} ${innerEnd.y}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerStart.x} ${innerStart.y}`,
        'Z',
    ].join(' ');
}

export default function TransportPayrollDashboardPage() {
    const currentYear = new Date().getFullYear();
    const [data, setData] = useState<PayrollDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredTypeIndex, setHoveredTypeIndex] = useState<number | null>(null);
    const [competenciaMes, setCompetenciaMes] = useState(String(new Date().getMonth() + 1));
    const [competenciaAno, setCompetenciaAno] = useState(String(currentYear));

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams({
            competencia_mes: competenciaMes,
            competencia_ano: competenciaAno,
        });

        apiGet<PayrollDashboardPageResponse>(`/payroll/dashboard-page?${params.toString()}`)
            .then((response) => setData(response.dashboard))
            .catch(() =>
                setError('Não foi possível carregar o dashboard de pagamentos.'),
            )
            .finally(() => setLoading(false));
    }, [competenciaAno, competenciaMes]);

    const monthOptions = useMemo(
        () => [
            { value: '1', label: 'Janeiro' },
            { value: '2', label: 'Fevereiro' },
            { value: '3', label: 'Março' },
            { value: '4', label: 'Abril' },
            { value: '5', label: 'Maio' },
            { value: '6', label: 'Junho' },
            { value: '7', label: 'Julho' },
            { value: '8', label: 'Agosto' },
            { value: '9', label: 'Setembro' },
            { value: '10', label: 'Outubro' },
            { value: '11', label: 'Novembro' },
            { value: '12', label: 'Dezembro' },
        ],
        [],
    );

    const yearOptions = useMemo(
        () => [String(currentYear - 1), String(currentYear), String(currentYear + 1)],
        [currentYear],
    );

    const monthLabel = useMemo(() => {
        if (!data) return '';
        return `${String(data.competencia_mes).padStart(2, '0')}/${data.competencia_ano}`;
    }, [data]);

    const averageByPaidCollaborator = useMemo(() => {
        if (!data || data.colaboradores_pagos_mes === 0) return 0;
        return data.total_a_pagar_mes_atual / data.colaboradores_pagos_mes;
    }, [data]);

    const topUnit = useMemo(() => {
        if (!data || data.totais_por_unidade.length === 0) return null;

        return [...data.totais_por_unidade].sort((a, b) => b.total_valor - a.total_valor)[0] ?? null;
    }, [data]);

    const concentrationTopUnit = useMemo(() => {
        if (!data || !topUnit || data.total_a_pagar_mes_atual <= 0) return 0;
        return (topUnit.total_valor / data.total_a_pagar_mes_atual) * 100;
    }, [data, topUnit]);

    const donutData = useMemo(() => {
        if (!data || data.totais_por_tipo.length === 0) return [] as DonutSlice[];

        const total = data.totais_por_tipo.reduce((sum, item) => sum + item.total_valor, 0);
        if (total <= 0) return [] as DonutSlice[];

        const colors = [
            '#2563eb',
            '#16a34a',
            '#f59e0b',
            '#ef4444',
            '#9333ea',
            '#06b6d4',
            '#f97316',
            '#14b8a6',
            '#e11d48',
            '#6366f1',
        ];

        const cx = 160;
        const cy = 160;
        const outerRadius = 110;
        const innerRadius = 62;
        let currentAngle = 0;

        return data.totais_por_tipo.map((item, index) => {
            const ratio = item.total_valor / total;
            const degrees = ratio * 360;
            const start = currentAngle;
            const end = currentAngle + degrees;
            currentAngle = end;

            return {
                label: item.tipo_pagamento_nome,
                value: item.total_valor,
                percent: ratio * 100,
                color: colors[index % colors.length],
                path: donutPath(cx, cy, outerRadius, innerRadius, start, end),
            };
        });
    }, [data]);

    const hoveredSlice = hoveredTypeIndex !== null ? donutData[hoveredTypeIndex] : null;

    return (
        <AdminLayout
            title="Pagamentos - Dashboard"
            active="payroll-dashboard"
            module="payroll"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">
                        Dashboard Pagamentos
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Visão geral dos pagamentos da competência atual{' '}
                        {monthLabel ? `(${monthLabel})` : ''}.
                    </p>
                </div>

                {error ? (
                    <Notification message={error} variant="error" />
                ) : null}

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando dashboard...
                    </div>
                ) : data ? (
                    <>
                        <Card>
                            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <CardTitle>Distribuição por tipo de pagamento</CardTitle>
                                <div className="grid w-full gap-2 md:w-auto md:grid-cols-2">
                                    <Select value={competenciaMes} onValueChange={setCompetenciaMes}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {monthOptions.map((item) => (
                                                <SelectItem key={item.value} value={item.value}>
                                                    {item.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={competenciaAno} onValueChange={setCompetenciaAno}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {yearOptions.map((item) => (
                                                <SelectItem key={item} value={item}>
                                                    {item}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent className="grid gap-4 lg:grid-cols-[340px_1fr]">
                                {donutData.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        Sem dados por tipo no período.
                                    </p>
                                ) : (
                                    <>
                                        <div className="mx-auto flex items-center justify-center">
                                            <div className="relative h-[320px] w-[320px]">
                                                <svg viewBox="0 0 320 320" className="h-full w-full">
                                                    {donutData.map((slice, index) => (
                                                        <path
                                                            key={`${slice.label}-${index}`}
                                                            d={slice.path}
                                                            fill={slice.color}
                                                            className="cursor-pointer transition-opacity"
                                                            style={{ opacity: hoveredTypeIndex === null || hoveredTypeIndex === index ? 1 : 0.45 }}
                                                            onMouseEnter={() => setHoveredTypeIndex(index)}
                                                            onMouseLeave={() => setHoveredTypeIndex(null)}
                                                        />
                                                    ))}
                                                </svg>

                                                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                                                    <p className="text-xs text-muted-foreground">
                                                        {hoveredSlice ? hoveredSlice.label : 'Total do mês'}
                                                    </p>
                                                    <p className="text-lg font-semibold">
                                                        {hoveredSlice
                                                            ? formatPercentBR(hoveredSlice.percent)
                                                            : formatCurrencyBR(data.total_a_pagar_mes_atual)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {donutData.map((slice, index) => (
                                                <div
                                                    key={`${slice.label}-legend-${index}`}
                                                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                                                    onMouseEnter={() => setHoveredTypeIndex(index)}
                                                    onMouseLeave={() => setHoveredTypeIndex(null)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="inline-block size-3 rounded-sm"
                                                            style={{ backgroundColor: slice.color }}
                                                        />
                                                        <span>{slice.label}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-medium">{formatCurrencyBR(slice.value)}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatPercentBR(slice.percent)}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-1">
                            <Card className="transport-kpi-card">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Total a pagar (mês)
                                    </CardTitle>
                                    <span className="transport-kpi-icon">
                                        <Wallet className="size-4" />
                                    </span>
                                </CardHeader>
                                <CardContent>
                                    <p className="transport-kpi-value">
                                        {formatCurrencyBR(
                                            data.total_a_pagar_mes_atual,
                                        )}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Card className="transport-kpi-card">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Valor médio por colaborador pago
                                    </CardTitle>
                                    <span className="transport-kpi-icon">
                                        <Wallet className="size-4" />
                                    </span>
                                </CardHeader>
                                <CardContent>
                                    <p className="transport-kpi-value">{formatCurrencyBR(averageByPaidCollaborator)}</p>
                                    <p className="transport-kpi-detail">
                                        Total dos pagamentos no mês dividido pela quantidade de colaboradores que receberam pagamento.
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="transport-kpi-card">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Unidade com maior volume
                                    </CardTitle>
                                    <span className="transport-kpi-icon">
                                        <AlertTriangle className="size-4" />
                                    </span>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg font-semibold">{topUnit?.unidade_nome ?? '-'}</p>
                                    <p className="transport-kpi-detail">
                                        {topUnit
                                            ? `${formatCurrencyBR(topUnit.total_valor)} • ${formatPercentBR(concentrationTopUnit)} do total do mês`
                                            : 'Sem dados no período.'}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Totais por unidade</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {data.totais_por_unidade.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Sem lançamentos no período.
                                        </p>
                                    ) : (
                                        data.totais_por_unidade.map((item) => (
                                            <div
                                                key={item.unidade_id}
                                                className="flex items-center justify-between rounded-md border p-3 text-sm"
                                            >
                                                <div>
                                                    <p className="font-medium">
                                                        {item.unidade_nome ??
                                                            'Sem unidade'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.total_lancamentos}{' '}
                                                        lançamentos
                                                    </p>
                                                </div>
                                                <p className="font-semibold">
                                                    {formatCurrencyBR(
                                                        item.total_valor,
                                                    )}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Pagamentos recentes</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {data.pagamentos_recentes.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Sem pagamentos recentes.
                                        </p>
                                    ) : (
                                        data.pagamentos_recentes.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between rounded-md border p-3 text-sm"
                                            >
                                                <div>
                                                    <p className="font-medium">
                                                        {item.colaborador
                                                            ?.nome ?? '-'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.unidade?.nome ??
                                                            '-'}{' '}
                                                        •{' '}
                                                        {String(
                                                            item.competencia_mes,
                                                        ).padStart(2, '0')}
                                                        /{item.competencia_ano}
                                                    </p>
                                                </div>
                                                <p className="font-semibold">
                                                    {formatCurrencyBR(item.valor)}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </>
                ) : null}
            </div>
        </AdminLayout>
    );
}
