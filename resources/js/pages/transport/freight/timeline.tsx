import { LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
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
import { formatCurrencyBR, formatDateBR, formatIntegerBR } from '@/lib/transport-format';
import type {
    FreightMonthlyResponse,
    FreightOperationalReportResponse,
    FreightTimelineResponse,
    FreightUnit,
} from '@/types/freight';

interface WrappedResponse<T> {
    data: T;
}

type FreightAnalyticsView = 'timeline' | 'operational' | 'monthly';

type TrendMode = 'daily' | 'monthly';

type RangePresetKey = '1w' | '1m' | '1a' | '3a' | '5a';

const palette = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#dc2626'];

const monthOptions = [
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
];

function toIsoDate(value: Date): string {
    return value.toISOString().slice(0, 10);
}

function buildDateAxis(start: string, end: string): string[] {
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
        return [];
    }

    const result: string[] = [];
    const cursor = new Date(startDate);

    while (cursor <= endDate) {
        result.push(toIsoDate(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }

    return result;
}

function buildMonthAxis(start: string, end: string): string[] {
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
        return [];
    }

    const result: string[] = [];
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const lastMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (cursor <= lastMonth) {
        const year = cursor.getFullYear();
        const month = String(cursor.getMonth() + 1).padStart(2, '0');
        result.push(`${year}-${month}`);
        cursor.setMonth(cursor.getMonth() + 1);
    }

    return result;
}

function rangeFromPreset(preset: RangePresetKey, mode: TrendMode): { start: string; end: string } {
    const end = new Date();
    const start = new Date(end);

    if (mode === 'daily') {
        if (preset === '1w') {
            start.setDate(end.getDate() - 6);
        } else if (preset === '1m') {
            start.setMonth(end.getMonth() - 1);
        } else {
            start.setFullYear(end.getFullYear() - 1);
        }
    } else {
        if (preset === '3a') {
            start.setFullYear(end.getFullYear() - 3);
        } else if (preset === '5a') {
            start.setFullYear(end.getFullYear() - 5);
        } else {
            start.setFullYear(end.getFullYear() - 1);
        }
    }

    return {
        start: toIsoDate(start),
        end: toIsoDate(end),
    };
}

export default function TransportFreightTimelinePage() {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const defaultMonthStart = toIsoDate(new Date(currentYear, currentMonth, 1));
    const defaultMonthEnd = toIsoDate(new Date(currentYear, currentMonth + 1, 0));

    const [activeView, setActiveView] = useState<FreightAnalyticsView>('timeline');
    const [trendMode, setTrendMode] = useState<TrendMode>('daily');

    const [startDate, setStartDate] = useState(defaultMonthStart);
    const [endDate, setEndDate] = useState(defaultMonthEnd);
    const [activePreset, setActivePreset] = useState<RangePresetKey | null>('1m');

    const [unidades, setUnidades] = useState<FreightUnit[]>([]);
    const [selectedUnidades, setSelectedUnidades] = useState<number[]>([]);

    const [timeline, setTimeline] = useState<FreightTimelineResponse | null>(null);

    const [opMonth, setOpMonth] = useState(String(currentMonth + 1));
    const [opYear, setOpYear] = useState(String(currentYear));
    const [operationalReport, setOperationalReport] = useState<FreightOperationalReportResponse | null>(null);

    const [monthlyMonth, setMonthlyMonth] = useState(String(currentMonth + 1));
    const [monthlyYear, setMonthlyYear] = useState(String(currentYear));
    const [monthlyUnidadeId, setMonthlyUnidadeId] = useState('all');
    const [monthlyReport, setMonthlyReport] = useState<FreightMonthlyResponse | null>(null);

    const [loadingTimeline, setLoadingTimeline] = useState(true);
    const [loadingOperational, setLoadingOperational] = useState(false);
    const [loadingMonthly, setLoadingMonthly] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const [hoveredPoint, setHoveredPoint] = useState<{
        xPercent: number;
        yPercent: number;
        label: string;
    } | null>(null);

    const monthLabelMap = useMemo(
        () => ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
        [],
    );

    function formatMonthKeyLabel(value: string): string {
        const [year, month] = value.split('-');
        const monthIndex = Number(month) - 1;
        const monthLabel = monthLabelMap[monthIndex] ?? month;
        return `${monthLabel}/${year}`;
    }

    const yearOptions = useMemo(() => {
        const current = currentYear;
        return [String(current - 2), String(current - 1), String(current), String(current + 1)];
    }, [currentYear]);

    useEffect(() => {
        apiGet<WrappedResponse<FreightUnit[]>>('/registry/unidades')
            .then((response) => {
                setUnidades(response.data);
                setSelectedUnidades(response.data.map((item) => item.id));
            })
            .catch(() => setError('Não foi possível carregar as unidades.'));
    }, []);

    async function loadTimeline(): Promise<void> {
        setLoadingTimeline(true);
        setError(null);

        const params = new URLSearchParams({
            start_date: startDate,
            end_date: endDate,
        });

        selectedUnidades.forEach((id) => params.append('unidade_ids[]', String(id)));

        try {
            const timelineResponse = await apiGet<FreightTimelineResponse>(
                `/freight/timeline?${params.toString()}`,
            );

            setTimeline(timelineResponse);
        } catch {
            setError('Não foi possível carregar a análise diária de fretes.');
        } finally {
            setLoadingTimeline(false);
        }
    }

    async function loadOperationalReport(): Promise<void> {
        setLoadingOperational(true);

        try {
            const response = await apiGet<FreightOperationalReportResponse>(
                `/freight/operational-report?competencia_mes=${opMonth}&competencia_ano=${opYear}`,
            );
            setOperationalReport(response);
        } catch {
            setError('Não foi possível carregar o relatório operacional.');
        } finally {
            setLoadingOperational(false);
        }
    }

    async function loadMonthlyReport(): Promise<void> {
        setLoadingMonthly(true);

        const params = new URLSearchParams({
            competencia_mes: monthlyMonth,
            competencia_ano: monthlyYear,
        });

        if (monthlyUnidadeId !== 'all') {
            params.set('unidade_id', monthlyUnidadeId);
        }

        try {
            const response = await apiGet<FreightMonthlyResponse>(
                `/freight/monthly-unit-report?${params.toString()}`,
            );
            setMonthlyReport(response);
        } catch {
            setError('Não foi possível carregar a análise mensal por unidade.');
        } finally {
            setLoadingMonthly(false);
        }
    }

    useEffect(() => {
        if (selectedUnidades.length > 0) {
            void loadTimeline();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate, selectedUnidades.join(',')]);

    useEffect(() => {
        if (activeView === 'operational') {
            void loadOperationalReport();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeView, opMonth, opYear]);

    useEffect(() => {
        if (activeView === 'monthly') {
            void loadMonthlyReport();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeView, monthlyMonth, monthlyYear, monthlyUnidadeId]);

    const dateAxis = useMemo(() => buildDateAxis(startDate, endDate), [startDate, endDate]);
    const monthAxis = useMemo(() => buildMonthAxis(startDate, endDate), [startDate, endDate]);

    const trendAxis = trendMode === 'daily' ? dateAxis : monthAxis;

    const seriesBucketValues = useMemo(() => {
        const valuesByUnit = new Map<number, Map<string, number>>();

        if (!timeline) {
            return valuesByUnit;
        }

        timeline.series.forEach((series) => {
            const unitMap = new Map<string, number>();

            series.points.forEach((point) => {
                const bucketKey = trendMode === 'daily' ? point.data : point.data.slice(0, 7);
                unitMap.set(bucketKey, (unitMap.get(bucketKey) ?? 0) + point.frete_total);
            });

            valuesByUnit.set(series.unidade_id, unitMap);
        });

        return valuesByUnit;
    }, [timeline, trendMode]);

    const valueForBucket = useCallback(
        (unidadeId: number, bucketKey: string): number => {
            return seriesBucketValues.get(unidadeId)?.get(bucketKey) ?? 0;
        },
        [seriesBucketValues],
    );

    function bucketLabel(value: string): string {
        return trendMode === 'daily' ? formatDateBR(value) : formatMonthKeyLabel(value);
    }

    const allValues = useMemo(() => {
        if (!timeline) return [] as number[];

        return timeline.series.flatMap((series) =>
            trendAxis.map((bucket) => valueForBucket(series.unidade_id, bucket)),
        );
    }, [timeline, trendAxis, valueForBucket]);

    const maxValue = useMemo(() => Math.max(1, ...allValues), [allValues]);

    const totalValue = useMemo(() => allValues.reduce((sum, value) => sum + value, 0), [allValues]);

    const valuesPerBucket = useMemo(() => {
        if (!timeline || trendAxis.length === 0) return [] as number[];

        return trendAxis.map((bucket) =>
            timeline.series.reduce((sum, series) => {
                return sum + valueForBucket(series.unidade_id, bucket);
            }, 0),
        );
    }, [timeline, trendAxis, valueForBucket]);

    const maxTrendValue = useMemo(() => Math.max(0, ...valuesPerBucket), [valuesPerBucket]);

    const yAxisTicks = useMemo(() => [1, 0.75, 0.5, 0.25, 0], []);

    const xAxisLabelIndexes = useMemo(() => {
        if (trendAxis.length === 0) return [] as number[];
        if (trendAxis.length <= 12) {
            return trendAxis.map((_, index) => index);
        }

        const targetLabels = 10;
        const step = Math.max(1, Math.ceil(trendAxis.length / targetLabels));
        const indexes: number[] = [];

        for (let index = 0; index < trendAxis.length; index += step) {
            indexes.push(index);
        }

        if (!indexes.includes(trendAxis.length - 1)) {
            indexes.push(trendAxis.length - 1);
        }

        return indexes;
    }, [trendAxis]);

    const chartWidth = 1240;
    const chartHeight = 360;
    const paddingX = 110;
    const paddingY = 24;
    const innerWidth = chartWidth - paddingX * 2;
    const innerHeight = chartHeight - paddingY * 2;

    function xForIndex(index: number): number {
        if (trendAxis.length <= 1) return paddingX;
        return paddingX + (index / (trendAxis.length - 1)) * innerWidth;
    }

    function yForValue(value: number): number {
        return paddingY + ((maxValue - value) / maxValue) * innerHeight;
    }

    function toggleUnidade(id: number): void {
        setSelectedUnidades((previous) => {
            if (previous.includes(id)) return previous.filter((item) => item !== id);
            return [...previous, id];
        });
    }

    function applyPreset(preset: RangePresetKey, mode: TrendMode = trendMode): void {
        const range = rangeFromPreset(preset, mode);
        setActivePreset(preset);
        setStartDate(range.start);
        setEndDate(range.end);
    }

    function handleTrendModeChange(mode: TrendMode): void {
        setTrendMode(mode);
        const defaultPreset: RangePresetKey = mode === 'daily' ? '1m' : '1a';
        applyPreset(defaultPreset, mode);
    }

    function handleManualDateChange(type: 'start' | 'end', value: string): void {
        setActivePreset(null);
        if (type === 'start') {
            setStartDate(value);
        } else {
            setEndDate(value);
        }
    }

    return (
        <AdminLayout
            title="Central de Fretes"
            active="freight-timeline"
            module="freight"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Central Analítica de Fretes</h2>
                    <p className="text-sm text-muted-foreground">
                        Visão unificada de tendência, operação e análise mensal na mesma tela.
                    </p>
                </div>

                {error ? <Notification message={error} variant="error" /> : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Visão</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant={activeView === 'timeline' ? 'default' : 'outline'}
                                onClick={() => setActiveView('timeline')}
                            >
                                Tendência
                            </Button>
                            <Button
                                type="button"
                                variant={activeView === 'operational' ? 'default' : 'outline'}
                                onClick={() => setActiveView('operational')}
                            >
                                Operacional
                            </Button>
                            <Button
                                type="button"
                                variant={activeView === 'monthly' ? 'default' : 'outline'}
                                onClick={() => setActiveView('monthly')}
                            >
                                Análise mensal
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {activeView === 'timeline' ? (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle>Período e unidades</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant={trendMode === 'daily' ? 'default' : 'outline'}
                                        onClick={() => handleTrendModeChange('daily')}
                                    >
                                        Diário
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={trendMode === 'monthly' ? 'default' : 'outline'}
                                        onClick={() => handleTrendModeChange('monthly')}
                                    >
                                        Mês
                                    </Button>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {trendMode === 'daily' ? (
                                        <>
                                            <Button
                                                type="button"
                                                variant={activePreset === '1w' ? 'default' : 'outline'}
                                                onClick={() => applyPreset('1w')}
                                            >
                                                1S
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={activePreset === '1m' ? 'default' : 'outline'}
                                                onClick={() => applyPreset('1m')}
                                            >
                                                1M
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={activePreset === '1a' ? 'default' : 'outline'}
                                                onClick={() => applyPreset('1a')}
                                            >
                                                1A
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button
                                                type="button"
                                                variant={activePreset === '1a' ? 'default' : 'outline'}
                                                onClick={() => applyPreset('1a')}
                                            >
                                                1A
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={activePreset === '3a' ? 'default' : 'outline'}
                                                onClick={() => applyPreset('3a')}
                                            >
                                                3A
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={activePreset === '5a' ? 'default' : 'outline'}
                                                onClick={() => applyPreset('5a')}
                                            >
                                                5A
                                            </Button>
                                        </>
                                    )}
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div>
                                        <p className="mb-2 text-sm text-muted-foreground">Data inicial</p>
                                        <Input
                                            type="date"
                                            value={startDate}
                                            onChange={(event) => handleManualDateChange('start', event.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <p className="mb-2 text-sm text-muted-foreground">Data final</p>
                                        <Input
                                            type="date"
                                            value={endDate}
                                            onChange={(event) => handleManualDateChange('end', event.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {unidades.map((unidade, index) => {
                                        const isSelected = selectedUnidades.includes(unidade.id);

                                        return (
                                            <Button
                                                key={unidade.id}
                                                type="button"
                                                variant={isSelected ? 'default' : 'outline'}
                                                onClick={() => toggleUnidade(unidade.id)}
                                                className="gap-2"
                                            >
                                                <span
                                                    className="inline-block size-2 rounded-full"
                                                    style={{ backgroundColor: palette[index % palette.length] }}
                                                />
                                                {unidade.nome}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Tendência de frete</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loadingTimeline ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <LoaderCircle className="size-4 animate-spin" />
                                        Carregando gráfico...
                                    </div>
                                ) : !timeline || timeline.series.length === 0 || trendAxis.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        Sem dados para o período selecionado.
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="grid gap-3 md:grid-cols-4">
                                            <div className="rounded-md border p-3">
                                                <p className="text-xs text-muted-foreground">Total frete no período</p>
                                                <p className="mt-1 text-base font-semibold">{formatCurrencyBR(totalValue)}</p>
                                            </div>
                                            <div className="rounded-md border p-3">
                                                <p className="text-xs text-muted-foreground">Períodos no recorte</p>
                                                <p className="mt-1 text-base font-semibold">{formatIntegerBR(trendAxis.length)}</p>
                                            </div>
                                            <div className="rounded-md border p-3">
                                                <p className="text-xs text-muted-foreground">
                                                    {trendMode === 'daily' ? 'Maior valor diário' : 'Maior valor mensal'}
                                                </p>
                                                <p className="mt-1 text-base font-semibold">{formatCurrencyBR(maxTrendValue)}</p>
                                            </div>
                                            <div className="rounded-md border p-3">
                                                <p className="text-xs text-muted-foreground">
                                                    {trendMode === 'daily' ? 'Média diária geral' : 'Média mensal geral'}
                                                </p>
                                                <p className="mt-1 text-base font-semibold">
                                                    {formatCurrencyBR(trendAxis.length > 0 ? totalValue / trendAxis.length : 0)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="relative h-[420px] w-full overflow-x-auto rounded-md border bg-muted/10 p-3">
                                            <div className="relative h-full min-w-[980px]">
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

                                                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-full w-full">
                                                    {yAxisTicks.map((step) => {
                                                        const y = paddingY + innerHeight * step;
                                                        const tickValue = maxValue * (1 - step);
                                                        return (
                                                            <g key={step}>
                                                                <line
                                                                    x1={paddingX}
                                                                    y1={y}
                                                                    x2={chartWidth - paddingX}
                                                                    y2={y}
                                                                    stroke="hsl(var(--border))"
                                                                    strokeWidth="1"
                                                                />
                                                                <text
                                                                    x={paddingX - 14}
                                                                    y={y + 4}
                                                                    textAnchor="end"
                                                                    fontSize="11"
                                                                    fill="hsl(var(--muted-foreground))"
                                                                >
                                                                    {formatCurrencyBR(tickValue)}
                                                                </text>
                                                            </g>
                                                        );
                                                    })}

                                                    {xAxisLabelIndexes.map((index) => {
                                                        const bucket = trendAxis[index];
                                                        const x = xForIndex(index);

                                                        if (!bucket) return null;

                                                        return (
                                                            <text
                                                                key={`x-label-${bucket}-${index}`}
                                                                x={x}
                                                                y={chartHeight - 6}
                                                                textAnchor="middle"
                                                                fontSize="11"
                                                                fill="hsl(var(--muted-foreground))"
                                                            >
                                                                {trendMode === 'daily'
                                                                    ? bucket.slice(5).replace('-', '/')
                                                                    : formatMonthKeyLabel(bucket)}
                                                            </text>
                                                        );
                                                    })}

                                                    {timeline.series.map((series, seriesIndex) => {
                                                        const color = palette[seriesIndex % palette.length];
                                                        const points = trendAxis
                                                            .map((bucket, index) => {
                                                                const value = valueForBucket(series.unidade_id, bucket);
                                                                return `${xForIndex(index)},${yForValue(value)}`;
                                                            })
                                                            .join(' ');

                                                        return (
                                                            <g key={series.unidade_id}>
                                                                <polyline
                                                                    fill="none"
                                                                    stroke={color}
                                                                    strokeWidth="2"
                                                                    points={points}
                                                                    vectorEffect="non-scaling-stroke"
                                                                />

                                                                {trendAxis.map((bucket, index) => {
                                                                    const value = valueForBucket(series.unidade_id, bucket);
                                                                    const x = xForIndex(index);
                                                                    const y = yForValue(value);

                                                                    return (
                                                                        <circle
                                                                            key={`${series.unidade_id}-${bucket}`}
                                                                            cx={x}
                                                                            cy={y}
                                                                            r="4"
                                                                            fill={color}
                                                                            onMouseEnter={() =>
                                                                                setHoveredPoint({
                                                                                    xPercent: (x / chartWidth) * 100,
                                                                                    yPercent: (y / chartHeight) * 100,
                                                                                    label: `${series.unidade_nome ?? 'Sem unidade'} • ${bucketLabel(bucket)} • ${formatCurrencyBR(value)}`,
                                                                                })
                                                                            }
                                                                            onMouseLeave={() => setHoveredPoint(null)}
                                                                        />
                                                                    );
                                                                })}
                                                            </g>
                                                        );
                                                    })}
                                                </svg>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-3">
                                            {timeline.series.map((series, index) => {
                                                const total = trendAxis.reduce((sum, bucket) => {
                                                    return sum + valueForBucket(series.unidade_id, bucket);
                                                }, 0);

                                                return (
                                                    <div key={series.unidade_id} className="flex items-center gap-2 text-sm">
                                                        <span
                                                            className="inline-block size-2.5 rounded-full"
                                                            style={{ backgroundColor: palette[index % palette.length] }}
                                                        />
                                                        <span className="font-medium">{series.unidade_nome ?? 'Sem unidade'}</span>
                                                        <span className="text-muted-foreground">— {formatCurrencyBR(total)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </>
                ) : null}

                {activeView === 'operational' ? (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle>Competência</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-3 md:grid-cols-2">
                                <Select value={opMonth} onValueChange={setOpMonth}>
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
                                <Select value={opYear} onValueChange={setOpYear}>
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
                            </CardContent>
                        </Card>

                        {loadingOperational ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando relatório operacional...
                            </div>
                        ) : operationalReport ? (
                            <>
                                <div className="grid gap-3 md:grid-cols-4">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-muted-foreground">Total Abatedouro</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-lg font-semibold">{formatCurrencyBR(operationalReport.geral_kaique.total_abatedouro)}</p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-muted-foreground">Frota Dentro</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-lg font-semibold">{formatCurrencyBR(operationalReport.geral_kaique.frota_dentro)}</p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-muted-foreground">Frota Fora</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-lg font-semibold">{formatCurrencyBR(operationalReport.geral_kaique.frota_fora)}</p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-muted-foreground">Total Frota</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-lg font-semibold">{formatCurrencyBR(operationalReport.geral_kaique.total_frota)}</p>
                                        </CardContent>
                                    </Card>
                                </div>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Visão por Abatedouro</CardTitle>
                                    </CardHeader>
                                    <CardContent className="overflow-x-auto">
                                        <table className="w-full min-w-[760px] text-sm">
                                            <thead>
                                                <tr className="border-b text-left text-muted-foreground">
                                                    <th className="py-2 pr-3 font-medium">Unidade</th>
                                                    <th className="py-2 pr-3 font-medium">Frota no abatedouro</th>
                                                    <th className="py-2 pr-3 font-medium">Terceiros no abatedouro</th>
                                                    <th className="py-2 pr-3 font-medium">Total abatedouro</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {operationalReport.abatedouro.map((item) => (
                                                    <tr key={item.unidade_id} className="border-b last:border-b-0">
                                                        <td className="py-2 pr-3">{item.unidade_nome ?? '-'}</td>
                                                        <td className="py-2 pr-3">{formatCurrencyBR(item.frota_no_abatedouro)}</td>
                                                        <td className="py-2 pr-3">{formatCurrencyBR(item.terceiros_no_abatedouro)}</td>
                                                        <td className="py-2 pr-3 font-semibold">{formatCurrencyBR(item.total_abatedouro)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Visão Frota (Dentro/Fora)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="overflow-x-auto">
                                        <table className="w-full min-w-[760px] text-sm">
                                            <thead>
                                                <tr className="border-b text-left text-muted-foreground">
                                                    <th className="py-2 pr-3 font-medium">Frota</th>
                                                    <th className="py-2 pr-3 font-medium">Dentro</th>
                                                    <th className="py-2 pr-3 font-medium">Fora (Spot)</th>
                                                    <th className="py-2 pr-3 font-medium">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {operationalReport.frota.map((item) => (
                                                    <tr key={item.unidade_id} className="border-b last:border-b-0">
                                                        <td className="py-2 pr-3">{item.unidade_nome ?? '-'}</td>
                                                        <td className="py-2 pr-3">{formatCurrencyBR(item.dentro)}</td>
                                                        <td className="py-2 pr-3">{formatCurrencyBR(item.fora)}</td>
                                                        <td className="py-2 pr-3 font-semibold">{formatCurrencyBR(item.total_frota)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </CardContent>
                                </Card>
                            </>
                        ) : null}
                    </>
                ) : null}

                {activeView === 'monthly' ? (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle>Filtros mensais</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-3 md:grid-cols-3">
                                <Select value={monthlyMonth} onValueChange={setMonthlyMonth}>
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
                                <Select value={monthlyYear} onValueChange={setMonthlyYear}>
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
                                <Select value={monthlyUnidadeId} onValueChange={setMonthlyUnidadeId}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        {unidades.map((unidade) => (
                                            <SelectItem key={unidade.id} value={String(unidade.id)}>
                                                {unidade.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Análise mensal por unidade</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loadingMonthly ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <LoaderCircle className="size-4 animate-spin" />
                                        Carregando análise mensal...
                                    </div>
                                ) : !monthlyReport || monthlyReport.data.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sem dados para os filtros selecionados.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {monthlyReport.data.map((item) => (
                                            <div key={item.unidade_id} className="rounded-lg border p-4">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-xl font-semibold">{item.unidade_nome ?? 'Sem unidade'}</p>
                                                    <p className="text-sm text-muted-foreground">{formatIntegerBR(item.dias_trabalhados)} dia(s)</p>
                                                </div>
                                                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                                    <div className="rounded-md border bg-muted/20 p-3">
                                                        <p className="text-xs text-muted-foreground">Frete total</p>
                                                        <p className="text-xl font-semibold">{formatCurrencyBR(item.total_frete)}</p>
                                                    </div>
                                                    <div className="rounded-md border bg-muted/20 p-3">
                                                        <p className="text-xs text-muted-foreground">Frete líquido</p>
                                                        <p className="text-xl font-semibold">{formatCurrencyBR(item.total_frete_liquido)}</p>
                                                    </div>
                                                    <div className="rounded-md border bg-muted/20 p-3">
                                                        <p className="text-xs text-muted-foreground">Total KM</p>
                                                        <p className="text-xl font-semibold">{formatIntegerBR(item.total_km_rodado)}</p>
                                                    </div>
                                                    <div className="rounded-md border bg-muted/20 p-3">
                                                        <p className="text-xs text-muted-foreground">Aves transportadas</p>
                                                        <p className="text-xl font-semibold">{formatIntegerBR(item.total_aves_transportadas)}</p>
                                                    </div>
                                                    <div className="rounded-md border bg-muted/20 p-3">
                                                        <p className="text-xs text-muted-foreground">Frete por caminhão</p>
                                                        <p className="text-xl font-semibold">{formatCurrencyBR(item.frete_por_caminhao)}</p>
                                                    </div>
                                                    <div className="rounded-md border bg-muted/20 p-3">
                                                        <p className="text-xs text-muted-foreground">Frete por dia trabalhado</p>
                                                        <p className="text-xl font-semibold">{formatCurrencyBR(item.frete_por_dia_trabalhado)}</p>
                                                    </div>
                                                    <div className="rounded-md border bg-muted/20 p-3">
                                                        <p className="text-xs text-muted-foreground">Média R$/KM</p>
                                                        <p className="text-xl font-semibold">{formatCurrencyBR(item.media_reais_por_km)}</p>
                                                    </div>
                                                    <div className="rounded-md border bg-muted/20 p-3">
                                                        <p className="text-xs text-muted-foreground">Média frete/KM</p>
                                                        <p className="text-xl font-semibold">{formatCurrencyBR(item.media_frete_por_km)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </>
                ) : null}
            </div>
        </AdminLayout>
    );
}
