import {
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    CalendarDays,
    Download,
    LoaderCircle,
    Search,
    Table2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
    FreightDashboardResponse,
    FreightEntry,
    FreightUnit,
} from '@/types/freight';
import { AdminLayout } from '@/components/transport/admin-layout';
import {
    DashboardCompactCard,
    DashboardInsightCard,
    DashboardSection,
    DashboardSegmentedControl,
} from '@/components/transport/dashboard-primitives';
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
import { apiDownload, apiGet } from '@/lib/api-client';
import {
    formatCurrencyBR,
    formatDateBR,
    formatDecimalBR,
    formatIntegerBR,
} from '@/lib/transport-format';

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

type UnitTone = {
    bar: string;
    dot: string;
    text: string;
    soft: string;
};

type FreightTotalsMode = 'without_spot' | 'with_spot';
type DashboardViewMode = 'summary' | 'detail';

interface UnitTotals {
    frete: number;
    km: number;
    aves: number;
    viagens: number;
    lancamentos: number;
    dias: number;
}

interface KpiDelta {
    label: string;
    tone: 'up' | 'down' | 'neutral';
}

const unitTonePalette: UnitTone[] = [
    {
        bar: 'bg-sky-600',
        dot: 'bg-sky-600',
        text: 'text-sky-700',
        soft: 'bg-sky-50',
    },
    {
        bar: 'bg-sky-300',
        dot: 'bg-sky-300',
        text: 'text-sky-600',
        soft: 'bg-sky-50',
    },
    {
        bar: 'bg-slate-500',
        dot: 'bg-slate-500',
        text: 'text-slate-700',
        soft: 'bg-slate-50',
    },
    {
        bar: 'bg-slate-400',
        dot: 'bg-slate-400',
        text: 'text-slate-600',
        soft: 'bg-slate-50',
    },
];

function resolveUnitTone(label: string, index: number): UnitTone {
    const normalized = label.toLocaleLowerCase('pt-BR');

    if (normalized.includes('amparo')) {
        return unitTonePalette[0];
    }

    if (normalized.includes('itapetininga')) {
        return unitTonePalette[1];
    }

    return unitTonePalette[Math.min(index, unitTonePalette.length - 1)];
}

function Sparkline({ values }: { values: number[] }) {
    const filtered = values.filter((value) => Number.isFinite(value));

    if (filtered.length < 2) {
        return <div className="h-8 w-[120px]" />;
    }

    const min = Math.min(...filtered);
    const max = Math.max(...filtered);
    const range = Math.max(1, max - min);
    const points = filtered.map((value, index) => {
        const x = (index / (filtered.length - 1)) * 120;
        const y = 32 - ((value - min) / range) * 28 - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return (
        <svg viewBox="0 0 120 32" className="h-8 w-[120px]" aria-hidden="true">
            <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-slate-400"
                points={points.join(' ')}
            />
        </svg>
    );
}

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
                                                    ? (item.value / maxValue) *
                                                      100
                                                    : 0;
                                            const height =
                                                item.value <= 0
                                                    ? 5
                                                    : Math.min(
                                                          100,
                                                          Math.max(
                                                              14,
                                                              rawHeight,
                                                          ),
                                                      );
                                            const toneClass = resolveUnitTone(
                                                item.label,
                                                index,
                                            ).bar;

                                            return (
                                                <div
                                                    key={`${title}-${item.label}`}
                                                    className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
                                                >
                                                    <div className="flex flex-1 items-end">
                                                        <div
                                                            className={`w-full rounded-t-md ${toneClass} transition-[height] duration-300`}
                                                            style={{
                                                                height: `${height}%`,
                                                            }}
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
                                            className={`size-2 rounded-full ${resolveUnitTone(item.label, index).dot}`}
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

interface UnitComparisonCardProps {
    title: string;
    rows: Array<{ label: string; value: number }>;
    formatValue: (value: number) => string;
}

function UnitComparisonBarCard({
    title,
    rows,
    formatValue,
}: UnitComparisonCardProps) {
    const maxValue = useMemo(
        () => Math.max(0, ...rows.map((item) => item.value)),
        [rows],
    );

    return (
        <Card className="h-full border-border/80">
            <CardHeader className="px-3 pt-2.5 pb-1">
                <CardTitle className="text-sm leading-tight">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-3 pb-3">
                {rows.map((item, index) => {
                    const tone = resolveUnitTone(item.label, index);
                    const width =
                        maxValue > 0 ? (item.value / maxValue) * 100 : 0;

                    return (
                        <div
                            key={`${title}-${item.label}`}
                            className="space-y-1"
                        >
                            <div className="flex items-center justify-between text-[11px]">
                                <span
                                    className={`truncate font-medium ${tone.text}`}
                                >
                                    {item.label}
                                </span>
                                <span className="font-semibold text-foreground">
                                    {formatValue(item.value)}
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted/40">
                                <div
                                    className={`h-2 rounded-full ${tone.bar}`}
                                    style={{ width: `${Math.max(6, width)}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}

function UnitRatioCard({
    title,
    rows,
}: {
    title: string;
    rows: Array<{ label: string; value: number }>;
}) {
    return (
        <Card className="h-full border-border/80">
            <CardHeader className="px-3 pt-2.5 pb-1">
                <CardTitle className="text-sm leading-tight">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-3 pb-3">
                {rows.map((item, index) => {
                    const tone = resolveUnitTone(item.label, index);
                    const clamped = Math.max(0, Math.min(100, item.value));

                    return (
                        <div
                            key={`${title}-${item.label}`}
                            className="space-y-1"
                        >
                            <div className="flex items-center justify-between text-[11px]">
                                <span
                                    className={`truncate font-medium ${tone.text}`}
                                >
                                    {item.label}
                                </span>
                                <span className="font-semibold text-foreground">
                                    {formatDecimalBR(item.value, 2)}%
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted/40">
                                <div
                                    className={`h-2 rounded-full ${tone.bar}`}
                                    style={{
                                        width: `${Math.max(6, clamped)}%`,
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}

function UnitMetricListCard({
    title,
    rows,
    formatValue,
}: UnitComparisonCardProps) {
    return (
        <Card className="h-full border-border/80">
            <CardHeader className="px-3 pt-2.5 pb-1">
                <CardTitle className="text-sm leading-tight">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-3">
                {rows.map((item, index) => {
                    const tone = resolveUnitTone(item.label, index);

                    return (
                        <div
                            key={`${title}-${item.label}`}
                            className="flex items-center justify-between text-[11px]"
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                <span
                                    className={`size-2 rounded-full ${tone.dot}`}
                                />
                                <span className="truncate text-muted-foreground">
                                    {item.label}
                                </span>
                            </div>
                            <span className="font-semibold text-foreground">
                                {formatValue(item.value)}
                            </span>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}

function toNumber(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0);

    return Number.isFinite(parsed) ? parsed : 0;
}

function toDateInput(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function previousMonth(month: string, year: string): { month: string; year: string } {
    const date = new Date(Number(year), Number(month) - 2, 1);

    return {
        month: String(date.getMonth() + 1),
        year: String(date.getFullYear()),
    };
}

function previousMonthComparisonRange(
    month: string,
    year: string,
    latestEntryDate: string | null | undefined,
): { month: string; year: string; startDate?: string; endDate?: string } {
    const previous = previousMonth(month, year);

    if (!latestEntryDate) {
        return previous;
    }

    const [latestYear, latestMonth, latestDay] = latestEntryDate
        .split('-')
        .map(Number);

    if (
        latestYear !== Number(year) ||
        latestMonth !== Number(month) ||
        !Number.isInteger(latestDay) ||
        latestDay < 1
    ) {
        return previous;
    }

    const previousMonthIndex = Number(previous.month) - 1;
    const previousYear = Number(previous.year);
    const previousMonthLastDay = new Date(
        previousYear,
        previousMonthIndex + 1,
        0,
    ).getDate();
    const comparisonDay = Math.min(latestDay, previousMonthLastDay);

    return {
        ...previous,
        startDate: toDateInput(new Date(previousYear, previousMonthIndex, 1)),
        endDate: toDateInput(
            new Date(previousYear, previousMonthIndex, comparisonDay),
        ),
    };
}

function sumUnitTotals(rows: UnitMetricRow[]): UnitTotals {
    return rows.reduce(
        (totals, row) => ({
            frete: totals.frete + Number(row.total_frete ?? 0),
            km: totals.km + Number(row.total_km ?? 0),
            aves: totals.aves + Number(row.total_aves ?? 0),
            viagens: totals.viagens + Number(row.total_viagens_kaique ?? 0),
            lancamentos:
                totals.lancamentos + Number(row.total_lancamentos ?? 0),
            dias: Math.max(totals.dias, Number(row.dias_trabalhados ?? 0)),
        }),
        {
            frete: 0,
            km: 0,
            aves: 0,
            viagens: 0,
            lancamentos: 0,
            dias: 0,
        },
    );
}

function buildRowsForTotals(
    rows: UnitMetricRow[],
    totalsMode: FreightTotalsMode,
): UnitMetricRow[] {
    if (totalsMode === 'without_spot') {
        return rows;
    }

    return rows.map((row) => ({
        ...row,
        total_lancamentos:
            Number(row.total_lancamentos ?? 0) +
            Number(row.total_lancamentos_spot ?? 0),
        total_frete: Number(row.total_frete_com_spot ?? 0),
        total_frete_liquido: Number(row.total_frete_com_spot ?? 0),
        total_km: Number(row.total_km_com_spot ?? 0),
        total_aves: Number(row.total_aves_com_spot ?? 0),
        total_viagens_kaique: Number(row.total_viagens_com_spot ?? 0),
        dias_trabalhados: Math.max(
            Number(row.dias_trabalhados ?? 0),
            Number(row.dias_spot ?? 0),
        ),
    }));
}

function buildKpiDelta(
    current: number,
    previous: number,
    comparisonAvailable: boolean,
): KpiDelta | null {
    if (!comparisonAvailable || previous <= 0) {
        return null;
    }

    const change = ((current - previous) / previous) * 100;

    return {
        label: `${change >= 0 ? '+' : ''}${formatDecimalBR(change, 1)}% vs mesmo período anterior`,
        tone: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
    };
}

function entryHasAttention(entry: FreightEntry): boolean {
    const km = kaiqueKmValue(entry);
    const trips = kaiqueTripsValue(entry);
    const freight = kaiqueFreightValue(entry);

    return (
        km > 25000 ||
        (km > 0 && km < 1000) ||
        (trips > 0 && freight / trips < 120) ||
        (trips <= 0 && freight > 0)
    );
}

function hasGroupedFreightMetrics(entry: FreightEntry): boolean {
    return (
        toNumber(entry.kaique_geral_frete) > 0 ||
        toNumber(entry.kaique_geral_km) > 0 ||
        toNumber(entry.kaique_geral_viagens) > 0 ||
        toNumber(entry.kaique_geral_aves) > 0 ||
        toNumber(entry.terceiros_frete) > 0 ||
        toNumber(entry.terceiros_km) > 0 ||
        toNumber(entry.terceiros_viagens) > 0 ||
        toNumber(entry.terceiros_aves) > 0 ||
        toNumber(entry.programado_frete) > 0 ||
        toNumber(entry.abatedouro_frete) > 0
    );
}

function kaiqueFreightValue(entry: FreightEntry): number {
    if (hasGroupedFreightMetrics(entry)) {
        return toNumber(entry.kaique_geral_frete);
    }

    const liquid = toNumber(entry.frete_liquido);

    return liquid > 0
        ? liquid
        : Math.max(
              0,
              toNumber(entry.frete_total) - toNumber(entry.frete_terceiros),
          );
}

function kaiqueKmValue(entry: FreightEntry): number {
    if (hasGroupedFreightMetrics(entry)) {
        return toNumber(entry.kaique_geral_km);
    }

    return Math.max(
        0,
        toNumber(entry.km_rodado) - toNumber(entry.km_terceiros),
    );
}

function kaiqueBirdsValue(entry: FreightEntry): number {
    if (hasGroupedFreightMetrics(entry)) {
        return toNumber(entry.kaique_geral_aves);
    }

    return toNumber(entry.aves_liq);
}

function kaiqueTripsValue(entry: FreightEntry): number {
    if (hasGroupedFreightMetrics(entry)) {
        return toNumber(entry.kaique_geral_viagens);
    }

    return toNumber(entry.cargas_liq);
}

const unitMetricDefinitions: UnitMetricDefinition[] = [
    {
        key: 'frete-kaique',
        title: 'Frete Kaique Geral',
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
        value: (row) =>
            Number(row.percentual_frete_terceiros_sobre_programado ?? 0),
        format: (value) => `${formatDecimalBR(value, 2)}%`,
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
    const [totalsMode, setTotalsMode] =
        useState<FreightTotalsMode>('without_spot');
    const [viewMode, setViewMode] = useState<DashboardViewMode>('detail');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [data, setData] = useState<FreightDashboardResponse | null>(null);
    const [previousData, setPreviousData] =
        useState<FreightDashboardResponse | null>(null);
    const [dailyEntries, setDailyEntries] = useState<FreightEntry[]>([]);
    const [dailySearch, setDailySearch] = useState('');
    const [onlyAttentionRows, setOnlyAttentionRows] = useState(false);
    const [entriesPage, setEntriesPage] = useState(1);
    const [entriesLastPage, setEntriesLastPage] = useState(1);
    const [entriesTotal, setEntriesTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [previousLoading, setPreviousLoading] = useState(false);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
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

    const loadDashboard = useCallback(async (page = 1): Promise<void> => {
        if (page === 1) {
            setLoading(true);
        }

        setError(null);

        const hasCustomRange = startDate !== '' && endDate !== '';
        const params = new URLSearchParams({
            competencia_mes: month,
            competencia_ano: year,
            page: String(page),
            per_page: '50',
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
    }, [endDate, month, selectedUnitId, startDate, year]);

    useEffect(() => {
        void loadDashboard(1);
    }, [loadDashboard]);

    useEffect(() => {
        if (startDate || endDate) {
            setPreviousData(null);
            return;
        }

        if (
            !data ||
            data.competencia_mes !== Number(month) ||
            data.competencia_ano !== Number(year)
        ) {
            setPreviousData(null);
            return;
        }

        const loadPreviousDashboard = async (): Promise<void> => {
            setPreviousLoading(true);
            const previous = previousMonthComparisonRange(
                month,
                year,
                data.latest_entry_date,
            );
            const params = new URLSearchParams({
                competencia_mes: previous.month,
                competencia_ano: previous.year,
            });

            if (previous.startDate && previous.endDate) {
                params.set('start_date', previous.startDate);
                params.set('end_date', previous.endDate);
            }

            if (selectedUnitId !== 'all') {
                params.set('unidade_id', selectedUnitId);
            }

            try {
                const response = await apiGet<FreightDashboardResponse>(
                    `/freight/dashboard?${params.toString()}`,
                );
                setPreviousData(response);
            } catch {
                setPreviousData(null);
            } finally {
                setPreviousLoading(false);
            }
        };

        const timeoutId = window.setTimeout(() => {
            void loadPreviousDashboard();
        }, 350);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [data, endDate, month, selectedUnitId, startDate, year]);

    const dailyEntriesSorted = useMemo(
        () =>
            [...dailyEntries].sort(
                (a, b) =>
                    a.data.localeCompare(b.data) || a.unidade_id - b.unidade_id,
            ),
        [dailyEntries],
    );

    const filteredDailyEntries = useMemo(() => {
        const search = dailySearch.trim().toLocaleLowerCase('pt-BR');

        return dailyEntriesSorted.filter((entry) => {
            if (onlyAttentionRows && !entryHasAttention(entry)) {
                return false;
            }

            if (!search) {
                return true;
            }

            const haystack = [
                entry.data,
                formatDateBR(entry.data),
                entry.dia_semana ?? '',
                entry.unidade?.nome ?? '',
                entry.placas ?? '',
                entry.obs ?? '',
            ]
                .join(' ')
                .toLocaleLowerCase('pt-BR');

            return haystack.includes(search);
        });
    }, [dailyEntriesSorted, dailySearch, onlyAttentionRows]);

    const filteredDailyTotals = useMemo(
        () =>
            filteredDailyEntries.reduce(
                (totals, entry) => ({
                    frete: totals.frete + toNumber(entry.frete_total),
                    cargas: totals.cargas + toNumber(entry.cargas),
                    aves: totals.aves + toNumber(entry.aves),
                    veiculos: totals.veiculos + toNumber(entry.veiculos),
                    km: totals.km + toNumber(entry.km_rodado),
                    terceiros: totals.terceiros + toNumber(entry.frete_terceiros),
                    viagensTerceiros:
                        totals.viagensTerceiros +
                        toNumber(entry.viagens_terceiros),
                    avesTerceiros:
                        totals.avesTerceiros + toNumber(entry.aves_terceiros),
                    liquido: totals.liquido + toNumber(entry.frete_liquido),
                    cargasLiquidas:
                        totals.cargasLiquidas + toNumber(entry.cargas_liq),
                    avesLiquidas:
                        totals.avesLiquidas + toNumber(entry.aves_liq),
                }),
                {
                    frete: 0,
                    cargas: 0,
                    aves: 0,
                    veiculos: 0,
                    km: 0,
                    terceiros: 0,
                    viagensTerceiros: 0,
                    avesTerceiros: 0,
                    liquido: 0,
                    cargasLiquidas: 0,
                    avesLiquidas: 0,
                },
            ),
        [filteredDailyEntries],
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

    const unitRowsForTotals = useMemo(
        () => buildRowsForTotals(unitRows, totalsMode),
        [totalsMode, unitRows],
    );

    const previousUnitRowsForTotals = useMemo(
        () =>
            buildRowsForTotals(
                previousData?.por_unidade ?? [],
                totalsMode,
            ).sort((a, b) =>
                (a.unidade_nome ?? 'Sem unidade').localeCompare(
                    b.unidade_nome ?? 'Sem unidade',
                    'pt-BR',
                ),
            ),
        [previousData, totalsMode],
    );

    const currentTotals = useMemo(
        () => sumUnitTotals(unitRowsForTotals),
        [unitRowsForTotals],
    );

    const previousTotals = useMemo(
        () => sumUnitTotals(previousUnitRowsForTotals),
        [previousUnitRowsForTotals],
    );

    const spotTotals = useMemo(
        () =>
            unitRows.reduce(
                (totals, row) => ({
                    frete: totals.frete + Number(row.total_frete_spot ?? 0),
                    km: totals.km + Number(row.total_km_spot ?? 0),
                    aves: totals.aves + Number(row.total_aves_spot ?? 0),
                    viagens:
                        totals.viagens + Number(row.total_viagens_spot ?? 0),
                    lancamentos:
                        totals.lancamentos +
                        Number(row.total_lancamentos_spot ?? 0),
                }),
                {
                    frete: 0,
                    km: 0,
                    aves: 0,
                    viagens: 0,
                    lancamentos: 0,
                },
            ),
        [unitRows],
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

    const dailySummary = useMemo(() => {
        const map = new Map<
            string,
            { frete: number; km: number; aves: number; viagens: number }
        >();

        dailyEntries.forEach((entry) => {
            const current = map.get(entry.data) ?? {
                frete: 0,
                km: 0,
                aves: 0,
                viagens: 0,
            };

            current.frete += kaiqueFreightValue(entry);
            current.km += kaiqueKmValue(entry);
            current.aves += kaiqueBirdsValue(entry);
            current.viagens += kaiqueTripsValue(entry);

            map.set(entry.data, current);
        });

        return Array.from(map.entries())
            .map(([date, values]) => ({ date, ...values }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [dailyEntries]);

    const trendSeries = useMemo(() => {
        const slice = dailySummary.slice(-14);
        return {
            frete: slice.map((item) => item.frete),
            km: slice.map((item) => item.km),
            aves: slice.map((item) => item.aves),
            viagens: slice.map((item) => item.viagens),
        };
    }, [dailySummary]);

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

        const comparisonAvailable = !startDate && !endDate && !!previousData;
        const reaisPorKm =
            currentTotals.km > 0 ? currentTotals.frete / currentTotals.km : 0;

        return [
            {
                key: 'frete-liquido',
                label: 'Frete Kaique Geral',
                value: formatCurrencyBR(currentTotals.frete),
                detail: `${formatIntegerBR(currentTotals.lancamentos)} lançamento(s)${
                    totalsMode === 'with_spot' && spotTotals.frete > 0
                        ? `, ${formatCurrencyBR(spotTotals.frete)} spot`
                        : ''
                }`,
                delta: buildKpiDelta(
                    currentTotals.frete,
                    previousTotals.frete,
                    comparisonAvailable,
                ),
                series: trendSeries.frete,
                rowValue: (row: UnitMetricRow) => Number(row.total_frete ?? 0),
                formatRow: formatCurrencyBR,
            },
            {
                key: 'viagens',
                label: 'Viagens',
                value: formatIntegerBR(currentTotals.viagens),
                detail: `${formatIntegerBR(currentTotals.dias)} dias trabalhados`,
                delta: buildKpiDelta(
                    currentTotals.viagens,
                    previousTotals.viagens,
                    comparisonAvailable,
                ),
                series: trendSeries.viagens,
                rowValue: (row: UnitMetricRow) =>
                    Number(row.total_viagens_kaique ?? 0),
                formatRow: formatIntegerBR,
            },
            {
                key: 'km',
                label: 'KM Kaique Geral',
                value: formatIntegerBR(currentTotals.km),
                detail: `${formatCurrencyBR(reaisPorKm)} por km`,
                delta: buildKpiDelta(
                    currentTotals.km,
                    previousTotals.km,
                    comparisonAvailable,
                ),
                series: trendSeries.km,
                rowValue: (row: UnitMetricRow) => Number(row.total_km ?? 0),
                formatRow: formatIntegerBR,
            },
            {
                key: 'aves',
                label: 'Aves Kaique Geral',
                value: formatIntegerBR(currentTotals.aves),
                detail: `${formatIntegerBR(currentTotals.viagens)} viagens Kaique`,
                delta: buildKpiDelta(
                    currentTotals.aves,
                    previousTotals.aves,
                    comparisonAvailable,
                ),
                series: trendSeries.aves,
                rowValue: (row: UnitMetricRow) => Number(row.total_aves ?? 0),
                formatRow: formatIntegerBR,
            },
        ];
    }, [
        currentTotals,
        data,
        endDate,
        previousData,
        previousTotals,
        spotTotals.frete,
        startDate,
        totalsMode,
        trendSeries,
    ]);

    const volumeMetrics = unitMetricDefinitions.slice(0, 4);
    const performanceMetrics = unitMetricDefinitions.slice(4, 8);
    const efficiencyMetrics = unitMetricDefinitions.slice(8, 12);

    const executiveInsights = useMemo(() => {
        const rankedByFreight = [...unitRowsForTotals].sort(
            (a, b) => Number(b.total_frete ?? 0) - Number(a.total_frete ?? 0),
        );
        const leader = rankedByFreight[0];
        const bestKm = [...unitRowsForTotals]
            .filter((row) => Number(row.frete_por_km ?? 0) > 0)
            .sort(
                (a, b) =>
                    Number(a.frete_por_km ?? 0) - Number(b.frete_por_km ?? 0),
            )[0];
        const thirdPartyTotal = Number(data?.kpis.total_frete_terceiros ?? 0);
        const thirdPartyPercent =
            currentTotals.frete + thirdPartyTotal > 0
                ? (thirdPartyTotal /
                      (currentTotals.frete + thirdPartyTotal)) *
                  100
                : 0;
        const spotPercent =
            currentTotals.frete + spotTotals.frete > 0
                ? (spotTotals.frete /
                      (currentTotals.frete + spotTotals.frete)) *
                  100
                : 0;

        return [
            {
                label: 'Maior volume',
                value: leader?.unidade_nome ?? 'Sem unidade',
                detail: leader
                    ? `${formatCurrencyBR(leader.total_frete)} no período, ${formatIntegerBR(leader.total_viagens_kaique)} viagens.`
                    : 'Sem lançamentos no período.',
                tone: 'default' as const,
            },
            {
                label: 'Melhor custo por KM',
                value: bestKm?.unidade_nome ?? 'Sem referência',
                detail: bestKm
                    ? `${formatCurrencyBR(bestKm.frete_por_km)} por km informado.`
                    : 'Não há KM suficiente para comparar.',
                tone: 'positive' as const,
            },
            {
                label: 'Dependência externa',
                value: `${formatDecimalBR(thirdPartyPercent, 1)}% terceiros`,
                detail:
                    thirdPartyPercent > 20
                        ? 'Participação de terceiros pede conferência operacional.'
                        : 'Participação de terceiros dentro de uma faixa controlada.',
                tone:
                    thirdPartyPercent > 20 ? ('attention' as const) : ('default' as const),
            },
            {
                label: 'Spot no período',
                value: `${formatDecimalBR(spotPercent, 1)}%`,
                detail:
                    spotTotals.frete > 0
                        ? `${formatCurrencyBR(spotTotals.frete)} em frete spot.`
                        : 'Sem frete spot no recorte atual.',
                tone: spotPercent > 15 ? ('attention' as const) : ('default' as const),
            },
        ];
    }, [currentTotals.frete, data, spotTotals.frete, unitRowsForTotals]);

    const pdfPath = useMemo(() => {
        const params = new URLSearchParams({
            competencia_mes: month,
            competencia_ano: year,
            include_spot: totalsMode === 'with_spot' ? '1' : '0',
            download: '1',
        });

        if (startDate && endDate) {
            params.set('start_date', startDate);
            params.set('end_date', endDate);
        }

        if (selectedUnitId !== 'all') {
            params.set('unidade_id', selectedUnitId);
        }

        return `/freight/dashboard-executive-pdf?${params.toString()}`;
    }, [endDate, month, selectedUnitId, startDate, totalsMode, year]);

    async function downloadExecutivePdf(): Promise<void> {
        setDownloadingPdf(true);

        try {
            await apiDownload(pdfPath, 'resumo-executivo-fretes.pdf');
        } catch {
            setError('Não foi possível baixar o PDF executivo.');
        } finally {
            setDownloadingPdf(false);
        }
    }

    function applyPeriodPreset(preset: 'current-month' | 'previous-month' | 'last-7' | 'last-30'): void {
        const today = new Date();

        if (preset === 'current-month') {
            setMonth(String(today.getMonth() + 1));
            setYear(String(today.getFullYear()));
            setStartDate('');
            setEndDate('');
            return;
        }

        if (preset === 'previous-month') {
            const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            setMonth(String(previous.getMonth() + 1));
            setYear(String(previous.getFullYear()));
            setStartDate('');
            setEndDate('');
            return;
        }

        const start = new Date(today);
        start.setDate(today.getDate() - (preset === 'last-7' ? 6 : 29));
        setStartDate(toDateInput(start));
        setEndDate(toDateInput(today));
    }

    return (
        <AdminLayout
            title="Gestão de Fretes - Dashboard"
            active="freight-dashboard"
            module="freight"
        >
            <div className="space-y-5">
                <div>
                    <h2 className="text-2xl font-semibold">
                        Dashboard de Fretes
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Indicadores do período por unidade.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full border border-border/80 bg-muted/30 px-2.5 py-1 text-foreground/90">
                            Período: {activePeriodLabel}
                        </span>
                        <span className="rounded-full border border-border/80 bg-muted/30 px-2.5 py-1 text-foreground/90">
                            Unidade: {selectedUnitLabel}
                        </span>
                        <DashboardSegmentedControl
                            value={totalsMode}
                            options={[
                                { value: 'without_spot', label: 'Sem spot' },
                                { value: 'with_spot', label: 'Com spot' },
                            ]}
                            onChange={setTotalsMode}
                        />
                        {spotTotals.frete > 0 ? (
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">
                                Spot no período:{' '}
                                {formatCurrencyBR(spotTotals.frete)}
                            </span>
                        ) : null}
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1.5 px-2.5 text-xs"
                            onClick={() => void downloadExecutivePdf()}
                            disabled={downloadingPdf}
                        >
                            {downloadingPdf ? (
                                <LoaderCircle className="size-3.5 animate-spin" />
                            ) : (
                                <Download className="size-3.5" />
                            )}
                            {downloadingPdf ? 'Gerando PDF' : 'PDF executivo'}
                        </Button>
                    </div>
                </div>

                {error ? (
                    <Notification message={error} variant="error" />
                ) : null}

                <Card>
                    <CardContent className="px-3 py-3">
                        <div className="flex flex-wrap items-end gap-2">
                            <div className="min-w-[220px] flex-1">
                                <p className="mb-1 text-xs text-muted-foreground">
                                    Competência
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    <Select
                                        value={month}
                                        onValueChange={setMonth}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {monthOptions.map((item) => (
                                                <SelectItem
                                                    key={item.value}
                                                    value={item.value}
                                                >
                                                    {item.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Select
                                        value={year}
                                        onValueChange={setYear}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {yearOptions.map((item) => (
                                                <SelectItem
                                                    key={item}
                                                    value={item}
                                                >
                                                    {item}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="min-w-[180px]">
                                <p className="mb-1 text-xs text-muted-foreground">
                                    Unidade
                                </p>
                                <Select
                                    value={selectedUnitId}
                                    onValueChange={setSelectedUnitId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todas as unidades" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            Todas as unidades
                                        </SelectItem>
                                        {units.map((unit) => (
                                            <SelectItem
                                                key={unit.id}
                                                value={String(unit.id)}
                                            >
                                                {unit.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="min-w-[170px]">
                                <p className="mb-1 text-xs text-muted-foreground">
                                    Data inicial
                                </p>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(event) =>
                                        setStartDate(event.target.value)
                                    }
                                />
                            </div>

                            <div className="min-w-[170px]">
                                <p className="mb-1 text-xs text-muted-foreground">
                                    Data final
                                </p>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(event) =>
                                        setEndDate(event.target.value)
                                    }
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
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        applyPeriodPreset('current-month')
                                    }
                                >
                                    Mês atual
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        applyPeriodPreset('previous-month')
                                    }
                                >
                                    Mês anterior
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => applyPeriodPreset('last-7')}
                                >
                                    Últimos 7 dias
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => applyPeriodPreset('last-30')}
                                >
                                    Últimos 30 dias
                                </Button>
                            </div>
                            <DashboardSegmentedControl
                                value={viewMode}
                                options={[
                                    { value: 'summary', label: 'Resumo' },
                                    { value: 'detail', label: 'Detalhe' },
                                ]}
                                onChange={setViewMode}
                            />
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
                        <div className="grid gap-3 lg:grid-cols-4">
                            {dashboardKpiCards.map((kpi) => {
                                const diffMeta = (() => {
                                    if (unitRowsForTotals.length < 2)
                                        return null;

                                    const sorted = [...unitRowsForTotals].sort(
                                        (a, b) =>
                                            kpi.rowValue(b) - kpi.rowValue(a),
                                    );
                                    const leader = sorted[0];
                                    const runner = sorted[1];
                                    const diff =
                                        kpi.rowValue(leader) -
                                        kpi.rowValue(runner);
                                    return {
                                        leader:
                                            leader.unidade_nome ?? 'Unidade A',
                                        runner:
                                            runner.unidade_nome ?? 'Unidade B',
                                        diff,
                                    };
                                })();

                                const diffIsPositive =
                                    (diffMeta?.diff ?? 0) >= 0;
                                const diffIcon = diffIsPositive
                                    ? ArrowUpRight
                                    : ArrowDownRight;
                                const DiffIcon = diffIcon;

                                return (
                                    <Card
                                        key={kpi.key}
                                        className="transport-kpi-card"
                                    >
                                        <CardContent className="flex h-full flex-col gap-3 px-4 py-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                                        {kpi.label}
                                                    </p>
                                                    <p className="mt-1 text-2xl font-semibold text-foreground">
                                                        {kpi.value}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {kpi.detail}
                                                    </p>
                                                    {kpi.delta ? (
                                                        <p
                                                            className={`mt-1 text-[11px] font-medium ${
                                                                kpi.delta
                                                                    .tone ===
                                                                'up'
                                                                    ? 'text-emerald-700'
                                                                    : kpi.delta
                                                                            .tone ===
                                                                        'down'
                                                                      ? 'text-rose-700'
                                                                      : 'text-muted-foreground'
                                                            }`}
                                                        >
                                                            {kpi.delta.label}
                                                        </p>
                                                    ) : previousLoading ? (
                                                        <p className="mt-1 text-[11px] text-muted-foreground">
                                                            Comparando mês
                                                            anterior...
                                                        </p>
                                                    ) : null}
                                                </div>
                                                <Sparkline
                                                    values={kpi.series}
                                                />
                                            </div>

                                            <div className="space-y-1 text-[11px]">
                                                {unitRowsForTotals.map(
                                                    (row, index) => {
                                                        const label =
                                                            row.unidade_nome ??
                                                            'Sem unidade';
                                                        const tone =
                                                            resolveUnitTone(
                                                                label,
                                                                index,
                                                            );
                                                        return (
                                                            <div
                                                                key={`${kpi.key}-${label}`}
                                                                className="flex items-center justify-between"
                                                            >
                                                                <div className="flex min-w-0 items-center gap-2">
                                                                    <span
                                                                        className={`size-2 rounded-full ${tone.dot}`}
                                                                    />
                                                                    <span className="truncate text-muted-foreground">
                                                                        {label}
                                                                    </span>
                                                                </div>
                                                                <span className="font-semibold text-foreground">
                                                                    {kpi.formatRow(
                                                                        kpi.rowValue(
                                                                            row,
                                                                        ),
                                                                    )}
                                                                </span>
                                                            </div>
                                                        );
                                                    },
                                                )}
                                            </div>

                                            {diffMeta ? (
                                                <div
                                                    className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                                                        diffIsPositive
                                                            ? 'text-emerald-700'
                                                            : 'text-rose-700'
                                                    }`}
                                                >
                                                    <DiffIcon className="size-3.5" />
                                                    {diffMeta.leader}{' '}
                                                    {diffIsPositive
                                                        ? 'acima'
                                                        : 'abaixo'}{' '}
                                                    de {diffMeta.runner} (
                                                    {kpi.formatRow(
                                                        Math.abs(diffMeta.diff),
                                                    )}
                                                    )
                                                </div>
                                            ) : null}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>

                        {viewMode === 'summary' ? (
                            <>
                                <DashboardSection
                                    title="Leitura executiva"
                                    description={
                                        !startDate && !endDate
                                            ? 'Comparação com o mês anterior ativa'
                                            : 'Período personalizado sem comparação automática'
                                    }
                                >
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        {executiveInsights.map((insight) => (
                                            <DashboardInsightCard
                                                key={insight.label}
                                                label={insight.label}
                                                value={insight.value}
                                                detail={insight.detail}
                                                tone={insight.tone}
                                            />
                                        ))}
                                    </div>
                                </DashboardSection>

                                <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
                                    <DashboardCompactCard title="Ranking operacional">
                                        <div className="space-y-2">
                                            {unitRowsForTotals
                                                .slice()
                                                .sort(
                                                    (a, b) =>
                                                        Number(
                                                            b.total_frete ?? 0,
                                                        ) -
                                                        Number(
                                                            a.total_frete ?? 0,
                                                        ),
                                                )
                                                .slice(0, 5)
                                                .map((row, index) => (
                                                    <div
                                                        key={row.unidade_id}
                                                        className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-md border px-3 py-2 text-sm"
                                                    >
                                                        <span className="text-xs font-semibold text-muted-foreground">
                                                            #{index + 1}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="truncate font-medium">
                                                                {row.unidade_nome ??
                                                                    'Sem unidade'}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {formatIntegerBR(
                                                                    row.total_viagens_kaique,
                                                                )}{' '}
                                                                viagens ·{' '}
                                                                {formatIntegerBR(
                                                                    row.total_km,
                                                                )}{' '}
                                                                km
                                                            </p>
                                                        </div>
                                                        <span className="font-semibold tabular-nums">
                                                            {formatCurrencyBR(
                                                                row.total_frete,
                                                            )}
                                                        </span>
                                                    </div>
                                                ))}
                                        </div>
                                    </DashboardCompactCard>

                                    <DashboardCompactCard title="Conferências">
                                        {data.alerts && data.alerts.length > 0 ? (
                                            <div className="space-y-2">
                                                {data.alerts
                                                    .slice(0, 4)
                                                    .map((alert) => (
                                                        <div
                                                            key={alert.key}
                                                            className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm"
                                                        >
                                                            <p className="font-medium text-amber-800">
                                                                {alert.level ===
                                                                'warning'
                                                                    ? 'Atenção'
                                                                    : 'Informação'}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {alert.message}
                                                            </p>
                                                        </div>
                                                    ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                Sem alertas automáticos no
                                                período.
                                            </p>
                                        )}
                                    </DashboardCompactCard>
                                </div>

                                <DashboardSection
                                    title="Resumo por unidade"
                                    description={`${formatIntegerBR(unitRows.length)} unidade(s) comparadas`}
                                >
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        {volumeMetrics.map((metric) => (
                                            <UnitComparisonBarCard
                                                key={metric.key}
                                                title={metric.title}
                                                rows={unitRowsForTotals.map(
                                                    (row) => ({
                                                        label:
                                                            row.unidade_nome ??
                                                            'Sem unidade',
                                                        value: metric.value(row),
                                                    }),
                                                )}
                                                formatValue={metric.format}
                                            />
                                        ))}
                                    </div>
                                </DashboardSection>
                            </>
                        ) : (
                            <>
                                <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold">
                                    Comparativo geral
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {formatIntegerBR(unitRows.length)}{' '}
                                    unidade(s) comparadas
                                </p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                {volumeMetrics.map((metric) => (
                                    <UnitMetricChartCard
                                        key={metric.key}
                                        title={metric.title}
                                        rows={unitRowsForTotals.map((row) => ({
                                            label:
                                                row.unidade_nome ??
                                                'Sem unidade',
                                            value: metric.value(row),
                                        }))}
                                        formatValue={metric.format}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold">
                                    Desempenho operacional
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Comparação direta entre unidades
                                </p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                {performanceMetrics.map((metric) => (
                                    <UnitComparisonBarCard
                                        key={metric.key}
                                        title={metric.title}
                                        rows={unitRows.map((row) => ({
                                            label:
                                                row.unidade_nome ??
                                                'Sem unidade',
                                            value: metric.value(row),
                                        }))}
                                        formatValue={metric.format}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold">
                                    Proporções e eficiência
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Indicadores relativos do período
                                </p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <UnitRatioCard
                                    title="% Frete Terceiros / Frete Programado"
                                    rows={unitRows.map((row) => ({
                                        label:
                                            row.unidade_nome ?? 'Sem unidade',
                                        value: Number(
                                            row.percentual_frete_terceiros_sobre_programado ??
                                                0,
                                        ),
                                    }))}
                                />
                                {efficiencyMetrics.map((metric) => (
                                    <UnitMetricListCard
                                        key={metric.key}
                                        title={metric.title}
                                        rows={unitRows.map((row) => ({
                                            label:
                                                row.unidade_nome ??
                                                'Sem unidade',
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
                                        <div
                                            key={alert.key}
                                            className="rounded-md border p-3"
                                        >
                                            <p className="inline-flex items-center gap-2 text-sm font-medium">
                                                <AlertTriangle className="size-4 text-amber-600" />
                                                {alert.level === 'warning'
                                                    ? 'Atenção'
                                                    : 'Informação'}
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
                                    <p className="text-sm text-muted-foreground">
                                        Sem dados para o período.
                                    </p>
                                ) : (
                                    data.por_unidade.map((item) => (
                                        <div
                                            key={item.unidade_id}
                                            className="rounded-lg border p-2"
                                        >
                                            <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
                                                <p className="text-sm font-semibold">
                                                    {item.unidade_nome ??
                                                        'Sem unidade'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {item.total_lancamentos}{' '}
                                                    lançamento(s)
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1.5 text-sm sm:grid-cols-4 xl:grid-cols-7">
                                                {[
                                                    {
                                                        label: 'Dias trabalhados',
                                                        value: formatIntegerBR(
                                                            item.dias_trabalhados,
                                                        ),
                                                    },
                                                    {
                                                        label: 'Frete total',
                                                        value: formatCurrencyBR(
                                                            item.total_frete,
                                                        ),
                                                    },
                                                    {
                                                        label: 'Frete p/ caminhão',
                                                        value: formatCurrencyBR(
                                                            item.frete_por_caminhao,
                                                        ),
                                                    },
                                                    {
                                                        label: 'Frete p/ dia',
                                                        value: formatCurrencyBR(
                                                            item.frete_por_dia_trabalhado,
                                                        ),
                                                    },
                                                    {
                                                        label: 'Total KM',
                                                        value: formatIntegerBR(
                                                            item.total_km,
                                                        ),
                                                    },
                                                    {
                                                        label: 'Aves transp.',
                                                        value: formatIntegerBR(
                                                            item.total_aves,
                                                        ),
                                                    },
                                                    {
                                                        label: 'Média R$/KM',
                                                        value: formatCurrencyBR(
                                                            item.frete_por_km,
                                                        ),
                                                    },
                                                ].map(({ label, value }) => (
                                                    <div
                                                        key={label}
                                                        className="rounded border bg-muted/20 px-2 py-1.5"
                                                    >
                                                        <p className="text-[10px] leading-tight text-muted-foreground">
                                                            {label}
                                                        </p>
                                                        <p className="mt-0.5 text-xs font-semibold">
                                                            {value}
                                                        </p>
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
                                    Tabela diária de fretes (
                                    {formatIntegerBR(entriesTotal)})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <div className="relative min-w-[240px] flex-1">
                                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={dailySearch}
                                            onChange={(event) =>
                                                setDailySearch(
                                                    event.target.value,
                                                )
                                            }
                                            className="pl-9"
                                            placeholder="Buscar por data, unidade, placa ou observação"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant={
                                            onlyAttentionRows
                                                ? 'default'
                                                : 'outline'
                                        }
                                        onClick={() =>
                                            setOnlyAttentionRows(
                                                (current) => !current,
                                            )
                                        }
                                    >
                                        Somente conferências
                                    </Button>
                                </div>

                                {filteredDailyEntries.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        Sem lançamentos diários para os filtros
                                        selecionados.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto rounded-md border">
                                        <table className="w-full min-w-[1200px] text-xs tabular-nums">
                                            <thead className="sticky top-0 z-10 bg-muted text-muted-foreground">
                                                <tr>
                                                    <th className="px-2.5 py-1.5 text-left font-medium">
                                                        Data
                                                    </th>
                                                    <th className="px-2.5 py-1.5 text-left font-medium">
                                                        Dia
                                                    </th>
                                                    <th className="px-2.5 py-1.5 text-left font-medium">
                                                        Unidade
                                                    </th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">
                                                        Frete
                                                    </th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">
                                                        Cargas
                                                    </th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">
                                                        Aves
                                                    </th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">
                                                        Veículos
                                                    </th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">
                                                        KM rodado
                                                    </th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">
                                                        Frete 3º
                                                    </th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">
                                                        Viagens 3º
                                                    </th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">
                                                        Aves 3º
                                                    </th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">
                                                        Frete Líq.
                                                    </th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">
                                                        Cargas Líq.
                                                    </th>
                                                    <th className="px-2.5 py-1.5 text-right font-medium">
                                                        Aves Líq.
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredDailyEntries.map(
                                                    (entry) => (
                                                        <tr
                                                            key={entry.id}
                                                            className={`border-t transition-colors hover:bg-muted/20 ${
                                                                entryHasAttention(
                                                                    entry,
                                                                )
                                                                    ? 'bg-amber-50/40'
                                                                    : 'odd:bg-muted/10'
                                                            }`}
                                                        >
                                                            <td className="px-2.5 py-1.5">
                                                                {formatDateBR(
                                                                    entry.data,
                                                                )}
                                                            </td>
                                                            <td className="px-2.5 py-1.5 capitalize">
                                                                {entry.dia_semana ??
                                                                    '-'}
                                                            </td>
                                                            <td className="px-2.5 py-1.5">
                                                                {entry.unidade
                                                                    ?.nome ??
                                                                    '-'}
                                                            </td>
                                                            <td className="px-2.5 py-1.5 text-right">
                                                                {formatCurrencyBR(
                                                                    entry.frete_total,
                                                                )}
                                                            </td>
                                                            <td className="px-2.5 py-1.5 text-right">
                                                                {formatIntegerBR(
                                                                    entry.cargas,
                                                                )}
                                                            </td>
                                                            <td className="px-2.5 py-1.5 text-right">
                                                                {formatIntegerBR(
                                                                    entry.aves,
                                                                )}
                                                            </td>
                                                            <td className="px-2.5 py-1.5 text-right">
                                                                {formatIntegerBR(
                                                                    entry.veiculos,
                                                                )}
                                                            </td>
                                                            <td className="px-2.5 py-1.5 text-right">
                                                                {formatIntegerBR(
                                                                    entry.km_rodado,
                                                                )}
                                                            </td>
                                                            <td className="px-2.5 py-1.5 text-right">
                                                                {formatCurrencyBR(
                                                                    entry.frete_terceiros,
                                                                )}
                                                            </td>
                                                            <td className="px-2.5 py-1.5 text-right">
                                                                {formatIntegerBR(
                                                                    entry.viagens_terceiros,
                                                                )}
                                                            </td>
                                                            <td className="px-2.5 py-1.5 text-right">
                                                                {formatIntegerBR(
                                                                    entry.aves_terceiros,
                                                                )}
                                                            </td>
                                                            <td className="px-2.5 py-1.5 text-right">
                                                                {formatCurrencyBR(
                                                                    entry.frete_liquido,
                                                                )}
                                                            </td>
                                                            <td className="px-2.5 py-1.5 text-right">
                                                                {formatIntegerBR(
                                                                    entry.cargas_liq,
                                                                )}
                                                            </td>
                                                            <td className="px-2.5 py-1.5 text-right">
                                                                {formatIntegerBR(
                                                                    entry.aves_liq,
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                            <tfoot className="border-t bg-muted/50 font-semibold">
                                                <tr>
                                                    <td className="px-2.5 py-1.5">
                                                        Subtotal
                                                    </td>
                                                    <td className="px-2.5 py-1.5" />
                                                    <td className="px-2.5 py-1.5 text-right">
                                                        {formatIntegerBR(
                                                            filteredDailyEntries.length,
                                                        )}{' '}
                                                        linha(s)
                                                    </td>
                                                    <td className="px-2.5 py-1.5 text-right">
                                                        {formatCurrencyBR(
                                                            filteredDailyTotals.frete,
                                                        )}
                                                    </td>
                                                    <td className="px-2.5 py-1.5 text-right">
                                                        {formatIntegerBR(
                                                            filteredDailyTotals.cargas,
                                                        )}
                                                    </td>
                                                    <td className="px-2.5 py-1.5 text-right">
                                                        {formatIntegerBR(
                                                            filteredDailyTotals.aves,
                                                        )}
                                                    </td>
                                                    <td className="px-2.5 py-1.5 text-right">
                                                        {formatIntegerBR(
                                                            filteredDailyTotals.veiculos,
                                                        )}
                                                    </td>
                                                    <td className="px-2.5 py-1.5 text-right">
                                                        {formatIntegerBR(
                                                            filteredDailyTotals.km,
                                                        )}
                                                    </td>
                                                    <td className="px-2.5 py-1.5 text-right">
                                                        {formatCurrencyBR(
                                                            filteredDailyTotals.terceiros,
                                                        )}
                                                    </td>
                                                    <td className="px-2.5 py-1.5 text-right">
                                                        {formatIntegerBR(
                                                            filteredDailyTotals.viagensTerceiros,
                                                        )}
                                                    </td>
                                                    <td className="px-2.5 py-1.5 text-right">
                                                        {formatIntegerBR(
                                                            filteredDailyTotals.avesTerceiros,
                                                        )}
                                                    </td>
                                                    <td className="px-2.5 py-1.5 text-right">
                                                        {formatCurrencyBR(
                                                            filteredDailyTotals.liquido,
                                                        )}
                                                    </td>
                                                    <td className="px-2.5 py-1.5 text-right">
                                                        {formatIntegerBR(
                                                            filteredDailyTotals.cargasLiquidas,
                                                        )}
                                                    </td>
                                                    <td className="px-2.5 py-1.5 text-right">
                                                        {formatIntegerBR(
                                                            filteredDailyTotals.avesLiquidas,
                                                        )}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}

                                {entriesPage < entriesLastPage ? (
                                    <div className="mt-3 flex justify-center">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                void loadDashboard(
                                                    entriesPage + 1,
                                                )
                                            }
                                            disabled={loading}
                                        >
                                            Carregar mais lançamentos
                                        </Button>
                                    </div>
                                ) : null}
                            </CardContent>
                        </Card>
                            </>
                        )}
                    </>
                ) : null}
            </div>
        </AdminLayout>
    );
}
