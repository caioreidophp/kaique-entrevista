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
import { formatCurrencyBR, formatDateBR, formatDecimalBR, formatIntegerBR, formatPercentBR } from '@/lib/transport-format';
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

    function applyDatePreset(days: 7 | 30 | 90): void {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days + 1);

        const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

        setStartDate(toIsoDate(start));
        setEndDate(toIsoDate(end));
    }

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
                setDailyEntries((previous) => [...previous, ...response.entries.data]);
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

    const kpis = data?.kpis;

    const kpiMain = [
        { title: 'Lançamentos no período', value: formatIntegerBR(kpis?.total_lancamentos ?? 0) },
        { title: 'Total frete', value: formatCurrencyBR(kpis?.total_frete ?? 0) },
        {
            title: 'Frete líquido',
            value: formatCurrencyBR(kpis?.total_frete_liquido ?? 0),
        },
        { title: 'KM rodado', value: formatIntegerBR(kpis?.total_km ?? 0) },
        {
            title: 'Aves transportadas',
            value: formatIntegerBR(kpis?.total_aves ?? 0),
        },
        {
            title: 'Dias trabalhados',
            value: formatIntegerBR(kpis?.dias_trabalhados ?? 0),
        },
    ];

    const kpiDerived = [
        {
            title: 'Frete/KM',
            value: formatCurrencyBR(kpis?.frete_por_km ?? 0),
        },
        {
            title: 'Aves por carga',
            value: formatDecimalBR(kpis?.aves_por_carga ?? 0, 2),
        },
        {
            title: 'Frete médio',
            value: formatCurrencyBR(kpis?.frete_medio ?? 0),
        },
        {
            title: 'Participação de terceiros',
            value: formatPercentBR(kpis?.participacao_terceiros ?? 0),
        },
        {
            title: 'Frete terceiros',
            value: formatCurrencyBR(kpis?.total_frete_terceiros ?? 0),
        },
        {
            title: 'Viagens terceiros',
            value: formatIntegerBR(kpis?.total_viagens_terceiros ?? 0),
        },
    ];

    const topUnit = useMemo(() => {
        if (!data || data.por_unidade.length === 0) return null;

        return [...data.por_unidade].sort((a, b) => b.total_frete_liquido - a.total_frete_liquido)[0] ?? null;
    }, [data]);

    return (
        <AdminLayout
            title="Gestão de Fretes - Dashboard"
            active="freight-dashboard"
            module="freight"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">
                        Dashboard de Fretes
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Visão consolidada do período com indicadores de
                        desempenho por unidade.
                    </p>
                </div>

                {error ? (
                    <Notification message={error} variant="error" />
                ) : null}

                <Card>
                    <CardHeader className="px-4 pt-3 pb-1">
                        <CardTitle className="text-sm">Competência</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 px-4 pb-3">
                        <div className="grid gap-2 md:grid-cols-2">
                            <div>
                                <p className="mb-2 text-sm text-muted-foreground">
                                    Mês
                                </p>
                                <Select value={month} onValueChange={setMonth}>
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
                            </div>
                            <div>
                                <p className="mb-2 text-sm text-muted-foreground">
                                    Ano
                                </p>
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

                        <div className="grid gap-2 md:grid-cols-3">
                            <div>
                                <p className="mb-2 text-sm text-muted-foreground">Unidade</p>
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
                            <div>
                                <p className="mb-2 text-sm text-muted-foreground">Data inicial (opcional)</p>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(event) => setStartDate(event.target.value)}
                                />
                            </div>
                            <div>
                                <p className="mb-2 text-sm text-muted-foreground">Data final (opcional)</p>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(event) => setEndDate(event.target.value)}
                                />
                            </div>
                            <div className="flex items-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => applyDatePreset(7)}
                                >
                                    7 dias
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => applyDatePreset(30)}
                                >
                                    30 dias
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => applyDatePreset(90)}
                                >
                                    90 dias
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setSelectedUnitId('all')}
                                >
                                    Todas unidades
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedUnitId('all');
                                        setStartDate('');
                                        setEndDate('');
                                    }}
                                >
                                    Limpar período
                                </Button>
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Quando as duas datas são preenchidas, o intervalo personalizado substitui o filtro de competência.
                        </p>
                    </CardContent>
                </Card>

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando dashboard...
                    </div>
                ) : data ? (
                    <>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                            {kpiMain.map((item, index) => (
                                <Card key={item.title} className="transport-kpi-card">
                                    <CardHeader className="flex flex-row items-center justify-between px-3 pt-2 pb-0.5">
                                        <CardTitle className="transport-kpi-title text-[11px] leading-tight">
                                            {item.title}
                                        </CardTitle>
                                        <span className="transport-kpi-icon">
                                            {(index === 0 || index === 5) ? (
                                                <CalendarDays className="size-3.5" />
                                            ) : (
                                                <Table2 className="size-3.5" />
                                            )}
                                        </span>
                                    </CardHeader>
                                    <CardContent className="px-3 pb-2">
                                        <p className="text-base font-semibold tracking-tight text-foreground">
                                            {item.value}
                                        </p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {kpiDerived.map((item, index) => (
                                <Card key={item.title} className={`transport-kpi-card ${index === 3 ? 'transport-kpi-soft-info' : ''}`}>
                                    <CardHeader className="flex flex-row items-center justify-between px-3 pt-2 pb-0.5">
                                        <CardTitle className="transport-kpi-title text-[11px] leading-tight">
                                            {item.title}
                                        </CardTitle>
                                        <span className="transport-kpi-icon">
                                            <Table2 className="size-3.5" />
                                        </span>
                                    </CardHeader>
                                    <CardContent className="px-3 pb-2">
                                        <p className="text-base font-semibold tracking-tight text-foreground">
                                            {item.value}
                                        </p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Destaques rápidos</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-md border p-3">
                                    <p className="text-xs text-muted-foreground">Unidade líder (frete líquido)</p>
                                    <p className="mt-1 text-base font-semibold">{topUnit?.unidade_nome ?? '-'}</p>
                                </div>
                                <div className="rounded-md border p-3">
                                    <p className="text-xs text-muted-foreground">Dias trabalhados no período</p>
                                    <p className="mt-1 text-base font-semibold">{formatIntegerBR(kpis?.dias_trabalhados ?? 0)}</p>
                                </div>
                                <div className="rounded-md border p-3">
                                    <p className="text-xs text-muted-foreground">Média diária de frete líquido</p>
                                    <p className="mt-1 text-base font-semibold">
                                        {formatCurrencyBR(
                                            (kpis?.dias_trabalhados ?? 0) > 0
                                                ? (kpis?.total_frete_liquido ?? 0) / (kpis?.dias_trabalhados ?? 1)
                                                : 0,
                                        )}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

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
                                            <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
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
                                            <div className="grid grid-cols-2 gap-1.5 text-sm sm:grid-cols-4 xl:grid-cols-8">
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
                                                    {
                                                        label: 'Frete líquido',
                                                        value: formatCurrencyBR(
                                                            item.total_frete_liquido,
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
                                    Tabela diária de fretes ({formatIntegerBR(entriesTotal)})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {dailyEntriesSorted.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        Sem lançamentos diários para a
                                        competência selecionada.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto rounded-md border">
                                        <table className="w-full min-w-[1200px] text-xs tabular-nums">
                                            <thead className="bg-muted/40 text-muted-foreground">
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
                                                {dailyEntriesSorted.map(
                                                    (entry) => (
                                                        <tr
                                                            key={entry.id}
                                                            className="border-t transition-colors hover:bg-muted/20"
                                                        >
                                                            <td className="px-2.5 py-1.5">
                                                                {formatDateBR(
                                                                    entry.data,
                                                                )}
                                                            </td>
                                                            <td className="px-2.5 py-1.5 capitalize">
                                                                {entry.dia_semana ?? '-'}
                                                            </td>
                                                            <td className="px-2.5 py-1.5">
                                                                {entry.unidade
                                                                    ?.nome ??
                                                                    '-'}
                                                            </td>
                                                            <td className="px-2.5 py-1.5 text-right">
                                                                {formatCurrencyBR(entry.frete_total)}
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
                                                                {formatIntegerBR(entry.km_rodado)}
                                                            </td>
                                                            <td className="px-2.5 py-1.5 text-right">
                                                                {formatCurrencyBR(entry.frete_terceiros)}
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
                                                                {formatCurrencyBR(entry.frete_liquido)}
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
