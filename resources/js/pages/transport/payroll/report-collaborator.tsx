import { AlertCircle, LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/api-client';
import { formatCurrencyBR, formatDateBR } from '@/lib/transport-format';
import { compareTextPtBr, includesTextPtBr } from '@/lib/transport-text';

interface Colaborador {
    id: number;
    nome: string;
}

interface ReportResponse {
    colaborador: {
        id: number;
        nome: string;
        unidade?: { nome: string };
        funcao?: { nome: string };
    };
    timeline: Array<{
        competencia_mes: number;
        competencia_ano: number;
        competencia_label: string;
        total_pagamentos: number;
        total_pensoes: number;
        total_descontos: number;
        total_valor: number;
        total_lancamentos: number;
        lancado_em: string | null;
    }>;
    resumo_mensal?: Array<{
        competencia_mes: number;
        competencia_ano: number;
        competencia_label: string;
        total_valor: number;
        total_lancamentos: number;
        total_pagamentos: number;
        total_pensoes: number;
        total_descontos: number;
        lancado_em: string | null;
    }>;
    total_acumulado: number;
    total_pensoes: number;
    total_descontos: number;
    media_salarial: number;
    variacao_percentual: Array<{
        competencia_mes: number;
        competencia_ano: number;
        variacao_percentual: number | null;
    }>;
    datas_importantes: {
        data_admissao: string | null;
        data_demissao: string | null;
        data_nascimento: string | null;
    };
}

interface PaginatedResponse<T> {
    data: T[];
}

export default function TransportPayrollReportCollaboratorPage() {
    const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [collaboratorQuery, setCollaboratorQuery] = useState('');
    const [collaboratorOptionsOpen, setCollaboratorOptionsOpen] =
        useState(false);
    const [highlightedCollaboratorIndex, setHighlightedCollaboratorIndex] =
        useState<number>(-1);
    const [report, setReport] = useState<ReportResponse | null>(null);
    const currentYear = new Date().getFullYear();
    const [competenciaInicial, setCompetenciaInicial] = useState(`${currentYear}-01`);
    const [competenciaFinal, setCompetenciaFinal] = useState(`${currentYear}-12`);
    const [loadingCollaborators, setLoadingCollaborators] = useState(true);
    const [loadingReport, setLoadingReport] = useState(false);
    const [hoveredPoint, setHoveredPoint] = useState<{
        xPercent: number;
        yPercent: number;
        label: string;
    } | null>(null);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);
    const collaboratorInputRef = useRef<HTMLInputElement | null>(null);
    function applyRangePreset(days: 7 | 30 | 90): void {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days + 1);

        const toMonth = (value: Date): string => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;

        setCompetenciaInicial(toMonth(start));
        setCompetenciaFinal(toMonth(end));
    }

    const sortedCollaborators = useMemo(() => {
        return [...colaboradores].sort((first, second) => {
            const comparison = compareTextPtBr(first.nome, second.nome);

            if (comparison !== 0) {
                return comparison;
            }

            return first.id - second.id;
        });
    }, [colaboradores]);

    const filteredCollaborators = useMemo(() => {
        const term = collaboratorQuery.trim();

        if (!term) {
            return sortedCollaborators;
        }

        return sortedCollaborators.filter((item) => includesTextPtBr(item.nome, term));
    }, [collaboratorQuery, sortedCollaborators]);

    function openCollaboratorOptions(): void {
        setCollaboratorOptionsOpen(true);
        setHighlightedCollaboratorIndex(
            filteredCollaborators.length > 0 ? 0 : -1,
        );
    }

    function selectCollaborator(item: Colaborador): void {
        setSelectedId(String(item.id));
        setCollaboratorQuery(item.nome);
        setCollaboratorOptionsOpen(false);
        setHighlightedCollaboratorIndex(-1);
        collaboratorInputRef.current?.focus();
    }

    useEffect(() => {
        if (!collaboratorOptionsOpen) {
            return;
        }

        if (filteredCollaborators.length === 0) {
            if (highlightedCollaboratorIndex !== -1) {
                setHighlightedCollaboratorIndex(-1);
            }
            return;
        }

        if (
            highlightedCollaboratorIndex < 0 ||
            highlightedCollaboratorIndex >= filteredCollaborators.length
        ) {
            setHighlightedCollaboratorIndex(0);
        }
    }, [
        collaboratorOptionsOpen,
        filteredCollaborators.length,
        highlightedCollaboratorIndex,
    ]);

    const monthlySeries = useMemo(
        () => report?.resumo_mensal ?? [],
        [report?.resumo_mensal],
    );

    const monthlyChart = useMemo(() => {
        if (monthlySeries.length === 0) return null;

        const width = Math.max(560, monthlySeries.length * 56);
        const height = 190;
        const paddingX = 28;
        const paddingY = 20;
        const maxValue = Math.max(...monthlySeries.map((item) => item.total_valor), 1);
        const minValue = 0;
        const safeRange = Math.max(maxValue - minValue, 1);

        const points = monthlySeries.map((item, index) => {
            const x =
                monthlySeries.length === 1
                    ? width / 2
                    : paddingX + (index * (width - paddingX * 2)) / (monthlySeries.length - 1);
            const y =
                paddingY +
                (1 - (item.total_valor - minValue) / safeRange) *
                    (height - paddingY * 2);

            return { ...item, x, y };
        });

        const path = points
            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
            .join(' ');

        return { width, height, points, path };
    }, [monthlySeries]);

    const loadCollaborators = useCallback(async (): Promise<void> => {
        setLoadingCollaborators(true);
        try {
            const response = await apiGet<PaginatedResponse<Colaborador>>(
                '/registry/colaboradores?active=1&per_page=100',
            );
            setColaboradores(response.data);
        } catch {
            setNotification({
                message: 'Não foi possível carregar colaboradores.',
                variant: 'error',
            });
        } finally {
            setLoadingCollaborators(false);
        }
    }, []);

    const loadReport = useCallback(async (id: string): Promise<void> => {
        if (!id) return;
        setLoadingReport(true);
        setNotification(null);

        try {
            const params = new URLSearchParams();
            params.set('colaborador_id', id);
            params.set('competencia_inicial', competenciaInicial);
            params.set('competencia_final', competenciaFinal);

            const response = await apiGet<ReportResponse>(
                `/payroll/reports/colaborador?${params.toString()}`,
            );
            setReport(response);
        } catch {
            setNotification({
                message:
                    'Não foi possível carregar o relatório do colaborador.',
                variant: 'error',
            });
        } finally {
            setLoadingReport(false);
        }
    }, [competenciaFinal, competenciaInicial]);

    useEffect(() => {
        setSelectedId('');
        setCollaboratorQuery('');
        setReport(null);
        void loadCollaborators();
    }, [loadCollaborators]);

    useEffect(() => {
        if (selectedId) {
            void loadReport(selectedId);
        }
    }, [loadReport, selectedId]);

    return (
        <AdminLayout
            title="Pagamentos - Relatório por Colaborador"
            active="payroll-report-collaborator"
            module="payroll"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">
                        Relatório por Colaborador
                    </h2>
                    <p className="text-sm text-muted-foreground">
                    Histórico mensal consolidado com salário, pensão e descontos.
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
                        <CardTitle>Selecionar colaborador</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-[2fr_auto]">
                            <div className="space-y-2">
                                <Label>Colaborador</Label>
                                <div className="relative">
                                    <Input
                                        ref={collaboratorInputRef}
                                        value={collaboratorQuery}
                                        autoComplete="off"
                                        onFocus={openCollaboratorOptions}
                                        onBlur={() => {
                                            window.setTimeout(() => {
                                                setCollaboratorOptionsOpen(
                                                    false,
                                                );
                                                setHighlightedCollaboratorIndex(
                                                    -1,
                                                );
                                            }, 120);
                                        }}
                                        onChange={(event) => {
                                            setSelectedId('');
                                            setReport(null);
                                            setCollaboratorQuery(
                                                event.target.value,
                                            );
                                            openCollaboratorOptions();
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Escape') {
                                                setCollaboratorOptionsOpen(
                                                    false,
                                                );
                                                setHighlightedCollaboratorIndex(
                                                    -1,
                                                );
                                                return;
                                            }

                                            if (
                                                event.key !== 'ArrowDown' &&
                                                event.key !== 'ArrowUp' &&
                                                event.key !== 'Enter'
                                            ) {
                                                return;
                                            }

                                            if (!collaboratorOptionsOpen) {
                                                openCollaboratorOptions();
                                            }

                                            if (
                                                filteredCollaborators.length ===
                                                0
                                            ) {
                                                return;
                                            }

                                            if (event.key === 'ArrowDown') {
                                                event.preventDefault();
                                                setHighlightedCollaboratorIndex(
                                                    (previous) =>
                                                        Math.min(
                                                            filteredCollaborators.length -
                                                                1,
                                                            previous < 0
                                                                ? 0
                                                                : previous + 1,
                                                        ),
                                                );
                                                return;
                                            }

                                            if (event.key === 'ArrowUp') {
                                                event.preventDefault();
                                                setHighlightedCollaboratorIndex(
                                                    (previous) =>
                                                        Math.max(
                                                            0,
                                                            previous < 0
                                                                ? 0
                                                                : previous - 1,
                                                        ),
                                                );
                                                return;
                                            }

                                            if (
                                                event.key === 'Enter' &&
                                                highlightedCollaboratorIndex >=
                                                    0
                                            ) {
                                                event.preventDefault();
                                                const option =
                                                    filteredCollaborators[
                                                        highlightedCollaboratorIndex
                                                    ];

                                                if (option) {
                                                    selectCollaborator(option);
                                                }
                                            }
                                        }}
                                        placeholder="Digite para buscar colaborador"
                                    />

                                    {collaboratorOptionsOpen ? (
                                        <div className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border shadow-md">
                                            {filteredCollaborators.length === 0 ? (
                                                <p className="px-3 py-2 text-sm text-muted-foreground">
                                                    Nenhum colaborador encontrado.
                                                </p>
                                            ) : (
                                                filteredCollaborators.map(
                                                    (item, index) => (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            className={`w-full px-3 py-2 text-left text-sm ${
                                                                highlightedCollaboratorIndex ===
                                                                index
                                                                    ? 'bg-muted'
                                                                    : 'hover:bg-muted'
                                                            }`}
                                                            onMouseEnter={() =>
                                                                setHighlightedCollaboratorIndex(
                                                                    index,
                                                                )
                                                            }
                                                            onMouseDown={(
                                                                event,
                                                            ) => {
                                                                event.preventDefault();
                                                                selectCollaborator(
                                                                    item,
                                                                );
                                                            }}
                                                        >
                                                            {item.nome}
                                                        </button>
                                                    ),
                                                )
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Lista em ordem alfabética. Digite parte do
                                    nome e clique no colaborador desejado.
                                </p>
                            </div>
                            <div className="flex items-end">
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        disabled={!selectedId}
                                        onClick={() => void loadReport(selectedId)}
                                    >
                                        Atualizar
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setCompetenciaInicial(`${currentYear}-01`);
                                            setCompetenciaFinal(`${currentYear}-12`);
                                            if (selectedId) {
                                                void loadReport(selectedId);
                                            }
                                        }}
                                    >
                                        Limpar filtros
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="competencia-inicial">Mês inicial</Label>
                                <Input
                                    id="competencia-inicial"
                                    type="month"
                                    value={competenciaInicial}
                                    onChange={(event) => setCompetenciaInicial(event.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="competencia-final">Mês final</Label>
                                <Input
                                    id="competencia-final"
                                    type="month"
                                    value={competenciaFinal}
                                    onChange={(event) => setCompetenciaFinal(event.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Período</Label>
                                <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                                    {competenciaInicial} até {competenciaFinal}
                                </p>
                            </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                            <Button type="button" variant="outline" onClick={() => applyRangePreset(7)}>7 dias</Button>
                            <Button type="button" variant="outline" onClick={() => applyRangePreset(30)}>30 dias</Button>
                            <Button type="button" variant="outline" onClick={() => applyRangePreset(90)}>90 dias</Button>
                        </div>
                    </CardContent>
                </Card>

                {loadingCollaborators || (loadingReport && !report) ? (
                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <Card key={`report-skeleton-kpi-${index}`}>
                                    <CardHeader>
                                        <Skeleton className="h-4 w-2/3" />
                                    </CardHeader>
                                    <CardContent>
                                        <Skeleton className="h-8 w-1/2" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        <Card>
                            <CardContent className="space-y-3 pt-6">
                                <Skeleton className="h-5 w-48" />
                                <Skeleton className="h-40 w-full" />
                            </CardContent>
                        </Card>
                    </div>
                ) : report ? (
                    <>
                        {loadingReport ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <LoaderCircle className="size-3 animate-spin" />
                                Atualizando dados...
                            </div>
                        ) : null}
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Total acumulado
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {formatCurrencyBR(report.total_acumulado)}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Total de pensões
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {formatCurrencyBR(report.total_pensoes)}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Total de descontos
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {formatCurrencyBR(report.total_descontos)}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Média consolidada por mês
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {formatCurrencyBR(report.media_salarial)}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Unidade
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg font-semibold">
                                        {report.colaborador.unidade?.nome ?? '-'}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Função
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg font-semibold">
                                        {report.colaborador.funcao?.nome ?? '-'}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Evolução mensal</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {!monthlyChart ? (
                                    <p className="text-sm text-muted-foreground">
                                        Sem dados mensais no período selecionado.
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
                                            width={monthlyChart.width}
                                            height={monthlyChart.height}
                                            viewBox={`0 0 ${monthlyChart.width} ${monthlyChart.height}`}
                                            className="min-w-full"
                                        >
                                            <path
                                                d={monthlyChart.path}
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                className="text-primary"
                                            />
                                            {monthlyChart.points.map((point) => (
                                                <g key={`${point.competencia_ano}-${point.competencia_mes}`}>
                                                    <circle
                                                        cx={point.x}
                                                        cy={point.y}
                                                        r="4"
                                                        className="fill-primary"
                                                        onMouseEnter={() =>
                                                            setHoveredPoint({
                                                                xPercent: (point.x / monthlyChart.width) * 100,
                                                                yPercent: (point.y / monthlyChart.height) * 100,
                                                                label: `${point.competencia_label} • ${formatCurrencyBR(point.total_valor)}`,
                                                            })
                                                        }
                                                        onMouseLeave={() => setHoveredPoint(null)}
                                                    >
                                                        <title>
                                                            {point.competencia_label}: {formatCurrencyBR(point.total_valor)}
                                                        </title>
                                                    </circle>
                                                    <text
                                                        x={point.x}
                                                        y={monthlyChart.height - 4}
                                                        textAnchor="middle"
                                                        fontSize="10"
                                                        className="fill-muted-foreground"
                                                    >
                                                        {point.competencia_label}
                                                    </text>
                                                </g>
                                            ))}
                                        </svg>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <div className="grid gap-4 xl:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        Linha do tempo de pagamentos
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {report.timeline.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Sem pagamentos registrados.
                                        </p>
                                    ) : (
                                        report.timeline.map((item) => {
                                            const salarioBruto = item.total_pagamentos + item.total_descontos;

                                            return (
                                                <div
                                                    key={`${item.competencia_ano}-${item.competencia_mes}`}
                                                    className="rounded-md border p-3 text-sm"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span>
                                                            {String(
                                                                item.competencia_mes,
                                                            ).padStart(2, '0')}
                                                            /
                                                            {
                                                                item.competencia_ano
                                                            }
                                                        </span>
                                                        <span className="font-semibold">
                                                            {formatCurrencyBR(item.total_valor)}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                        <span>
                                                            Lançado em:{' '}
                                                            {formatDateBR(
                                                                item.lancado_em,
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                        Salário líquido: {formatCurrencyBR(item.total_pagamentos)} | Descontos: {formatCurrencyBR(item.total_descontos)} | Salário bruto: {formatCurrencyBR(salarioBruto)}
                                                    </div>
                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                        Pensão: {formatCurrencyBR(item.total_pensoes)}
                                                    </div>
                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                        Lançamentos no mês: {item.total_lancamentos}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Datas importantes</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="rounded-md border p-3">
                                        <p className="text-xs text-muted-foreground">
                                            Data de admissão
                                        </p>
                                        <p className="font-medium">
                                            {formatDateBR(
                                                report.datas_importantes
                                                    .data_admissao,
                                            )}
                                        </p>
                                    </div>
                                    <div className="rounded-md border p-3">
                                        <p className="text-xs text-muted-foreground">
                                            Data de demissão
                                        </p>
                                        <p className="font-medium">
                                            {formatDateBR(
                                                report.datas_importantes
                                                    .data_demissao,
                                            )}
                                        </p>
                                    </div>
                                    <div className="rounded-md border p-3">
                                        <p className="text-xs text-muted-foreground">
                                            Data de nascimento
                                        </p>
                                        <p className="font-medium">
                                            {formatDateBR(
                                                report.datas_importantes
                                                    .data_nascimento,
                                            )}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center gap-2 rounded-md border border-muted-foreground/20 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                        <AlertCircle className="size-4" />
                        Digite o nome do colaborador para carregar o relatório.
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
