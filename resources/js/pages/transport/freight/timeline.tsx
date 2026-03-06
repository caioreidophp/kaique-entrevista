import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiGet } from '@/lib/api-client';
import type {
    FreightEntry,
    FreightTimelineResponse,
    FreightUnit,
} from '@/types/freight';

interface WrappedResponse<T> {
    data: T;
}

interface FreightEntryPaginatedResponse {
    data: FreightEntry[];
}

const palette = [
    '#2563eb',
    '#16a34a',
    '#ea580c',
    '#9333ea',
    '#0891b2',
    '#dc2626',
];

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
}

function formatNumber(value: number): string {
    return new Intl.NumberFormat('pt-BR').format(value);
}

function formatDate(value: string | null | undefined): string {
    if (!value) return '-';
    const onlyDate = /^\d{4}-\d{2}-\d{2}/.exec(value)?.[0];
    if (onlyDate) return onlyDate;
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toISOString().slice(0, 10);
}

export default function TransportFreightTimelinePage() {
    const now = new Date();
    const [startDate, setStartDate] = useState(
        new Date(now.getFullYear(), now.getMonth(), 1)
            .toISOString()
            .slice(0, 10),
    );
    const [endDate, setEndDate] = useState(
        new Date(now.getFullYear(), now.getMonth() + 1, 0)
            .toISOString()
            .slice(0, 10),
    );

    const [unidades, setUnidades] = useState<FreightUnit[]>([]);
    const [selectedUnidades, setSelectedUnidades] = useState<number[]>([]);
    const [timeline, setTimeline] = useState<FreightTimelineResponse | null>(
        null,
    );
    const [dailyEntries, setDailyEntries] = useState<FreightEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiGet<WrappedResponse<FreightUnit[]>>('/registry/unidades')
            .then((response) => {
                setUnidades(response.data);
                setSelectedUnidades(response.data.map((item) => item.id));
            })
            .catch(() => setError('Não foi possível carregar as unidades.'));
    }, []);

    async function loadTimeline(): Promise<void> {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
            start_date: startDate,
            end_date: endDate,
        });

        selectedUnidades.forEach((id) =>
            params.append('unidade_ids[]', String(id)),
        );

        const entriesParams = new URLSearchParams({
            start_date: startDate,
            end_date: endDate,
            per_page: '500',
        });

        try {
            const [timelineResponse, entriesResponse] = await Promise.all([
                apiGet<FreightTimelineResponse>(
                    `/freight/timeline?${params.toString()}`,
                ),
                apiGet<FreightEntryPaginatedResponse>(
                    `/freight/entries?${entriesParams.toString()}`,
                ),
            ]);
            setTimeline(timelineResponse);
            const filtered =
                selectedUnidades.length > 0
                    ? entriesResponse.data.filter((e) =>
                          selectedUnidades.includes(e.unidade_id),
                      )
                    : entriesResponse.data;
            setDailyEntries(
                [...filtered].sort(
                    (a, b) =>
                        a.data.localeCompare(b.data) ||
                        a.unidade_id - b.unidade_id,
                ),
            );
        } catch {
            setError('Não foi possível carregar a linha do tempo de fretes.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (selectedUnidades.length > 0) {
            void loadTimeline();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate, selectedUnidades.join(',')]);

    const allPoints = useMemo(
        () => timeline?.series.flatMap((series) => series.points) ?? [],
        [timeline],
    );
    const maxValue = useMemo(
        () => Math.max(1, ...allPoints.map((point) => point.frete_total)),
        [allPoints],
    );

    const uniqueDates = useMemo(() => {
        const set = new Set<string>();
        allPoints.forEach((point) => set.add(point.data));
        return Array.from(set).sort();
    }, [allPoints]);

    function xForDate(date: string): number {
        const index = uniqueDates.indexOf(date);
        if (index < 0 || uniqueDates.length <= 1) return 0;
        return (index / (uniqueDates.length - 1)) * 100;
    }

    function yForValue(value: number): number {
        return 100 - (value / maxValue) * 100;
    }

    function toggleUnidade(id: number): void {
        setSelectedUnidades((previous) => {
            if (previous.includes(id))
                return previous.filter((item) => item !== id);
            return [...previous, id];
        });
    }

    return (
        <AdminLayout
            title="Gestão de Fretes - Linha do Tempo"
            active="freight-timeline"
            module="freight"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">
                        Linha do Tempo de Fretes
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Comparativo diário por unidade com período filtrável.
                    </p>
                </div>

                {error ? (
                    <Notification message={error} variant="error" />
                ) : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div>
                                <p className="mb-2 text-sm text-muted-foreground">
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
                            <div>
                                <p className="mb-2 text-sm text-muted-foreground">
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
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {unidades.map((unidade, index) => {
                                const active = selectedUnidades.includes(
                                    unidade.id,
                                );
                                return (
                                    <Button
                                        key={unidade.id}
                                        type="button"
                                        variant={active ? 'default' : 'outline'}
                                        onClick={() =>
                                            toggleUnidade(unidade.id)
                                        }
                                        className="gap-2"
                                    >
                                        <span
                                            className="inline-block size-2 rounded-full"
                                            style={{
                                                backgroundColor:
                                                    palette[
                                                        index % palette.length
                                                    ],
                                            }}
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
                        <CardTitle>Frete total por dia</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando linha do tempo...
                            </div>
                        ) : !timeline ||
                          timeline.series.length === 0 ||
                          uniqueDates.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Sem dados para o período selecionado.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {/* chart */}
                                <div className="h-[260px] w-full rounded-md border bg-muted/10 p-3">
                                    <svg
                                        viewBox="0 0 100 100"
                                        preserveAspectRatio="none"
                                        className="h-full w-full"
                                    >
                                        {timeline.series.map(
                                            (series, index) => {
                                                const color =
                                                    palette[
                                                        index % palette.length
                                                    ];
                                                const points = series.points
                                                    .map(
                                                        (point) =>
                                                            `${xForDate(point.data)},${yForValue(point.frete_total)}`,
                                                    )
                                                    .join(' ');

                                                if (!points) return null;

                                                return (
                                                    <polyline
                                                        key={series.unidade_id}
                                                        fill="none"
                                                        stroke={color}
                                                        strokeWidth="1.2"
                                                        points={points}
                                                    />
                                                );
                                            },
                                        )}
                                    </svg>
                                </div>

                                {/* legend */}
                                <div className="flex flex-wrap gap-3">
                                    {timeline.series.map((series, index) => {
                                        const color =
                                            palette[index % palette.length];
                                        const total = series.points.reduce(
                                            (sum, point) =>
                                                sum + point.frete_total,
                                            0,
                                        );
                                        return (
                                            <div
                                                key={series.unidade_id}
                                                className="flex items-center gap-2 text-sm"
                                            >
                                                <span
                                                    className="inline-block size-2.5 shrink-0 rounded-full"
                                                    style={{
                                                        backgroundColor: color,
                                                    }}
                                                />
                                                <span className="font-medium">
                                                    {series.unidade_nome ??
                                                        'Sem unidade'}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    — {formatCurrency(total)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* daily table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Lançamentos diários</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando tabela...
                            </div>
                        ) : dailyEntries.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Sem lançamentos no período selecionado.
                            </p>
                        ) : (
                            <div className="overflow-x-auto rounded-md border">
                                <table className="w-full text-xs whitespace-nowrap tabular-nums">
                                    <thead className="bg-muted/40 text-muted-foreground">
                                        <tr>
                                            <th className="px-2.5 py-2 text-left font-medium">
                                                Data
                                            </th>
                                            <th className="px-2.5 py-2 text-left font-medium">
                                                Unidade
                                            </th>
                                            <th className="px-2.5 py-2 text-right font-medium">
                                                Frete
                                            </th>
                                            <th className="px-2.5 py-2 text-right font-medium">
                                                Cargas
                                            </th>
                                            <th className="px-2.5 py-2 text-right font-medium">
                                                Aves
                                            </th>
                                            <th className="px-2.5 py-2 text-right font-medium">
                                                Veículos
                                            </th>
                                            <th className="px-2.5 py-2 text-right font-medium">
                                                Km Rodado
                                            </th>
                                            <th className="px-2.5 py-2 text-right font-medium">
                                                Frete 3º
                                            </th>
                                            <th className="px-2.5 py-2 text-right font-medium">
                                                Viagens
                                            </th>
                                            <th className="px-2.5 py-2 text-right font-medium">
                                                Aves 3º
                                            </th>
                                            <th className="px-2.5 py-2 text-right font-medium">
                                                Frete Líq.
                                            </th>
                                            <th className="px-2.5 py-2 text-right font-medium">
                                                Cargas Líq.
                                            </th>
                                            <th className="px-2.5 py-2 text-right font-medium">
                                                Aves Líq.
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dailyEntries.map((entry) => (
                                            <tr
                                                key={entry.id}
                                                className="border-t transition-colors hover:bg-muted/20"
                                            >
                                                <td className="px-2.5 py-1.5 font-medium">
                                                    {formatDate(entry.data)}
                                                </td>
                                                <td className="px-2.5 py-1.5">
                                                    {entry.unidade?.nome ?? '-'}
                                                </td>
                                                <td className="px-2.5 py-1.5 text-right">
                                                    {formatCurrency(
                                                        Number(
                                                            entry.frete_total,
                                                        ),
                                                    )}
                                                </td>
                                                <td className="px-2.5 py-1.5 text-right">
                                                    {formatNumber(entry.cargas)}
                                                </td>
                                                <td className="px-2.5 py-1.5 text-right">
                                                    {formatNumber(entry.aves)}
                                                </td>
                                                <td className="px-2.5 py-1.5 text-right">
                                                    {formatNumber(
                                                        entry.veiculos,
                                                    )}
                                                </td>
                                                <td className="px-2.5 py-1.5 text-right">
                                                    {formatNumber(
                                                        Number(entry.km_rodado),
                                                    )}
                                                </td>
                                                <td className="px-2.5 py-1.5 text-right">
                                                    {formatCurrency(
                                                        Number(
                                                            entry.frete_terceiros,
                                                        ),
                                                    )}
                                                </td>
                                                <td className="px-2.5 py-1.5 text-right">
                                                    {formatNumber(
                                                        entry.viagens_terceiros,
                                                    )}
                                                </td>
                                                <td className="px-2.5 py-1.5 text-right">
                                                    {formatNumber(
                                                        entry.aves_terceiros,
                                                    )}
                                                </td>
                                                <td className="px-2.5 py-1.5 text-right font-medium">
                                                    {formatCurrency(
                                                        Number(
                                                            entry.frete_liquido,
                                                        ),
                                                    )}
                                                </td>
                                                <td className="px-2.5 py-1.5 text-right">
                                                    {formatNumber(
                                                        entry.cargas_liq,
                                                    )}
                                                </td>
                                                <td className="px-2.5 py-1.5 text-right">
                                                    {formatNumber(
                                                        entry.aves_liq,
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
