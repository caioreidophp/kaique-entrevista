import { AlertTriangle, Filter, LoaderCircle, PieChart, TrendingUp } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { apiGet } from '@/lib/api-client';
import { formatCurrencyBR, formatIntegerBR } from '@/lib/transport-format';

interface UnitItem {
    id: number;
    nome: string;
}

interface ChartRow {
    label: string;
    quantidade: number;
    valor_total: number;
}

interface DashboardResponse {
    filters: {
        data_inicio: string;
        data_fim: string;
        unidade_id: number | null;
    };
    unidades: UnitItem[];
    totals: {
        quantidade: number;
        valor: number;
        valor_medio: number;
        vencidas_em_aberto: {
            quantidade: number;
            valor: number;
        };
        status_summary: Record<string, { quantidade: number; valor: number }>;
        top_placa?: ChartRow | null;
        top_motorista?: ChartRow | null;
        top_unidades: ChartRow[];
    };
    charts: {
        infracao: ChartRow[];
        culpa: ChartRow[];
        tipo_valor: ChartRow[];
        status: ChartRow[];
        placa: ChartRow[];
        motorista: ChartRow[];
    };
    alerts: Array<{
        level: 'warning' | 'info';
        title: string;
        detail: string;
    }>;
}

type ValueMode = 'quantidade' | 'valor_total';

const chartColors = [
    '#0f766e',
    '#1d4ed8',
    '#b45309',
    '#9f1239',
    '#4c1d95',
    '#166534',
    '#0f172a',
    '#a21caf',
    '#0369a1',
    '#334155',
];

const piePalettes: string[][] = [
    ['#0f766e', '#2563eb', '#f59e0b', '#be123c', '#7c3aed', '#0891b2', '#334155'],
    ['#7c3aed', '#16a34a', '#ea580c', '#0ea5e9', '#e11d48', '#14b8a6', '#1f2937'],
    ['#2563eb', '#059669', '#d97706', '#9333ea', '#ef4444', '#0d9488', '#475569'],
    ['#be123c', '#2563eb', '#0f766e', '#ca8a04', '#7e22ce', '#0284c7', '#374151'],
    ['#0891b2', '#16a34a', '#2563eb', '#ea580c', '#c026d3', '#dc2626', '#334155'],
    ['#7c2d12', '#0f766e', '#4338ca', '#ca8a04', '#b91c1c', '#0ea5e9', '#1e293b'],
];

function paletteBySeed(seed: number): string[] {
    return piePalettes[seed % piePalettes.length] ?? chartColors;
}

function compressRows(rows: ChartRow[], mode: ValueMode, maxItems = 8): ChartRow[] {
    const ordered = [...rows]
        .filter((row) => Number(row[mode] ?? 0) > 0)
        .sort((a, b) => Number(b[mode] ?? 0) - Number(a[mode] ?? 0));

    if (ordered.length <= maxItems) {
        return ordered;
    }

    const head = ordered.slice(0, maxItems - 1);
    const tail = ordered.slice(maxItems - 1);

    const other: ChartRow = {
        label: 'Outros',
        quantidade: tail.reduce((sum, item) => sum + Number(item.quantidade ?? 0), 0),
        valor_total: tail.reduce((sum, item) => sum + Number(item.valor_total ?? 0), 0),
    };

    return [...head, other];
}

function buildConicGradient(rows: ChartRow[], mode: ValueMode, palette: string[]): string {
    const total = rows.reduce((sum, row) => sum + Number(row[mode] ?? 0), 0);

    if (total <= 0 || rows.length === 0) {
        return '#e5e7eb';
    }

    let start = 0;

    const segments = rows.map((row, index) => {
        const value = Number(row[mode] ?? 0);
        const ratio = value / total;
        const end = start + ratio * 100;
        const color = palette[index % palette.length];
        const segment = `${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;

        start = end;

        return segment;
    });

    return `conic-gradient(${segments.join(', ')})`;
}

function formatRowValue(row: ChartRow, mode: ValueMode): string {
    if (mode === 'valor_total') {
        return formatCurrencyBR(row.valor_total);
    }

    return formatIntegerBR(row.quantidade);
}

const PieSummaryCard = memo(function PieSummaryCard({
    title,
    rows,
    mode,
    colorSeed,
}: {
    title: string;
    rows: ChartRow[];
    mode: ValueMode;
    colorSeed: number;
}) {
    const compactRows = useMemo(() => compressRows(rows, mode), [rows, mode]);
    const palette = useMemo(() => paletteBySeed(colorSeed), [colorSeed]);
    const total = useMemo(
        () => compactRows.reduce((sum, row) => sum + Number(row[mode] ?? 0), 0),
        [compactRows, mode],
    );
    const gradient = useMemo(
        () => buildConicGradient(compactRows, mode, palette),
        [compactRows, mode, palette],
    );

    return (
        <Card className="transport-insight-card h-full">
            <CardHeader>
                <CardTitle className="transport-dashboard-section-title">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                {rows.length === 0 || total <= 0 ? (
                    <p className="text-sm text-muted-foreground">Sem dados no período.</p>
                ) : (
                    <div className="space-y-4">
                        <div className="flex justify-center">
                            <div
                                className="relative h-32 w-32 rounded-full"
                                style={{ background: gradient }}
                                aria-label={`Gráfico ${title}`}
                            >
                                <div className="absolute inset-5 rounded-full bg-card" />
                            </div>
                        </div>
                        <div className="max-h-44 space-y-2 overflow-y-auto pr-1 text-sm">
                            {compactRows.map((row, index) => {
                                const value = Number(row[mode] ?? 0);
                                const percentage = total > 0 ? (value / total) * 100 : 0;
                                const color = palette[index % palette.length];

                                return (
                                    <div key={`${title}-${row.label}-${index}`} className="flex items-start justify-between gap-2">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span
                                                className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                                                style={{ backgroundColor: color }}
                                                aria-hidden="true"
                                            />
                                            <span className="truncate text-muted-foreground">{row.label}</span>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="font-medium">{formatRowValue(row, mode)}</p>
                                            <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
});

const ColumnComparisonCard = memo(function ColumnComparisonCard({
    title,
    rows,
}: {
    title: string;
    rows: ChartRow[];
}) {
    const compactRows = useMemo(() => compressRows(rows, 'valor_total', 7), [rows]);
    const maxQty = Math.max(0, ...compactRows.map((row) => row.quantidade));
    const maxValue = Math.max(0, ...compactRows.map((row) => row.valor_total));

    return (
        <Card className="transport-insight-card h-full">
            <CardHeader>
                <CardTitle className="transport-dashboard-section-title">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                {compactRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem dados no período.</p>
                ) : (
                    <div className="space-y-4">
                        <div className="overflow-x-auto pb-1">
                            <div className="flex min-w-[560px] items-end gap-4">
                                {compactRows.map((row, index) => {
                                    const qtyPercent = maxQty > 0 ? (row.quantidade / maxQty) * 100 : 0;
                                    const valuePercent = maxValue > 0 ? (row.valor_total / maxValue) * 100 : 0;
                                    const qtyHeight = Math.max(8, Math.round((qtyPercent / 100) * 180));
                                    const valueHeight = Math.max(8, Math.round((valuePercent / 100) * 180));

                                    return (
                                        <div key={`${title}-${row.label}-${index}`} className="flex w-20 shrink-0 flex-col items-center gap-2">
                                            <div className="flex h-[188px] items-end gap-1.5">
                                                <div
                                                    className="w-3 rounded-t bg-sky-600"
                                                    style={{ height: `${qtyHeight}px` }}
                                                    title={`Quantidade: ${formatIntegerBR(row.quantidade)}`}
                                                />
                                                <div
                                                    className="w-3 rounded-t bg-amber-500"
                                                    style={{ height: `${valueHeight}px` }}
                                                    title={`Valor: ${formatCurrencyBR(row.valor_total)}`}
                                                />
                                            </div>
                                            <p className="w-full truncate text-center text-xs font-medium" title={row.label}>{row.label}</p>
                                            <p className="text-center text-[11px] text-muted-foreground">
                                                {formatIntegerBR(row.quantidade)} | {formatCurrencyBR(row.valor_total)}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="gap-1">
                                <span className="inline-block h-2 w-2 rounded-full bg-sky-600" />
                                Quantidade
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                                Valor
                            </Badge>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
});

const LazyChartSlot = memo(function LazyChartSlot({
    children,
    minHeight = 320,
}: {
    children: ReactNode;
    minHeight?: number;
}) {
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current || isVisible) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setIsVisible(true);
                    }
                });
            },
            {
                root: null,
                rootMargin: '180px 0px',
                threshold: 0.05,
            },
        );

        observer.observe(containerRef.current);

        return () => observer.disconnect();
    }, [isVisible]);

    return (
        <div ref={containerRef} style={{ minHeight }}>
            {isVisible ? (
                children
            ) : (
                <Card className="transport-insight-card h-full">
                    <CardContent className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                        Carregando gráfico...
                    </CardContent>
                </Card>
            )}
        </div>
    );
});

function statusLabel(value: string): string {
    const map: Record<string, string> = {
        aguardando_motorista: 'Aguardando Motorista',
        solicitado_boleto: 'Solicitado Boleto',
        boleto_ok: 'Boleto OK',
        pago: 'Pago',
    };

    return map[value] ?? value;
}

function culpaLabel(value: string): string {
    const map: Record<string, string> = {
        empresa: 'Empresa',
        motorista: 'Motorista',
    };

    return map[value] ?? value;
}

function tipoValorLabel(value: string): string {
    const map: Record<string, string> = {
        normal: 'Normal',
        '20_percent': '20%',
        '40_percent': '40%',
    };

    return map[value] ?? value;
}

export default function TransportFinesDashboardPage() {
    const [data, setData] = useState<DashboardResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const monthStart = useMemo(() => {
        const date = new Date();
        date.setDate(1);
        return date.toISOString().slice(0, 10);
    }, []);

    const [startDate, setStartDate] = useState(monthStart);
    const [endDate, setEndDate] = useState(today);
    const [unitId, setUnitId] = useState<string>('all');
    const requestSeqRef = useRef(0);

    const loadDashboard = useCallback(async (nextStart: string, nextEnd: string, nextUnit: string): Promise<void> => {
        const requestId = requestSeqRef.current + 1;
        requestSeqRef.current = requestId;

        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            params.set('data_inicio', nextStart);
            params.set('data_fim', nextEnd);

            if (nextUnit !== 'all') {
                params.set('unidade_id', nextUnit);
            }

            const response = await apiGet<DashboardResponse>(`/fines/dashboard?${params.toString()}`);

            if (requestId !== requestSeqRef.current) {
                return;
            }

            setData({
                ...response,
                charts: {
                    ...response.charts,
                    culpa: response.charts.culpa.map((row) => ({ ...row, label: culpaLabel(row.label) })),
                    tipo_valor: response.charts.tipo_valor.map((row) => ({ ...row, label: tipoValorLabel(row.label) })),
                    status: response.charts.status.map((row) => ({ ...row, label: statusLabel(row.label) })),
                },
            });

            setStartDate(response.filters.data_inicio);
            setEndDate(response.filters.data_fim);
            setUnitId(response.filters.unidade_id ? String(response.filters.unidade_id) : 'all');
        } catch {
            if (requestId !== requestSeqRef.current) {
                return;
            }

            setError('Não foi possível carregar o dashboard de multas.');
        } finally {
            if (requestId === requestSeqRef.current) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        void loadDashboard(monthStart, today, 'all');
    }, [loadDashboard, monthStart, today]);

    return (
        <AdminLayout title="Gestão de Multas - Dashboard" active="fines-dashboard" module="fines">
            <div className="transport-dashboard-page">
                <div className="transport-dashboard-header">
                    <p className="transport-dashboard-eyebrow">Gestão de multas</p>
                    <h2 className="transport-dashboard-title">Dashboard de Multas</h2>
                    <p className="transport-dashboard-subtitle">
                        Acompanhe quantidade e valor de multas por infração, culpa, status, placa e motorista.
                    </p>
                </div>

                {error ? <Notification message={error} variant="error" /> : null}

                <Card className="transport-insight-card">
                    <CardHeader className="pb-4">
                        <CardTitle className="transport-dashboard-section-title">Filtros</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Data início</label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(event) => setStartDate(event.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Data fim</label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(event) => setEndDate(event.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Unidade</label>
                                <Select value={unitId} onValueChange={setUnitId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        {(data?.unidades ?? []).map((unit) => (
                                            <SelectItem key={unit.id} value={String(unit.id)}>
                                                {unit.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end">
                                <Button
                                    type="button"
                                    className="w-full"
                                    onClick={() => void loadDashboard(startDate, endDate, unitId)}
                                    disabled={loading || !startDate || !endDate}
                                >
                                    {loading ? (
                                        <>
                                            <LoaderCircle className="size-4 animate-spin" />
                                            Carregando...
                                        </>
                                    ) : (
                                        <>
                                            <Filter className="size-4" />
                                            Aplicar filtros
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card className="transport-metric-card transport-tone-info">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="transport-metric-label">Multas (quantidade)</CardTitle>
                            <PieChart className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <p className="transport-metric-value">
                                {formatIntegerBR(data?.totals.quantidade ?? 0)}
                            </p>
                            <p className="transport-metric-context">Total de registros no período.</p>
                        </CardContent>
                    </Card>
                    <Card className="transport-metric-card transport-tone-info">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="transport-metric-label">Multas (valor)</CardTitle>
                            <TrendingUp className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <p className="transport-metric-value">
                                {formatCurrencyBR(data?.totals.valor ?? 0)}
                            </p>
                            <p className="transport-metric-context">Impacto financeiro consolidado.</p>
                        </CardContent>
                    </Card>
                    <Card className="transport-metric-card">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="transport-metric-label">Ticket médio</CardTitle>
                            <PieChart className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <p className="transport-metric-value">
                                {formatCurrencyBR(data?.totals.valor_medio ?? 0)}
                            </p>
                            <p className="transport-metric-context">Valor médio por multa.</p>
                        </CardContent>
                    </Card>
                    <Card className="transport-metric-card transport-tone-warning">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="transport-metric-label">Vencidas em aberto</CardTitle>
                            <AlertTriangle className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <p className="transport-metric-value">
                                {formatIntegerBR(data?.totals.vencidas_em_aberto.quantidade ?? 0)}
                            </p>
                            <p className="transport-metric-context">
                                {formatCurrencyBR(data?.totals.vencidas_em_aberto.valor ?? 0)} em risco.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {loading && !data ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando dashboard de multas...
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Leituras rápidas</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {data?.alerts.length ? (
                                        data.alerts.map((alert, index) => (
                                            <div key={`${alert.title}-${index}`} className="transport-list-panel">
                                                <p className="font-medium">{alert.title}</p>
                                                <p className="text-xs text-muted-foreground">{alert.detail}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Sem alertas críticos no período.</p>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Status financeiro</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    {Object.entries(data?.totals.status_summary ?? {}).map(([key, value]) => (
                                        <div key={key} className="transport-compare-row">
                                            <div>
                                                <p className="font-medium">{statusLabel(key)}</p>
                                                <p className="text-xs text-muted-foreground">{formatIntegerBR(value.quantidade)} registros</p>
                                            </div>
                                            <p className="font-semibold">{formatCurrencyBR(value.valor)}</p>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Maior exposição</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="transport-list-panel">
                                        <p className="text-xs text-muted-foreground">Placa</p>
                                        <p className="mt-1 font-semibold">{data?.totals.top_placa?.label ?? '-'}</p>
                                        <p className="text-xs text-muted-foreground">{formatCurrencyBR(data?.totals.top_placa?.valor_total ?? 0)}</p>
                                    </div>
                                    <div className="transport-list-panel">
                                        <p className="text-xs text-muted-foreground">Motorista</p>
                                        <p className="mt-1 font-semibold">{data?.totals.top_motorista?.label ?? '-'}</p>
                                        <p className="text-xs text-muted-foreground">{formatCurrencyBR(data?.totals.top_motorista?.valor_total ?? 0)}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                            <LazyChartSlot>
                                <PieSummaryCard title="Gráfico por Infração (Quantidade)" rows={data?.charts.infracao ?? []} mode="quantidade" colorSeed={0} />
                            </LazyChartSlot>
                            <LazyChartSlot>
                                <PieSummaryCard title="Gráfico por Infração (Valor)" rows={data?.charts.infracao ?? []} mode="valor_total" colorSeed={1} />
                            </LazyChartSlot>
                            <LazyChartSlot>
                                <PieSummaryCard title="Gráfico por Culpa (Quantidade)" rows={data?.charts.culpa ?? []} mode="quantidade" colorSeed={2} />
                            </LazyChartSlot>
                            <LazyChartSlot>
                                <PieSummaryCard title="Gráfico por Culpa (Valor)" rows={data?.charts.culpa ?? []} mode="valor_total" colorSeed={3} />
                            </LazyChartSlot>
                            <LazyChartSlot>
                                <PieSummaryCard title="Gráfico por Tipo Valor" rows={data?.charts.tipo_valor ?? []} mode="quantidade" colorSeed={4} />
                            </LazyChartSlot>
                            <LazyChartSlot>
                                <PieSummaryCard title="Gráfico por Status" rows={data?.charts.status ?? []} mode="quantidade" colorSeed={5} />
                            </LazyChartSlot>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                            <LazyChartSlot minHeight={360}>
                                <ColumnComparisonCard title="Gráfico de Colunas por Placa (qtde e valor)" rows={data?.charts.placa ?? []} />
                            </LazyChartSlot>
                            <LazyChartSlot minHeight={360}>
                                <ColumnComparisonCard title="Gráfico de Colunas por Motorista (qtde e valor)" rows={data?.charts.motorista ?? []} />
                            </LazyChartSlot>
                        </div>

                        <Card className="transport-insight-card">
                            <CardHeader>
                                <CardTitle className="transport-dashboard-section-title">Top unidades por valor</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                {(data?.totals.top_unidades ?? []).map((item, index) => (
                                    <div key={`${item.label}-${index}`} className="transport-list-panel">
                                        <p className="font-medium">{item.label}</p>
                                        <p className="text-xs text-muted-foreground">{formatIntegerBR(item.quantidade)} registro(s)</p>
                                        <p className="mt-1 font-semibold">{formatCurrencyBR(item.valor_total)}</p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </AdminLayout>
    );
}
