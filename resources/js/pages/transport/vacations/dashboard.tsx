import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError, apiGet, apiPut } from '@/lib/api-client';
import { formatIntegerBR, formatPercentBR } from '@/lib/transport-format';

interface WrappedResponse<T> {
    data: T;
}

interface VacationDashboard {
    ferias_vencidas: number;
    ferias_a_vencer: number;
    faixa_a_vencer: number;
    faixa_liberada: number;
    faixa_atencao: number;
    faixa_urgente: number;
    limite_proximos_4_meses: number;
    limite_proximos_2_meses: number;
    ferias_programadas_30_dias: number;
    lancamentos_ano_atual: number;
    total_lancamentos_abono: number;
    total_com_abono: number;
    total_sem_abono: number;
    percentual_com_abono: number;
    percentual_sem_abono: number;
    taxa_vencidas_sobre_ativos: number;
    taxa_liberadas_sobre_ativos: number;
    riscos_por_unidade: Array<{
        unidade_id: number;
        unidade_nome: string;
        total_colaboradores: number;
        vencidas: number;
        urgentes: number;
        atencao: number;
        liberadas: number;
        a_vencer: number;
        risk_score: number;
        risk_rate: number;
    }>;
    top_prioridades: Array<{
        colaborador_id: number;
        nome: string;
        funcao: string | null;
        unidade: string | null;
        unidade_id: number | null;
        status: string;
        limite: string;
        dias_para_limite: number;
    }>;
    ferias_vigentes: Array<{
        id: number;
        nome: string | null;
        funcao: string | null;
        unidade: string | null;
        unidade_id: number | null;
        tipo: 'confirmado' | 'previsao' | 'passada';
        data_inicio: string | null;
        data_fim: string | null;
        dias_restantes: number;
    }>;
    timeline: Array<{
        id: number;
        colaborador_id: number;
        nome: string | null;
        funcao: string | null;
        unidade: string | null;
        unidade_id: number | null;
        tipo: 'confirmado' | 'previsao' | 'passada';
        com_abono: boolean;
        dias_ferias: number;
        status_timeline: 'vigente' | 'agendada' | 'concluida';
        data_inicio: string | null;
        data_fim: string | null;
    }>;
}

interface VacationReports {
    start_date: string;
    end_date: string;
    ferias_gozadas: {
        total: number;
        rows: Array<{
            id: number;
            nome: string | null;
            unidade: string | null;
            tipo: 'confirmado' | 'previsao' | 'passada';
            data_inicio: string | null;
            data_fim: string | null;
            dias_ferias: number;
            com_abono: boolean;
        }>;
    };
    admissoes: {
        total: number;
        rows: Array<{
            id: number;
            nome: string | null;
            unidade: string | null;
            funcao: string | null;
            data_admissao: string | null;
        }>;
    };
    demissoes: {
        total: number;
        rows: Array<{
            id: number;
            nome: string | null;
            unidade: string | null;
            funcao: string | null;
            data_demissao: string | null;
        }>;
    };
    unidades: Array<{
        id: number;
        nome: string;
    }>;
}

interface TimelineEditDraft {
    id: number;
    colaborador_id: number;
    tipo: 'confirmado' | 'previsao' | 'passada';
    com_abono: boolean;
    dias_ferias: 20 | 30;
    data_inicio: string;
    data_fim: string;
}

function formatDate(date: string | null): string {
    if (!date) return '-';

    const [year, month, day] = date.split('-');
    if (!year || !month || !day) return date;

    return `${day}/${month}/${year}`;
}

function tipoLabel(tipo: 'confirmado' | 'previsao' | 'passada'): string {
    return tipo === 'previsao' ? 'Previsão' : tipo === 'passada' ? 'Passada' : 'Confirmado';
}

function priorityStatusLabel(status: string): string {
    if (status === 'vencida') return 'Vencida';
    if (status === 'urgente') return 'Urgente';
    if (status === 'atencao') return 'Atenção';
    if (status === 'liberada') return 'Liberada';
    return 'A vencer';
}

function priorityBadgeClass(status: string): string {
    if (status === 'vencida' || status === 'urgente') return 'transport-status-danger';
    if (status === 'atencao') return 'transport-status-warning';
    if (status === 'liberada') return 'transport-status-success';
    return 'transport-status-info';
}

function parseIsoDate(date: string): Date {
    return new Date(`${date}T12:00:00`);
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);

    return next;
}

function diffDays(start: Date, end: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;

    return Math.floor((end.getTime() - start.getTime()) / msPerDay);
}

function formatAxisDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');

    return `${day}/${month}`;
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleDeg: number): { x: number; y: number } {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;

    return {
        x: centerX + radius * Math.cos(angleRad),
        y: centerY + radius * Math.sin(angleRad),
    };
}

interface AbonoDonutSlice {
    label: string;
    total: number;
    percentual: number;
    color: string;
    path: string;
}

function donutPath(
    centerX: number,
    centerY: number,
    outerRadius: number,
    innerRadius: number,
    startAngle: number,
    endAngle: number,
): string {
    const angleDelta = Math.abs(endAngle - startAngle);

    if (angleDelta <= 0) {
        return '';
    }

    if (angleDelta >= 359.999) {
        return [
            `M ${centerX} ${centerY - outerRadius}`,
            `A ${outerRadius} ${outerRadius} 0 1 1 ${centerX} ${centerY + outerRadius}`,
            `A ${outerRadius} ${outerRadius} 0 1 1 ${centerX} ${centerY - outerRadius}`,
            `L ${centerX} ${centerY - innerRadius}`,
            `A ${innerRadius} ${innerRadius} 0 1 0 ${centerX} ${centerY + innerRadius}`,
            `A ${innerRadius} ${innerRadius} 0 1 0 ${centerX} ${centerY - innerRadius}`,
            'Z',
        ].join(' ');
    }

    const outerStart = polarToCartesian(centerX, centerY, outerRadius, endAngle);
    const outerEnd = polarToCartesian(centerX, centerY, outerRadius, startAngle);
    const innerStart = polarToCartesian(centerX, centerY, innerRadius, endAngle);
    const innerEnd = polarToCartesian(centerX, centerY, innerRadius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return [
        `M ${outerStart.x} ${outerStart.y}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
        `L ${innerEnd.x} ${innerEnd.y}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerStart.x} ${innerStart.y}`,
        'Z',
    ].join(' ');
}

export default function VacationsDashboardPage() {
    const [loadingDashboard, setLoadingDashboard] = useState(true);
    const [loadingReports, setLoadingReports] = useState(false);
    const [savingTimelineEdit, setSavingTimelineEdit] = useState(false);
    const [data, setData] = useState<VacationDashboard | null>(null);
    const [reports, setReports] = useState<VacationReports | null>(null);
    const [selectedUnit, setSelectedUnit] = useState<string>('all');
    const [timelineEditOpen, setTimelineEditOpen] = useState(false);
    const [timelineEditDraft, setTimelineEditDraft] = useState<TimelineEditDraft | null>(null);
    const [hoveredAbonoSlice, setHoveredAbonoSlice] = useState<number | null>(null);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const today = new Date();
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const monthEnd = `${monthEndDate.getFullYear()}-${String(monthEndDate.getMonth() + 1).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`;

    const [reportStartDate, setReportStartDate] = useState(monthStart);
    const [reportEndDate, setReportEndDate] = useState(monthEnd);

    function buildDashboardPath(): string {
        const params = new URLSearchParams();

        if (selectedUnit !== 'all') {
            params.append('unidade_id', selectedUnit);
        }

        const suffix = params.toString();

        return suffix ? `/payroll/vacations/dashboard?${suffix}` : '/payroll/vacations/dashboard';
    }

    function loadDashboard(): Promise<void> {
        setLoadingDashboard(true);

        return apiGet<WrappedResponse<VacationDashboard>>(buildDashboardPath())
            .then((response) => setData(response.data))
            .catch(() => {
                setNotification({
                    message: 'Não foi possível carregar o dashboard de férias.',
                    variant: 'error',
                });
            })
            .finally(() => setLoadingDashboard(false));
    }

    useEffect(() => {
        void loadDashboard();
    }, [selectedUnit]);

    useEffect(() => {
        setLoadingReports(true);

        apiGet<WrappedResponse<VacationReports>>(`/payroll/vacations/reports?start_date=${reportStartDate}&end_date=${reportEndDate}`)
            .then((response) => setReports(response.data))
            .catch(() =>
                setNotification({
                    message: 'Não foi possível carregar os relatórios por período.',
                    variant: 'error',
                }),
            )
            .finally(() => setLoadingReports(false));
    }, []);

    const timelineGraph = useMemo(() => {
        if (!data?.timeline?.length) {
            return null;
        }

        const rows = data.timeline
            .filter((item) => item.data_inicio && item.data_fim)
            .map((item) => ({
                ...item,
                inicio: parseIsoDate(item.data_inicio as string),
                fim: parseIsoDate(item.data_fim as string),
            }))
            .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

        if (!rows.length) {
            return null;
        }

        const minStart = rows.reduce((acc, item) => (item.inicio < acc ? item.inicio : acc), rows[0].inicio);
        const maxEnd = rows.reduce((acc, item) => (item.fim > acc ? item.fim : acc), rows[0].fim);

        const rangeStart = addDays(minStart, -2);
        const rangeEnd = addDays(maxEnd, 2);
        const totalDays = Math.max(diffDays(rangeStart, rangeEnd) + 1, 1);
        const dayPercent = 100 / totalDays;

        const axisTickIndexes: number[] = [];
        for (let index = 0; index < totalDays; index += 4) {
            axisTickIndexes.push(index);
        }

        if (axisTickIndexes[axisTickIndexes.length - 1] !== totalDays - 1) {
            axisTickIndexes.push(totalDays - 1);
        }

        const axisTicks = axisTickIndexes.map((index) => {
            const tickDate = addDays(rangeStart, index);

            return {
                key: `${tickDate.toISOString()}-${index}`,
                leftPercent: index * dayPercent,
                label: formatAxisDate(tickDate),
            };
        });

        const now = new Date();
        const todayAtNoon = new Date(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T12:00:00`);
        const todayOffset = diffDays(rangeStart, todayAtNoon);
        const hasTodayMarker = todayOffset >= 0 && todayOffset <= totalDays - 1;

        const items = rows.map((item) => {
            const startOffset = diffDays(rangeStart, item.inicio);
            const endOffset = diffDays(rangeStart, item.fim);
            const durationDays = Math.max(endOffset - startOffset + 1, 1);

            return {
                ...item,
                leftPercent: startOffset * dayPercent,
                widthPercent: Math.max(durationDays * dayPercent, 1.2),
            };
        });

        return {
            axisTicks,
            items,
            todayLeftPercent: todayOffset * dayPercent,
            hasTodayMarker,
        };
    }, [data]);

    const abonoDonutData = useMemo(() => {
        const totalComAbono = data?.total_com_abono ?? 0;
        const totalSemAbono = data?.total_sem_abono ?? 0;
        const totalLancamentos = data?.total_lancamentos_abono ?? totalComAbono + totalSemAbono;

        const slices = [
            { label: 'Com abono', total: totalComAbono, color: '#2563eb' },
            { label: 'Sem abono', total: totalSemAbono, color: '#ef4444' },
        ];

        const total = totalLancamentos > 0 ? totalLancamentos : slices.reduce((sum, slice) => sum + slice.total, 0);
        if (total <= 0) {
            return [] as AbonoDonutSlice[];
        }

        const centerX = 88;
        const centerY = 88;
        const outerRadius = 64;
        const innerRadius = 46;
        let currentAngle = 0;

        return slices.map((slice) => {
            const degrees = (slice.total / total) * 360;
            const start = currentAngle;
            const end = currentAngle + degrees;
            currentAngle = end;

            return {
                ...slice,
                percentual: Number(((slice.total / total) * 100).toFixed(2)),
                path: donutPath(centerX, centerY, outerRadius, innerRadius, start, end),
            };
        });
    }, [data?.total_com_abono, data?.total_lancamentos_abono, data?.total_sem_abono]);

    const activeAbonoSlice = hoveredAbonoSlice !== null ? abonoDonutData[hoveredAbonoSlice] : null;
    const maxRiskScore = Math.max(1, ...((data?.riscos_por_unidade ?? []).map((item) => item.risk_score)));

    function loadReports(): void {
        if (!reportStartDate || !reportEndDate) {
            setNotification({
                message: 'Informe o período para carregar os relatórios.',
                variant: 'info',
            });
            return;
        }

        setLoadingReports(true);
        apiGet<WrappedResponse<VacationReports>>(`/payroll/vacations/reports?start_date=${reportStartDate}&end_date=${reportEndDate}`)
            .then((response) => setReports(response.data))
            .catch(() =>
                setNotification({
                    message: 'Não foi possível carregar os relatórios por período.',
                    variant: 'error',
                }),
            )
            .finally(() => setLoadingReports(false));
    }

    function openTimelineEdit(item: VacationDashboard['timeline'][number]): void {
        if (!item.data_inicio || !item.data_fim) {
            setNotification({
                message: 'Registro sem datas válidas para edição.',
                variant: 'info',
            });
            return;
        }

        setTimelineEditDraft({
            id: item.id,
            colaborador_id: item.colaborador_id,
            tipo: item.tipo,
            com_abono: item.com_abono,
            dias_ferias: item.dias_ferias === 30 ? 30 : 20,
            data_inicio: item.data_inicio,
            data_fim: item.data_fim,
        });
        setTimelineEditOpen(true);
    }

    function saveTimelineEdit(): void {
        if (!timelineEditDraft) {
            return;
        }

        if (!timelineEditDraft.data_inicio || !timelineEditDraft.data_fim) {
            setNotification({
                message: 'Preencha data de início e fim para salvar a edição.',
                variant: 'info',
            });
            return;
        }

        setSavingTimelineEdit(true);

        apiPut(`/payroll/vacations/${timelineEditDraft.id}`, {
            colaborador_id: timelineEditDraft.colaborador_id,
            tipo: timelineEditDraft.tipo,
            com_abono: timelineEditDraft.com_abono,
            dias_ferias: timelineEditDraft.dias_ferias,
            data_inicio: timelineEditDraft.data_inicio,
            data_fim: timelineEditDraft.data_fim,
            periodo_aquisitivo_inicio: null,
            periodo_aquisitivo_fim: null,
        })
            .then(async () => {
                setNotification({
                    message: 'Férias atualizadas com sucesso.',
                    variant: 'success',
                });
                setTimelineEditOpen(false);
                setTimelineEditDraft(null);
                await loadDashboard();
            })
            .catch((error) => {
                if (error instanceof ApiError) {
                    const firstError = error.errors ? Object.values(error.errors)[0]?.[0] : null;
                    setNotification({
                        message: firstError ?? error.message ?? 'Não foi possível salvar a edição de férias.',
                        variant: 'error',
                    });

                    return;
                }

                setNotification({
                    message: 'Não foi possível salvar a edição de férias.',
                    variant: 'error',
                });
            })
            .finally(() => setSavingTimelineEdit(false));
    }

    return (
        <AdminLayout
            title="Controle de Férias - Dashboard"
            active="vacations-dashboard"
            module="vacations"
        >
            <div className="transport-dashboard-page">
                <div className="transport-dashboard-header flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="transport-dashboard-eyebrow">Gestão de férias</p>
                        <h2 className="transport-dashboard-title">Controle de Férias - Dashboard</h2>
                        <p className="transport-dashboard-subtitle">
                            Visão de vencimentos, timeline de férias e relatórios por período.
                        </p>
                    </div>

                    <div className="w-full max-w-xs">
                        <p className="mb-1 text-xs text-muted-foreground">Filtro da dashboard por unidade</p>
                        <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                            <SelectTrigger>
                                <SelectValue placeholder="Todas as unidades" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as unidades</SelectItem>
                                {(reports?.unidades ?? []).map((unit) => (
                                    <SelectItem key={unit.id} value={String(unit.id)}>
                                        {unit.nome}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {notification ? (
                    <Notification message={notification.message} variant={notification.variant} />
                ) : null}

                {loadingDashboard ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando dashboard...
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                            <Card className="transport-metric-card transport-tone-danger">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="transport-metric-label">Férias vencidas</CardTitle>
                                    <span className="transport-kpi-icon">
                                        <AlertTriangle className="size-4" />
                                    </span>
                                </CardHeader>
                                <CardContent>
                                    <p className="transport-metric-value">{formatIntegerBR(data?.ferias_vencidas ?? 0)}</p>
                                </CardContent>
                            </Card>

                            <Card className="transport-metric-card transport-tone-info">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="transport-metric-label">A vencer</CardTitle>
                                    <span className="transport-kpi-icon">
                                        <CalendarDays className="size-4" />
                                    </span>
                                </CardHeader>
                                <CardContent>
                                    <p className="transport-metric-value">{formatIntegerBR(data?.faixa_a_vencer ?? 0)}</p>
                                </CardContent>
                            </Card>

                            <Card className="transport-metric-card transport-tone-success">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="transport-metric-label">Liberadas</CardTitle>
                                    <span className="transport-kpi-icon">
                                        <CheckCircle2 className="size-4" />
                                    </span>
                                </CardHeader>
                                <CardContent>
                                    <p className="transport-metric-value">{formatIntegerBR(data?.faixa_liberada ?? 0)}</p>
                                </CardContent>
                            </Card>

                            <Card className="transport-metric-card transport-tone-warning">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="transport-metric-label">Atenção</CardTitle>
                                    <span className="transport-kpi-icon">
                                        <AlertTriangle className="size-4" />
                                    </span>
                                </CardHeader>
                                <CardContent>
                                    <p className="transport-metric-value">{formatIntegerBR(data?.faixa_atencao ?? 0)}</p>
                                </CardContent>
                            </Card>

                            <Card className="transport-metric-card transport-tone-warning">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="transport-metric-label">Urgentes</CardTitle>
                                    <span className="transport-kpi-icon">
                                        <Clock3 className="size-4" />
                                    </span>
                                </CardHeader>
                                <CardContent>
                                    <p className="transport-metric-value">{formatIntegerBR(data?.faixa_urgente ?? 0)}</p>
                                </CardContent>
                            </Card>

                            <Card className="transport-metric-card transport-tone-success">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="transport-metric-label">Taxa de liberadas</CardTitle>
                                    <span className="transport-kpi-icon">
                                        <CheckCircle2 className="size-4" />
                                    </span>
                                </CardHeader>
                                <CardContent>
                                    <p className="transport-metric-value">{formatPercentBR(data?.taxa_liberadas_sobre_ativos ?? 0)}</p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[2.3fr_1fr]">
                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Linha do tempo</CardTitle>
                                    <p className="transport-dashboard-section-subtitle">Vigentes, agendadas e passadas com edição por duplo clique.</p>
                                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <span className="size-2 rounded-full bg-emerald-500" />
                                            Vigentes
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="size-2 rounded-full bg-blue-600" />
                                            Agendadas
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="size-2 rounded-full bg-amber-600" />
                                            Passadas
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {timelineGraph ? (
                                        <div className="space-y-3">
                                            <div className="rounded-md border bg-muted/10">
                                                <div className="grid grid-cols-[220px_1fr] border-b">
                                                    <div className="h-9 border-r" />

                                                    <div className="relative h-9">
                                                        {timelineGraph.axisTicks.map((tick) => (
                                                            <div key={tick.key} className="absolute top-0 bottom-0" style={{ left: `${tick.leftPercent}%` }}>
                                                                <div className="h-full w-px bg-border" />
                                                                <span className="absolute top-1 left-1 text-[10px] text-muted-foreground">
                                                                    {tick.label}
                                                                </span>
                                                            </div>
                                                        ))}

                                                        {timelineGraph.hasTodayMarker ? (
                                                            <div className="pointer-events-none absolute top-0 bottom-0 z-20" style={{ left: `${timelineGraph.todayLeftPercent}%` }}>
                                                                <div className="h-full w-px bg-primary" />
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>

                                                <div className="divide-y">
                                                    {timelineGraph.items.map((item) => (
                                                        <div key={item.id} className="grid grid-cols-[220px_1fr] items-center">
                                                            <div className="h-11 border-r px-3 py-2">
                                                                <p className="truncate text-sm font-medium leading-tight">{item.nome ?? '-'}</p>
                                                                <p className="truncate text-xs text-muted-foreground leading-tight">
                                                                    {item.funcao ?? '-'} • {item.unidade ?? '-'}
                                                                </p>
                                                            </div>

                                                            <div className="relative h-11">
                                                                {timelineGraph.axisTicks.map((tick) => (
                                                                    <div
                                                                        key={`row-${item.id}-${tick.key}`}
                                                                        className="pointer-events-none absolute top-0 bottom-0"
                                                                        style={{ left: `${tick.leftPercent}%` }}
                                                                    >
                                                                        <div className="h-full w-px bg-border/70" />
                                                                    </div>
                                                                ))}

                                                                <div
                                                                    className={`absolute top-1.5 bottom-1.5 rounded-md border px-2 text-xs font-medium text-white flex items-center cursor-pointer ${item.tipo === 'passada' ? 'bg-amber-600/90 border-amber-500' : item.status_timeline === 'vigente' ? 'bg-emerald-600/90 border-emerald-500' : 'bg-blue-600/90 border-blue-500'}`}
                                                                    style={{
                                                                        left: `${item.leftPercent}%`,
                                                                        width: `${item.widthPercent}%`,
                                                                    }}
                                                                    onDoubleClick={() => openTimelineEdit(item)}
                                                                    title={`Duplo clique para editar • ${item.nome ?? '-'} • ${formatDate(item.data_inicio)} até ${formatDate(item.data_fim)}`}
                                                                >
                                                                    <span className="truncate">
                                                                        {formatDate(item.data_inicio)} → {formatDate(item.data_fim)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Sem férias vigentes ou agendadas para a timeline.</p>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Abono x sem abono</CardTitle>
                                    <p className="transport-dashboard-section-subtitle">
                                        Total lançado: {formatIntegerBR(data?.total_lancamentos_abono ?? 0)} férias
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    {abonoDonutData.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Sem dados de abono no período.</p>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-center">
                                                <div className="relative h-48 w-48">
                                                    <svg viewBox="0 0 176 176" className="h-full w-full">
                                                        {abonoDonutData.map((slice, index) => (
                                                            <path
                                                                key={`${slice.label}-${index}`}
                                                                d={slice.path}
                                                                fill={slice.color}
                                                                className="transition-opacity"
                                                                style={{ opacity: hoveredAbonoSlice === null || hoveredAbonoSlice === index ? 1 : 0.45 }}
                                                                onMouseEnter={() => setHoveredAbonoSlice(index)}
                                                                onMouseLeave={() => setHoveredAbonoSlice(null)}
                                                            />
                                                        ))}
                                                    </svg>

                                                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                                                        <p className="max-w-[110px] px-2 text-[10px] leading-tight text-muted-foreground">
                                                            {activeAbonoSlice ? activeAbonoSlice.label : 'Com abono'}
                                                        </p>
                                                        <p className="text-sm font-semibold md:text-base">
                                                            {formatPercentBR(activeAbonoSlice ? activeAbonoSlice.percentual : (data?.percentual_com_abono ?? 0))}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {formatIntegerBR(activeAbonoSlice ? activeAbonoSlice.total : (data?.total_com_abono ?? 0))} férias
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2 text-sm">
                                                {abonoDonutData.map((slice, index) => (
                                                    <div
                                                        key={`abono-legend-${slice.label}`}
                                                        className="transport-insight-row"
                                                        onMouseEnter={() => setHoveredAbonoSlice(index)}
                                                        onMouseLeave={() => setHoveredAbonoSlice(null)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: slice.color }} />
                                                            <span>{slice.label}</span>
                                                        </div>
                                                        <span className="font-medium">
                                                            {formatPercentBR(slice.percentual)} • {formatIntegerBR(slice.total)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Prioridades de vencimento</CardTitle>
                                    <p className="transport-dashboard-section-subtitle">
                                        Ranking de colaboradores com maior pressao de vencimento.
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {data?.top_prioridades.length ? (
                                        data.top_prioridades.map((item, index) => (
                                            <div key={item.colaborador_id} className="transport-list-panel">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <span className="transport-value-pill shrink-0">#{index + 1}</span>
                                                        <p className="truncate font-medium">{item.nome}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                                            D-{formatIntegerBR(item.dias_para_limite)}
                                                        </span>
                                                        <span className={`transport-status-badge ${priorityBadgeClass(item.status)}`}>
                                                            {priorityStatusLabel(item.status)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-muted-foreground">
                                                    {item.funcao ?? '-'} • {item.unidade ?? '-'}
                                                </p>
                                                <p className="text-muted-foreground">
                                                    Limite {formatDate(item.limite)} • {formatIntegerBR(item.dias_para_limite)} dia(s)
                                                </p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Sem prioridades críticas no momento.</p>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Risco por unidade</CardTitle>
                                    <p className="transport-dashboard-section-subtitle">
                                        Comparativo direto de criticidade entre unidades.
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {data?.riscos_por_unidade.length ? (
                                        data.riscos_por_unidade.slice(0, 6).map((item, index) => (
                                            <div key={item.unidade_id} className="transport-list-panel">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <span className="transport-value-pill shrink-0">#{index + 1}</span>
                                                        <p className="truncate font-medium">{item.unidade_nome}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-semibold text-foreground">Score {formatIntegerBR(item.risk_score)}</p>
                                                        <p className="text-xs text-muted-foreground">{formatPercentBR(item.risk_rate)}</p>
                                                    </div>
                                                </div>
                                                <div className="transport-progress-track mt-2">
                                                    <div
                                                        className="transport-progress-fill bg-amber-500"
                                                        style={{ width: `${Math.min(100, Math.max(8, (item.risk_score / maxRiskScore) * 100))}%` }}
                                                    />
                                                </div>
                                                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                                                    <div>
                                                        <p className="text-[11px] text-muted-foreground">Vencidas</p>
                                                        <p className="font-semibold">{formatIntegerBR(item.vencidas)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] text-muted-foreground">Urgentes</p>
                                                        <p className="font-semibold">{formatIntegerBR(item.urgentes)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] text-muted-foreground">Atenção</p>
                                                        <p className="font-semibold">{formatIntegerBR(item.atencao)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] text-muted-foreground">Liberadas</p>
                                                        <p className="font-semibold">{formatIntegerBR(item.liberadas)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Sem consolidado por unidade no período.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Relatórios por período</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                                        <div className="space-y-1">
                                            <p className="text-xs text-muted-foreground">Data inicial</p>
                                            <Input type="date" value={reportStartDate} onChange={(event) => setReportStartDate(event.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs text-muted-foreground">Data final</p>
                                            <Input type="date" value={reportEndDate} onChange={(event) => setReportEndDate(event.target.value)} />
                                        </div>
                                        <Button onClick={loadReports} disabled={loadingReports}>
                                            {loadingReports ? 'Carregando...' : 'Atualizar'}
                                        </Button>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-3">
                                        <div className="transport-list-panel">
                                            <p className="text-xs text-muted-foreground">Férias gozadas</p>
                                            <p className="text-xl font-semibold">{formatIntegerBR(reports?.ferias_gozadas.total ?? 0)}</p>
                                        </div>
                                        <div className="transport-list-panel">
                                            <p className="text-xs text-muted-foreground">Admissões</p>
                                            <p className="text-xl font-semibold">{formatIntegerBR(reports?.admissoes.total ?? 0)}</p>
                                        </div>
                                        <div className="transport-list-panel">
                                            <p className="text-xs text-muted-foreground">Demissões</p>
                                            <p className="text-xl font-semibold">{formatIntegerBR(reports?.demissoes.total ?? 0)}</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 lg:grid-cols-3">
                                        <div className="transport-list-panel">
                                            <p className="mb-2 text-xs font-medium text-muted-foreground">Férias gozadas</p>
                                            <div className="max-h-[320px] space-y-2 overflow-auto pr-1 text-xs">
                                                {(reports?.ferias_gozadas.rows ?? []).map((row) => (
                                                    <div key={row.id} className="rounded border bg-card px-2 py-1.5">
                                                        <p className="font-medium">{row.nome ?? '-'}</p>
                                                        <p className="text-muted-foreground">
                                                            {row.unidade ?? '-'} • {formatDate(row.data_inicio)} até {formatDate(row.data_fim)}
                                                        </p>
                                                    </div>
                                                ))}
                                                {!reports?.ferias_gozadas.rows.length ? (
                                                    <p className="text-muted-foreground">Sem registros no período.</p>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="transport-list-panel">
                                            <p className="mb-2 text-xs font-medium text-muted-foreground">Admissões</p>
                                            <div className="max-h-[320px] space-y-2 overflow-auto pr-1 text-xs">
                                                {(reports?.admissoes.rows ?? []).map((row) => (
                                                    <div key={row.id} className="rounded border bg-card px-2 py-1.5">
                                                        <p className="font-medium">{row.nome ?? '-'}</p>
                                                        <p className="text-muted-foreground">
                                                            {row.unidade ?? '-'} • {formatDate(row.data_admissao)}
                                                        </p>
                                                    </div>
                                                ))}
                                                {!reports?.admissoes.rows.length ? (
                                                    <p className="text-muted-foreground">Sem admissões no período.</p>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="transport-list-panel">
                                            <p className="mb-2 text-xs font-medium text-muted-foreground">Demissões</p>
                                            <div className="max-h-[320px] space-y-2 overflow-auto pr-1 text-xs">
                                                {(reports?.demissoes.rows ?? []).map((row) => (
                                                    <div key={row.id} className="rounded border bg-card px-2 py-1.5">
                                                        <p className="font-medium">{row.nome ?? '-'}</p>
                                                        <p className="text-muted-foreground">
                                                            {row.unidade ?? '-'} • {formatDate(row.data_demissao)}
                                                        </p>
                                                    </div>
                                                ))}
                                                {!reports?.demissoes.rows.length ? (
                                                    <p className="text-muted-foreground">Sem demissões no período.</p>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Férias vigentes ({data?.ferias_vigentes.length ?? 0})</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {data?.ferias_vigentes.length ? (
                                        <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                                            {data.ferias_vigentes.map((item) => (
                                                <div key={item.id} className="transport-list-panel">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="font-medium">{item.nome ?? '-'}</p>
                                                        <span className="transport-status-badge transport-status-success">
                                                            {tipoLabel(item.tipo)}
                                                        </span>
                                                    </div>
                                                    <p className="text-muted-foreground">
                                                        {item.funcao ?? '-'} • {item.unidade ?? '-'}
                                                    </p>
                                                    <p className="text-muted-foreground">
                                                        {formatDate(item.data_inicio)} até {formatDate(item.data_fim)} • {item.dias_restantes} dia(s)
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Não há férias vigentes no momento.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </>
                )}

                <Dialog
                    open={timelineEditOpen}
                    onOpenChange={(open) => {
                        setTimelineEditOpen(open);
                        if (!open) {
                            setTimelineEditDraft(null);
                        }
                    }}
                >
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Editar férias da timeline</DialogTitle>
                            <DialogDescription>
                                Ajuste o lançamento selecionado e salve para atualizar a timeline.
                            </DialogDescription>
                        </DialogHeader>

                        {timelineEditDraft ? (
                            <div className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label>Tipo</Label>
                                        <Select
                                            value={timelineEditDraft.tipo}
                                            onValueChange={(value: 'confirmado' | 'previsao' | 'passada') =>
                                                setTimelineEditDraft((previous) =>
                                                    previous
                                                        ? {
                                                              ...previous,
                                                              tipo: value,
                                                          }
                                                        : previous,
                                                )
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="confirmado">Confirmado</SelectItem>
                                                <SelectItem value="previsao">Previsão</SelectItem>
                                                <SelectItem value="passada">Passada</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Dias</Label>
                                        <Select
                                            value={String(timelineEditDraft.dias_ferias)}
                                            onValueChange={(value) => {
                                                const nextDays = value === '30' ? 30 : 20;

                                                setTimelineEditDraft((previous) =>
                                                    previous
                                                        ? {
                                                              ...previous,
                                                              dias_ferias: nextDays,
                                                              com_abono: nextDays === 20,
                                                          }
                                                        : previous,
                                                );
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="20">20 dias</SelectItem>
                                                <SelectItem value="30">30 dias</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Abono</Label>
                                        <Select
                                            value={timelineEditDraft.com_abono ? 'sim' : 'nao'}
                                            onValueChange={(value) => {
                                                const nextComAbono = value === 'sim';

                                                setTimelineEditDraft((previous) =>
                                                    previous
                                                        ? {
                                                              ...previous,
                                                              com_abono: nextComAbono,
                                                              dias_ferias: nextComAbono ? 20 : 30,
                                                          }
                                                        : previous,
                                                );
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="sim">Com abono</SelectItem>
                                                <SelectItem value="nao">Sem abono</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Data início</Label>
                                        <Input
                                            type="date"
                                            value={timelineEditDraft.data_inicio}
                                            onChange={(event) =>
                                                setTimelineEditDraft((previous) =>
                                                    previous
                                                        ? {
                                                              ...previous,
                                                              data_inicio: event.target.value,
                                                          }
                                                        : previous,
                                                )
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Data fim</Label>
                                        <Input
                                            type="date"
                                            value={timelineEditDraft.data_fim}
                                            onChange={(event) =>
                                                setTimelineEditDraft((previous) =>
                                                    previous
                                                        ? {
                                                              ...previous,
                                                              data_fim: event.target.value,
                                                          }
                                                        : previous,
                                                )
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setTimelineEditOpen(false);
                                    setTimelineEditDraft(null);
                                }}
                                disabled={savingTimelineEdit}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                onClick={saveTimelineEdit}
                                disabled={savingTimelineEdit || !timelineEditDraft}
                            >
                                {savingTimelineEdit ? (
                                    <>
                                        <LoaderCircle className="size-4 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    'Salvar edição'
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AdminLayout>
    );
}
