import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/api-client';
import { formatCurrencyBR } from '@/lib/transport-format';

interface Unidade {
    id: number;
    nome: string;
}

interface UnitReport {
    total_pago_periodo: number;
    colaboradores_pagos: number;
    media_salarial_mes: number;
    competencia_inicial: string;
    competencia_final: string;
    distribuicao: Array<{ faixa: string; quantidade: number }>;
    evolucao_mensal: Array<{
        competencia_ano: number;
        competencia_mes: number;
        total_valor: number;
        total_lancamentos: number;
    }>;
}

interface WrappedResponse<T> {
    data: T;
}

export default function TransportPayrollReportUnitPage() {
    const currentYear = new Date().getFullYear();
    const [unidades, setUnidades] = useState<Unidade[]>([]);
    const [unidadeId, setUnidadeId] = useState('');
    const [competenciaInicial, setCompetenciaInicial] = useState(`${currentYear}-01`);
    const [competenciaFinal, setCompetenciaFinal] = useState(`${currentYear}-12`);
    const [report, setReport] = useState<UnitReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [hoveredPoint, setHoveredPoint] = useState<{
        xPercent: number;
        yPercent: number;
        label: string;
    } | null>(null);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    function applyRangePreset(days: 7 | 30 | 90): void {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days + 1);

        const toMonth = (value: Date): string => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;

        setCompetenciaInicial(toMonth(start));
        setCompetenciaFinal(toMonth(end));
    }

    const chartData = useMemo(() => {
        if (!report || report.evolucao_mensal.length === 0) return null;

        const width = Math.max(560, report.evolucao_mensal.length * 56);
        const height = 190;
        const paddingX = 28;
        const paddingY = 20;
        const maxValue = Math.max(...report.evolucao_mensal.map((item) => item.total_valor), 1);
        const safeRange = Math.max(maxValue, 1);

        const points = report.evolucao_mensal.map((item, index) => {
            const x =
                report.evolucao_mensal.length === 1
                    ? width / 2
                    : paddingX + (index * (width - paddingX * 2)) / (report.evolucao_mensal.length - 1);
            const y = paddingY + (1 - item.total_valor / safeRange) * (height - paddingY * 2);

            return {
                ...item,
                x,
                y,
                label: `${String(item.competencia_mes).padStart(2, '0')}/${String(item.competencia_ano).slice(-2)}`,
            };
        });

        const path = points
            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
            .join(' ');

        return { width, height, points, path };
    }, [report]);

    async function loadUnits(): Promise<void> {
        try {
            const response =
                await apiGet<WrappedResponse<Unidade[]>>('/registry/unidades');
            setUnidades(response.data);
            if (!unidadeId && response.data.length) {
                setUnidadeId(String(response.data[0].id));
            }
        } catch {
            setNotification({
                message: 'Não foi possível carregar unidades.',
                variant: 'error',
            });
        }
    }

    async function loadReport(): Promise<void> {
        if (!unidadeId) return;

        setLoading(true);
        setNotification(null);

        try {
            const response = await apiGet<UnitReport>(
                `/payroll/reports/unidade?unidade_id=${unidadeId}&competencia_inicial=${competenciaInicial}&competencia_final=${competenciaFinal}`,
            );
            setReport(response);
        } catch {
            setNotification({
                message: 'Não foi possível carregar o relatório por unidade.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadUnits();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (unidadeId) void loadReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unidadeId, competenciaInicial, competenciaFinal]);

    return (
        <AdminLayout
            title="Pagamentos - Relatório por Unidade"
            active="payroll-report-unit"
            module="payroll"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">
                        Relatório por Unidade
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Métricas de pagamentos, distribuição e evolução mensal
                        por unidade.
                    </p>
                </div>

                {notification ? (
                    <Notification
                        message={notification.message}
                        variant={notification.variant}
                    />
                ) : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label>Unidade</Label>
                                <Select
                                    value={unidadeId}
                                    onValueChange={setUnidadeId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {unidades.map((u) => (
                                            <SelectItem
                                                key={u.id}
                                                value={String(u.id)}
                                            >
                                                {u.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="competencia-inicial">Mês inicial</Label>
                                <input
                                    id="competencia-inicial"
                                    type="month"
                                    value={competenciaInicial}
                                    onChange={(event) => setCompetenciaInicial(event.target.value)}
                                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="competencia-final">Mês final</Label>
                                <input
                                    id="competencia-final"
                                    type="month"
                                    value={competenciaFinal}
                                    onChange={(event) => setCompetenciaFinal(event.target.value)}
                                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                                />
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <div className="mr-auto flex gap-2">
                                <Button type="button" variant="outline" onClick={() => applyRangePreset(7)}>7 dias</Button>
                                <Button type="button" variant="outline" onClick={() => applyRangePreset(30)}>30 dias</Button>
                                <Button type="button" variant="outline" onClick={() => applyRangePreset(90)}>90 dias</Button>
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => void loadReport()}
                            >
                                Atualizar relatório
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {loading ? (
                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-3">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <Card key={`unit-report-skeleton-kpi-${index}`}>
                                    <CardHeader>
                                        <Skeleton className="h-4 w-2/3" />
                                    </CardHeader>
                                    <CardContent>
                                        <Skeleton className="h-8 w-1/2" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        <div className="grid gap-4 xl:grid-cols-2">
                            <Card>
                                <CardContent className="space-y-3 pt-6">
                                    <Skeleton className="h-5 w-40" />
                                    <Skeleton className="h-24 w-full" />
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="space-y-3 pt-6">
                                    <Skeleton className="h-5 w-48" />
                                    <Skeleton className="h-40 w-full" />
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                ) : report ? (
                    <>
                        <div className="grid gap-4 md:grid-cols-3">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Total pago no período
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {formatCurrencyBR(report.total_pago_periodo)}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Colaboradores pagos
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {report.colaboradores_pagos}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Média salarial por mês
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {formatCurrencyBR(report.media_salarial_mes)}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Distribuição (faixas)</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {report.distribuicao.map((item) => (
                                        <div
                                            key={item.faixa}
                                            className="rounded-md border p-3 text-sm"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span>{item.faixa}</span>
                                                <span className="font-semibold">
                                                    {item.quantidade}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Variação mensal</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {!chartData ? (
                                        <p className="text-sm text-muted-foreground">
                                            Sem histórico para exibir.
                                        </p>
                                    ) : (
                                            <div className="relative overflow-x-auto">
                                                {hoveredPoint ? (
                                                    <div
                                                        className="bg-popover text-popover-foreground pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-md border px-2 py-1 text-xs shadow"
                                                        style={{
                                                            left: `${hoveredPoint.xPercent}%`,
                                                            top: `${hoveredPoint.yPercent}%`,
                                                        }}
                                                    >
                                                        {hoveredPoint.label}
                                                    </div>
                                                ) : null}
                                            <svg
                                                width={chartData.width}
                                                height={chartData.height}
                                                viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                                                className="min-w-full"
                                            >
                                                <path
                                                    d={chartData.path}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    className="text-primary"
                                                />
                                                {chartData.points.map((point) => (
                                                    <g key={`${point.competencia_ano}-${point.competencia_mes}`}>
                                                        <circle
                                                            cx={point.x}
                                                            cy={point.y}
                                                            r="4"
                                                            className="fill-primary"
                                                            onMouseEnter={() =>
                                                                setHoveredPoint({
                                                                    xPercent: (point.x / chartData.width) * 100,
                                                                    yPercent: (point.y / chartData.height) * 100,
                                                                    label: `${point.label} • ${formatCurrencyBR(point.total_valor)}`,
                                                                })
                                                            }
                                                            onMouseLeave={() => setHoveredPoint(null)}
                                                        >
                                                            <title>
                                                                {point.label}: {formatCurrencyBR(point.total_valor)}
                                                            </title>
                                                        </circle>
                                                        <text
                                                            x={point.x}
                                                            y={chartData.height - 4}
                                                            textAnchor="middle"
                                                            fontSize="10"
                                                            className="fill-muted-foreground"
                                                        >
                                                            {point.label}
                                                        </text>
                                                    </g>
                                                ))}
                                            </svg>
                                        </div>
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
