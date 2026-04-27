import { AlertTriangle, CalendarDays, LoaderCircle, Table2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import {
    formatCurrencyBR,
    formatDateBR,
    formatDecimalBR,
    formatIntegerBR,
    formatPercentBR,
} from '@/lib/transport-format';
import type { FreightDashboardResponse, FreightEntry, FreightUnit } from '@/types/freight';

interface FreightEntryPaginatedResponse {
    data: FreightEntry[];
    current_page: number;
    last_page: number;
    total: number;
}

interface FreightDashboardPageResponse {
    units: FreightUnit[];
    dashboard: FreightDashboardResponse;
    entries: FreightEntryPaginatedResponse;
}

type UnitMetricRow = FreightDashboardResponse['por_unidade'][number];

interface UnitMetricDefinition {
    key: string;
    title: string;
    value: (row: UnitMetricRow) => number;
    format: (value: number) => string;
}

interface UnitMetricChartCardProps {
    title: string;
    rows: Array<{ label: string; value: number }>;
    formatValue: (value: number) => string;
}

const unitChartToneClasses = [
    'bg-slate-900/85',
    'bg-slate-700/85',
    'bg-slate-500/85',
    'bg-slate-400/85',
    'bg-slate-300/95',
];

function UnitMetricChartCard({
    title,
    rows,
    formatValue,
}: UnitMetricChartCardProps) {
    const maxValue = useMemo(
        () => Math.max(0, ...rows.map((item) => item.value)),
        [rows],
    );
    const hasPositiveValues = useMemo(
        () => rows.some((item) => item.value > 0),
        [rows],
    );

    return (
        <Card className="h-full border-border/80">
            <CardHeader className="px-3 pt-2.5 pb-1">
                <CardTitle className="text-sm leading-tight">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-3">
                {rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem dados.</p>
                ) : (
                    <>
                        <div className="h-40 rounded-lg border border-border/70 bg-gradient-to-b from-muted/30 to-muted/10 p-2">
                            {hasPositiveValues ? (
                                <div
                                    className="h-full rounded-sm"
                                    style={{
                                        backgroundImage:
                                            'linear-gradient(to top, rgba(100,116,139,0.2) 1px, transparent 1px)',
                                        backgroundSize: '100% 25%',
                                    }}
                                >
                                    <div className="flex h-full items-end gap-2">
                                        {rows.map((item, index) => {
                                            const rawHeight =
                                                maxValue > 0
                                                    ? (item.value / maxValue) * 100
                                                    : 0;
                                            const height =
                                                item.value <= 0
                                                    ? 5
                                                    : Math.min(100, Math.max(14, rawHeight));
                                            const toneClass =
                                                unitChartToneClasses[index % unitChartToneClasses.length];

                                            return (
                                                <div
                                                    key={`${title}-${item.label}`}
                                                    className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
                                                >
                                                    <div className="flex flex-1 items-end">
                                                        <div
                                                            className={`w-full rounded-t-md ${toneClass} transition-[height] duration-300`}
                                                            style={{ height: `${height}%` }}
                                                        />
                                                    </div>
                                                    <p
                                                        className="w-full truncate text-center text-[10px] font-medium text-muted-foreground"
                                                        title={item.label}
                                                    >
                                                        {item.label}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                                    Sem volume no período.
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            {rows.map((item, index) => (
                                <div
                                    key={`${title}-${item.label}-legend`}
                                    className="flex items-center justify-between gap-2 text-[11px]"
                                >
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span
                                            className={`size-2 rounded-full ${unitChartToneClasses[index % unitChartToneClasses.length]}`}
                                        />
                                        <span className="truncate text-muted-foreground">
                                            {item.label}
                                        </span>
                                    </div>
                                    <span className="font-semibold text-foreground">
                                        {formatValue(item.value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

const unitMetricDefinitions: UnitMetricDefinition[] = [
    {
        key: 'frete-kaique',
        title: 'Frete Kaique',
        value: (row) => Number(row.total_frete_liquido ?? 0),
        format: (value) => formatCurrencyBR(value),
    },
    {
        key: 'viagens-kaique',
        title: 'Viagens Kaique',
        value: (row) => Number(row.total_viagens_kaique ?? 0),
        format: (value) => formatIntegerBR(value),
    },
    {
        key: 'km-kaique',
        title: 'Km Kaique',
        value: (row) => Number(row.total_km ?? 0),
        format: (value) => formatIntegerBR(value),
    },
    {
        key: 'aves-transportadas',
        title: 'Aves Transportadas',
        value: (row) => Number(row.total_aves ?? 0),
        format: (value) => formatIntegerBR(value),
    },
    {
        key: 'frete-kaique-por-km',
        title: 'Frete Kaique / Km Rodado',
        value: (row) => Number(row.frete_kaique_por_km ?? 0),
        format: (value) => formatCurrencyBR(value),
    },
    {
        key: 'frete-kaique-por-caminhao',
        title: 'Frete Kaique / Caminhão',
        value: (row) => Number(row.frete_kaique_por_caminhao ?? 0),
        format: (value) => formatCurrencyBR(value),
    },
    {
        key: 'frete-kaique-por-dia',
        title: 'Frete Kaique por Dia',
        value: (row) => Number(row.frete_kaique_por_dia ?? 0),
        format: (value) => formatCurrencyBR(value),
    },
    {
        key: 'percentual-terceiros-programado',
        title: '% Frete Terceiros / Frete Programado',
        value: (row) => Number(row.percentual_frete_terceiros_sobre_programado ?? 0),
        format: (value) => formatPercentBR(value),
    },
    {
        key: 'aves-por-carga',
        title: 'Aves por Carga',
        value: (row) => Number(row.aves_por_carga ?? 0),
        format: (value) => formatDecimalBR(value, 2),
    },
    {
        key: 'frete-kaique-por-carga',
        title: 'Frete Kaique / Carga',
        value: (row) => Number(row.frete_kaique_por_carga ?? 0),
        format: (value) => formatCurrencyBR(value),
    },
    {
        key: 'dias-trabalhados',
        title: 'Dias Trabalhados',
        value: (row) => Number(row.dias_trabalhados ?? 0),
        format: (value) => formatIntegerBR(value),
    },
    {
        key: 'aves-media-caixa',
        title: 'Aves Média por Caixa',
        value: (row) => Number(row.aves_media_por_caixa ?? 0),
        format: (value) => formatDecimalBR(value, 3),
    },
];

export default function TransportFreightDashboardPage() {
    const currentYear = new Date().getFullYear();
    const [month, setMonth] = useState(String(new Date().getMonth() + 1));
    const [year, setYear] = useState(String(currentYear));
    const [units, setUnits] = useState<FreightUnit[]>([]);
    const [selectedUnitId, setSelectedUnitId] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [data, setData] = useState<FreightDashboardResponse | null>(null);
    const [dailyEntries, setDailyEntries] = useState<FreightEntry[]>([]);
    const [entriesPage, setEntriesPage] = useState(1);
    const [entriesLastPage, setEntriesLastPage] = useState(1);
    const [entriesTotal, setEntriesTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
        () => [
            String(currentYear - 1),
            String(currentYear),
            String(currentYear + 1),
        ],
        [currentYear],
    );

    async function loadDashboard(page = 1): Promise<void> {
        if (page === 1) {
            setLoading(true);
        }

        setError(null);

        const hasCustomRange = startDate !== '' && endDate !== '';
        const params = new URLSearchParams({
            competencia_mes: month,
            competencia_ano: year,
            page: String(page),
            per_page: '120',
        });

        if (hasCustomRange) {
            params.set('start_date', startDate);
            params.set('end_date', endDate);
        }

        if (selectedUnitId !== 'all') {
            params.set('unidade_id', selectedUnitId);
        }

        try {
            const response = await apiGet<FreightDashboardPageResponse>(
                `/freight/dashboard-page?${params.toString()}`,
            );

            setUnits(response.units);
            setData(response.dashboard);
            setEntriesPage(response.entries.current_page);
            setEntriesLastPage(response.entries.last_page);
            setEntriesTotal(response.entries.total);

            if (page === 1) {
                setDailyEntries(response.entries.data);
            } else {
                setDailyEntries((previous) => [
                    ...previous,
                    ...response.entries.data,
                ]);
            }
        } catch {
            setError('Não foi possível carregar o dashboard de fretes.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadDashboard(1);
    }, [month, year, selectedUnitId, startDate, endDate]);

    const dailyEntriesSorted = useMemo(
        () =>
            [...dailyEntries].sort(
                (a, b) =>
                    a.data.localeCompare(b.data) || a.unidade_id - b.unidade_id,
            ),
        [dailyEntries],
    );

    const unitRows = useMemo(
        () =>
            [...(data?.por_unidade ?? [])].sort((a, b) =>
                (a.unidade_nome ?? 'Sem unidade').localeCompare(
                    b.unidade_nome ?? 'Sem unidade',
                    'pt-BR',
                ),
            ),
        [data],
    );

    const selectedUnitLabel = useMemo(() => {
        if (selectedUnitId === 'all') {
            return 'Todas as unidades';
        }

        return (
            units.find((unit) => String(unit.id) === selectedUnitId)?.nome ??
            'Unidade selecionada'
        );
    }, [selectedUnitId, units]);

    const activePeriodLabel = useMemo(() => {
        if (startDate && endDate) {
            return `${formatDateBR(startDate)} a ${formatDateBR(endDate)}`;
        }

        const monthLabel =
            monthOptions.find((item) => item.value === month)?.label ?? month;

        return `${monthLabel}/${year}`;
    }, [endDate, month, monthOptions, startDate, year]);

    const dashboardKpiCards = useMemo(() => {
        if (!data) {
            return [];
        }

        return [
            {
                key: 'frete-liquido',
                label: 'Frete líquido total',
                value: formatCurrencyBR(data.kpis.total_frete_liquido),
                detail: `${formatIntegerBR(data.kpis.total_lancamentos)} lançamento(s)`,
            },
            {
                key: 'frete-total',
                label: 'Frete total',
                value: formatCurrencyBR(data.kpis.total_frete),
                detail: `${formatIntegerBR(data.kpis.total_aves)} aves transportadas`,
            },
            {
                key: 'media-km',
                label: 'Média R$/KM',
                value: formatCurrencyBR(data.kpis.media_reais_por_km),
                detail: `${formatIntegerBR(data.kpis.total_km)} km rodados`,
            },
            {
                key: 'dias',
                label: 'Dias trabalhados',
                value: formatIntegerBR(data.kpis.dias_trabalhados),
                detail: `${formatCurrencyBR(data.kpis.frete_por_dia_trabalhado)} por dia`,
            },
            {
                key: 'terceiros',
                label: 'Participação terceiros',
                value: formatPercentBR(data.kpis.participacao_terceiros),
                detail: `${formatCurrencyBR(data.kpis.total_frete_terceiros)} em frete 3º`,
            },
        ];
    }, [data]);

    return (
        <AdminLayout
            title="Gestão de Fretes - Dashboard"
            active="freight-dashboard"
            module="freight"
        >
            <div className="space-y-5">
                <div>
                    <h2 className="text-2xl font-semibold">Dashboard de Fretes</h2>
                    <p className="text-xs text-muted-foreground">
                        Visão consolidada do período com indicadores por unidade.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full border border-border/80 bg-muted/30 px-2.5 py-1 text-foreground/90">
                            Período: {activePeriodLabel}
                        </span>
                        <span className="rounded-full border border-border/80 bg-muted/30 px-2.5 py-1 text-foreground/90">
                            Unidade: {selectedUnitLabel}
                        </span>
                    </div>
                </div>

                {error ? <Notification message={error} variant="error" /> : null}

                <Card>
                    <CardContent className="px-3 py-3">
                        <div className="flex flex-wrap items-end gap-2">
                            <div className="min-w-[220px] flex-1">
                                <p className="mb-1 text-xs text-muted-foreground">Competência</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <Select value={month} onValueChange={setMonth}>
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

                                    <Select value={year} onValueChange={setYear}>
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
                            </div>

                            <div className="min-w-[180px]">
                                <p className="mb-1 text-xs text-muted-foreground">Unidade</p>
                                <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todas as unidades" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas as unidades</SelectItem>
                                        {units.map((unit) => (
                                            <SelectItem key={unit.id} value={String(unit.id)}>
                                                {unit.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="min-w-[170px]">
                                <p className="mb-1 text-xs text-muted-foreground">Data inicial</p>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(event) => setStartDate(event.target.value)}
                                />
                            </div>

                            <div className="min-w-[170px]">
                                <p className="mb-1 text-xs text-muted-foreground">Data final</p>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(event) => setEndDate(event.target.value)}
                                />
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setStartDate('');
                                    setEndDate('');
                                }}
                            >
                                Limpar período
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando dashboard...
                    </div>
                ) : data ? (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            {dashboardKpiCards.map((kpi) => (
                                <Card key={kpi.key} className="transport-kpi-card">
                                    <CardContent className="px-3 py-3">
                                        <p className="transport-kpi-title">{kpi.label}</p>
                                        <p className="mt-1 text-lg font-semibold text-foreground">
                                            {kpi.value}
                                        </p>
                                        <p className="transport-kpi-detail">{kpi.detail}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold">Gráficos por unidade</h3>
                                <p className="text-xs text-muted-foreground">
                                    {formatIntegerBR(unitRows.length)} unidade(s) comparadas
                                </p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                {unitMetricDefinitions.map((metric) => (
                                    <UnitMetricChartCard
                                        key={metric.key}
                                        title={metric.title}
                                        rows={unitRows.map((row) => ({
                                            label: row.unidade_nome ?? 'Sem unidade',
                                            value: metric.value(row),
                                        }))}
                                        formatValue={metric.format}
                                    />
                                ))}
                            </div>
                        </div>

                        {data.alerts && data.alerts.length > 0 ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Alertas automáticos</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {data.alerts.map((alert) => (
                                        <div key={alert.key} className="rounded-md border p-3">
                                            <p className="inline-flex items-center gap-2 text-sm font-medium">
                                                <AlertTriangle className="size-4 text-amber-600" />
                                                {alert.level === 'warning' ? 'Atenção' : 'Informação'}
                                            </p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {alert.message}
                                            </p>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ) : null}

                        <Card>
                            <CardHeader>
                                <CardTitle className="inline-flex items-center gap-2">
                                    <CalendarDays className="size-4" />
                                    Resumo mensal por unidade
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 px-4 pb-3">
                                {data.por_unidade.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sem dados para o período.</p>
                                ) : (
                                    data.por_unidade.map((item) => (
                                        <div key={item.unidade_id} className="rounded-lg border p-2">
                                            <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
                                                <p className="text-sm font-semibold">
                                                    {item.unidade_nome ?? 'Sem unidade'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {item.total_lancamentos} lançamento(s)
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1.5 text-sm sm:grid-cols-4 xl:grid-cols-7">
                                                {[
                                                    {
                                                        label: 'Dias trabalhados',
                                                        value: formatIntegerBR(item.dias_trabalhados),
                                                    },
                                                    {
                                                        label: 'Frete total',
                                                        value: formatCurrencyBR(item.total_frete),
                                                    },
                                                    {
                                                        label: 'Frete p/ caminhão',
                                                        value: formatCurrencyBR(item.frete_por_caminhao),
                                                    },
                                                    {
                                                        label: 'Frete p/ dia',
                                                        value: formatCurrencyBR(item.frete_por_dia_trabalhado),
                                                    },
                                                    {
                                                        label: 'Total KM',
                                                        value: formatIntegerBR(item.total_km),
                                                    },
                                                    {
                                                        label: 'Aves transp.',
                                                        value: formatIntegerBR(item.total_aves),
                                                    },
                                                    {
                                                        label: 'Média R$/KM',
                                                        value: formatCurrencyBR(item.frete_por_km),
                                                    },
                                                ].map(({ label, value }) => (
                                                    <div
                                                        key={label}
                                                        className="rounded border bg-muted/20 px-2 py-1.5"
                                                    >
                                                        <p className="text-[10px] leading-tight text-muted-foreground">
                                                            {label}
                                                        </p>
                                                        <p className="mt-0.5 text-xs font-semibold">{value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="inline-flex items-center gap-2">
                                    <Table2 className="size-4" />
                                    Tabela diária de fretes ({formatIntegerBR(entriesTotal)})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {dailyEntriesSorted.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        Sem lançamentos diários para a competência selecionada.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto rounded-md border">
                                        <table className="w-full min-w-[1200px] text-xs tabular-nums">
                                            <thead className="bg-muted/40 text-muted-foreground">
                                                <tr>
                                                    <th className="px-2.5 py-1.5 text-left font-medium">Data</th>
                                                    <th className="px-2.5 py-1.5 text-left font-medium">Dia</th>
                                                    <th className="px-2.5 py-1.5 text-left font-medium">Unidade</th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">Frete</th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">Cargas</th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">Aves</th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">Veículos</th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">KM rodado</th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">Frete 3º</th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">Viagens 3º</th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">Aves 3º</th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">Frete Líq.</th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">Cargas Líq.</th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">Aves Líq.</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {dailyEntriesSorted.map((entry) => (
                                                    <tr
                                                        key={entry.id}
                                                        className="border-t transition-colors hover:bg-muted/20"
                                                    >
                                                        <td className="px-2.5 py-1.5">{formatDateBR(entry.data)}</td>
                                                        <td className="px-2.5 py-1.5 capitalize">{entry.dia_semana ?? '-'}</td>
                                                        <td className="px-2.5 py-1.5">{entry.unidade?.nome ?? '-'}</td>
                                                        <td className="px-2.5 py-1.5 text-right">{formatCurrencyBR(entry.frete_total)}</td>
                                                        <td className="px-2.5 py-1.5 text-right">{formatIntegerBR(entry.cargas)}</td>
                                                        <td className="px-2.5 py-1.5 text-right">{formatIntegerBR(entry.aves)}</td>
                                                        <td className="px-2.5 py-1.5 text-right">{formatIntegerBR(entry.veiculos)}</td>
                                                        <td className="px-2.5 py-1.5 text-right">{formatIntegerBR(entry.km_rodado)}</td>
                                                        <td className="px-2.5 py-1.5 text-right">{formatCurrencyBR(entry.frete_terceiros)}</td>
                                                        <td className="px-2.5 py-1.5 text-right">{formatIntegerBR(entry.viagens_terceiros)}</td>
                                                        <td className="px-2.5 py-1.5 text-right">{formatIntegerBR(entry.aves_terceiros)}</td>
                                                        <td className="px-2.5 py-1.5 text-right">{formatCurrencyBR(entry.frete_liquido)}</td>
                                                        <td className="px-2.5 py-1.5 text-right">{formatIntegerBR(entry.cargas_liq)}</td>
                                                        <td className="px-2.5 py-1.5 text-right">{formatIntegerBR(entry.aves_liq)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {entriesPage < entriesLastPage ? (
                                    <div className="mt-3 flex justify-center">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => void loadDashboard(entriesPage + 1)}
                                            disabled={loading}
                                        >
                                            Carregar mais lançamentos
                                        </Button>
                                    </div>
                                ) : null}
                            </CardContent>
                        </Card>
                    </>
                ) : null}
            </div>
        </AdminLayout>
    );
}
