import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError, apiGet, apiPost } from '@/lib/api-client';
import { formatCurrencyBR, formatIntegerBR, formatPercentBR } from '@/lib/transport-format';

interface ExecutiveInsightsResponse {
    data: {
        competencia_mes: number;
        competencia_ano: number;
        interviews: {
            total: number;
            approved: number;
            approval_rate: number;
        };
        payroll: {
            total: number;
            launches: number;
            coverage_rate: number;
        };
        freight: {
            entries: number;
            total: number;
            spot_total: number;
            spot_share: number;
        };
        alerts: Array<{
            level: 'warning' | 'info';
            title: string;
            detail: string;
        }>;
    };
}

interface PendingByUnitResponse {
    data: Array<{
        unidade_id: number;
        unidade_nome: string;
        active_collaborators: number;
        payroll_pending_collaborators: number;
        freight_canceled_to_receive: number;
        onboarding_open: number;
        onboarding_overdue: number;
    }>;
}

interface DataQualityResponse {
    summary: {
        total_collaborators: number;
        missing_phone: number;
        missing_email: number;
        missing_admission_date: number;
        missing_function: number;
        missing_photo: number;
        missing_cnh_attachment: number;
        missing_work_card_attachment: number;
        duplicate_cpf_groups: number;
    };
    issues_by_unit: Array<{
        unidade_id: number;
        missing_phone: number;
        missing_email: number;
        missing_admission_date: number;
        missing_function: number;
        missing_photo: number;
        missing_cnh_attachment: number;
        missing_work_card_attachment: number;
    }>;
}

interface BenchmarkByUnitResponse {
    totals: {
        freight_total: number;
        payroll_total: number;
        fines_total: number;
        operation_cost_total: number;
        km_total: number;
        trips_total: number;
    };
    highlights: {
        best_cost_per_km: {
            unidade_nome: string;
            cost_per_km: number | null;
        } | null;
        highest_volume: {
            unidade_nome: string;
            freight_total: number;
        } | null;
        highest_cost_pressure: {
            unidade_nome: string;
            operation_cost_total: number;
        } | null;
    };
    data: Array<{
        unidade_id: number;
        unidade_nome: string;
        freight_total: number;
        payroll_total: number;
        fines_total: number;
        operation_cost_total: number;
        km_total: number;
        trips_total: number;
        aves_total: number;
        cost_per_km: number | null;
        cost_per_trip: number | null;
        operation_cost_share_percent: number;
    }>;
}

interface ForecastResponse {
    vacations: {
        next_30_days: number;
        next_60_days: number;
        next_90_days: number;
    };
    payroll_forecast: {
        average_last_3_months: number;
        next_30_days: number;
        next_60_days: number;
        next_90_days: number;
    };
    cost_relation: {
        trend_last_6_months: Array<{
            mes: number;
            ano: number;
            label: string;
            freight_total: number;
            fines_total: number;
            operation_cost_total: number;
        }>;
    };
}

interface ObservabilityResponse {
    async_operations: {
        queued: number;
        processing: number;
        completed: number;
        failed: number;
    };
    http: {
        total_requests_window: number;
        http_2xx: number;
        http_4xx: number;
        http_5xx: number;
    };
    latency: {
        slowest_p95_ms: number;
    };
    alerts: Array<{
        level: 'warning' | 'info' | 'critical';
        title: string;
        detail: string;
    }>;
}

interface PayrollApprovalsResponse {
    summary: {
        pending: number;
        expires_soon: number;
    };
    data: Array<{
        id: number;
        action_key: string;
        status: string;
        priority: 'normal' | 'medium' | 'high';
        expires_soon: boolean;
        required_approvals: number;
        approved_steps: number;
        requester?: {
            name?: string | null;
        } | null;
        summary?: {
            total_valor?: number;
            total_colaboradores?: number;
            unidade_nome?: string | null;
        } | null;
    }>;
}

interface ExecutiveDashboardState {
    executive: ExecutiveInsightsResponse['data'];
    pendingByUnit: PendingByUnitResponse['data'];
    quality: DataQualityResponse;
    observability: ObservabilityResponse;
    approvals: PayrollApprovalsResponse;
    benchmark: BenchmarkByUnitResponse;
    forecast: ForecastResponse;
}

function alertToneClass(level: 'warning' | 'info' | 'critical'): string {
    if (level === 'critical') return 'border-destructive/60 bg-destructive/5';
    if (level === 'warning') return 'border-amber-500/40 bg-amber-500/5';
    return 'border-blue-500/40 bg-blue-500/5';
}

function alertIconClass(level: 'warning' | 'info' | 'critical'): string {
    if (level === 'critical') return 'text-destructive';
    if (level === 'warning') return 'text-amber-600';
    return 'text-blue-600';
}

function priorityLabel(priority: PayrollApprovalsResponse['data'][number]['priority']): string {
    if (priority === 'high') return 'Alta';
    if (priority === 'medium') return 'Media';
    return 'Normal';
}

function priorityToneClass(priority: PayrollApprovalsResponse['data'][number]['priority']): string {
    if (priority === 'high') return 'transport-status-danger';
    if (priority === 'medium') return 'transport-status-warning';
    return 'transport-status-info';
}

function approvalActionLabel(actionKey: string): string {
    if (actionKey === 'payroll.launch-batch') return 'Folha - lancamento em lote';
    if (actionKey === 'fines.entry.store') return 'Multas - novo lancamento';
    if (actionKey === 'fines.entry.update') return 'Multas - alteracao';
    if (actionKey === 'vacations.entry.store') return 'Ferias - novo lancamento';
    if (actionKey === 'vacations.entry.update') return 'Ferias - alteracao';
    return actionKey;
}

function pendingPriorityLabel(score: number, maxScore: number): string {
    if (maxScore <= 0) return 'Estavel';
    const ratio = score / maxScore;
    if (ratio >= 0.75) return 'Critica';
    if (ratio >= 0.45) return 'Atencao';
    return 'Moderada';
}

function InfoMetric({
    title,
    value,
    detail,
    tone = 'info',
}: {
    title: string;
    value: string;
    detail: string;
    tone?: 'info' | 'success' | 'warning' | 'danger';
}) {
    return (
        <Card className={`transport-metric-card transport-tone-${tone}`}>
            <CardHeader className="pb-2">
                <CardTitle className="transport-metric-label">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="transport-metric-value">{value}</p>
                <p className="transport-metric-context">{detail}</p>
            </CardContent>
        </Card>
    );
}

export default function TransportExecutiveDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);
    const [approvalActionById, setApprovalActionById] = useState<Record<number, 'approve' | 'reject' | null>>({});
    const [state, setState] = useState<ExecutiveDashboardState | null>(null);

    async function refreshApprovals(): Promise<void> {
        const approvals = await apiGet<PayrollApprovalsResponse>('/payroll/approvals?status=pending&per_page=5');

        setState((previous) => {
            if (!previous) return previous;

            return {
                ...previous,
                approvals,
            };
        });
    }

    async function handleApprovalAction(approvalId: number, action: 'approve' | 'reject'): Promise<void> {
        setApprovalActionById((previous) => ({
            ...previous,
            [approvalId]: action,
        }));
        setNotification(null);

        try {
            if (action === 'approve') {
                await apiPost(`/payroll/approvals/${approvalId}/approve`, {});
            } else {
                await apiPost(`/payroll/approvals/${approvalId}/reject`, {
                    reason: 'Rejeicao registrada no dashboard executivo.',
                });
            }

            setNotification({
                message: action === 'approve'
                    ? 'Solicitacao aprovada com sucesso.'
                    : 'Solicitacao rejeitada com sucesso.',
                variant: 'success',
            });

            await refreshApprovals();
        } catch (requestError) {
            if (requestError instanceof ApiError) {
                setNotification({
                    message: requestError.message,
                    variant: 'error',
                });
            } else {
                setNotification({
                    message: 'Nao foi possivel concluir a revisao da solicitacao.',
                    variant: 'error',
                });
            }
        } finally {
            setApprovalActionById((previous) => ({
                ...previous,
                [approvalId]: null,
            }));
        }
    }

    useEffect(() => {
        setLoading(true);
        setError(null);

        Promise.all([
            apiGet<ExecutiveInsightsResponse>('/insights/executive'),
            apiGet<BenchmarkByUnitResponse>('/insights/benchmark-by-unit'),
            apiGet<ForecastResponse>('/insights/forecast'),
            apiGet<PendingByUnitResponse>('/insights/pending-by-unit'),
            apiGet<DataQualityResponse>('/insights/data-quality'),
            apiGet<ObservabilityResponse>('/system/observability'),
            apiGet<PayrollApprovalsResponse>('/payroll/approvals?status=pending&per_page=5'),
        ])
            .then(([executive, benchmark, forecast, pendingByUnit, quality, observability, approvals]) => {
                setState({
                    executive: executive.data,
                    benchmark,
                    forecast,
                    pendingByUnit: pendingByUnit.data,
                    quality,
                    observability,
                    approvals,
                });
            })
            .catch(() => setError('Nao foi possivel carregar o dashboard executivo.'))
            .finally(() => setLoading(false));
    }, []);

    const mergedAlerts = useMemo(() => {
        if (!state) return [];
        return [...state.executive.alerts, ...state.observability.alerts].slice(0, 8);
    }, [state]);

    const topPendingUnits = useMemo(() => {
        if (!state) return [];

        return [...state.pendingByUnit]
            .map((unit) => ({
                ...unit,
                pressure_score:
                    unit.payroll_pending_collaborators
                    + unit.freight_canceled_to_receive
                    + (unit.onboarding_overdue * 2),
            }))
            .sort((a, b) => b.pressure_score - a.pressure_score)
            .slice(0, 6);
    }, [state]);

    const worstQualityUnits = useMemo(() => {
        if (!state) return [];

        return [...state.quality.issues_by_unit]
            .map((row) => ({
                ...row,
                total_issues:
                    row.missing_phone
                    + row.missing_email
                    + row.missing_admission_date
                    + row.missing_function
                    + row.missing_photo
                    + row.missing_cnh_attachment
                    + row.missing_work_card_attachment,
            }))
            .sort((a, b) => b.total_issues - a.total_issues)
            .slice(0, 5);
    }, [state]);

    const benchmarkTopUnits = useMemo(() => {
        if (!state) return [];

        return [...state.benchmark.data]
            .sort((a, b) => b.operation_cost_total - a.operation_cost_total)
            .slice(0, 4);
    }, [state]);

    const maxPendingPressure = Math.max(1, ...topPendingUnits.map((item) => item.pressure_score));
    const maxQualityIssues = Math.max(1, ...worstQualityUnits.map((item) => item.total_issues));

    return (
        <AdminLayout title="Dashboard Executivo" active="executive-dashboard" module="home">
            <div className="transport-dashboard-page">
                <div className="transport-dashboard-header">
                    <p className="transport-dashboard-eyebrow">Visao consolidada</p>
                    <h2 className="transport-dashboard-title">Dashboard Executivo</h2>
                    <p className="transport-dashboard-subtitle">
                        Consolidado de operacao, pendencias, qualidade de dados e saude do sistema.
                    </p>
                </div>

                {error ? <Notification message={error} variant="error" /> : null}
                {notification ? <Notification message={notification.message} variant={notification.variant} /> : null}

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando indicadores executivos...
                    </div>
                ) : state ? (
                    <>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <InfoMetric
                                title="Aprovacao em entrevistas"
                                value={formatPercentBR(state.executive.interviews.approval_rate)}
                                detail={`${formatIntegerBR(state.executive.interviews.approved)} aprovados de ${formatIntegerBR(state.executive.interviews.total)} entrevistas`}
                                tone="success"
                            />
                            <InfoMetric
                                title="Cobertura da folha"
                                value={formatPercentBR(state.executive.payroll.coverage_rate)}
                                detail={`${formatCurrencyBR(state.executive.payroll.total)} em ${formatIntegerBR(state.executive.payroll.launches)} lancamentos`}
                                tone="info"
                            />
                            <InfoMetric
                                title="Frete total no mes"
                                value={formatCurrencyBR(state.executive.freight.total)}
                                detail={`Spot em ${formatPercentBR(state.executive.freight.spot_share)} do total monitorado`}
                                tone="info"
                            />
                            <InfoMetric
                                title="Aprovacoes financeiras"
                                value={formatIntegerBR(state.approvals.summary.pending)}
                                detail={`${formatIntegerBR(state.approvals.summary.expires_soon)} vencendo em breve`}
                                tone="warning"
                            />
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Benchmark por unidade</CardTitle>
                                    <p className="transport-dashboard-section-subtitle">
                                        Comparativo de volume e custo operacional consolidado no mes atual.
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <div className="transport-list-panel">
                                            <p className="text-xs text-muted-foreground">Melhor custo por KM</p>
                                            <p className="mt-1 font-semibold">
                                                {state.benchmark.highlights.best_cost_per_km?.unidade_nome ?? 'Sem dados'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {state.benchmark.highlights.best_cost_per_km?.cost_per_km != null
                                                    ? `${formatCurrencyBR(state.benchmark.highlights.best_cost_per_km.cost_per_km)}/km`
                                                    : 'Sem base suficiente'}
                                            </p>
                                        </div>
                                        <div className="transport-list-panel">
                                            <p className="text-xs text-muted-foreground">Maior volume de frete</p>
                                            <p className="mt-1 font-semibold">
                                                {state.benchmark.highlights.highest_volume?.unidade_nome ?? 'Sem dados'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatCurrencyBR(state.benchmark.highlights.highest_volume?.freight_total ?? 0)}
                                            </p>
                                        </div>
                                        <div className="transport-list-panel">
                                            <p className="text-xs text-muted-foreground">Maior custo operacional</p>
                                            <p className="mt-1 font-semibold">
                                                {state.benchmark.highlights.highest_cost_pressure?.unidade_nome ?? 'Sem dados'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatCurrencyBR(state.benchmark.highlights.highest_cost_pressure?.operation_cost_total ?? 0)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {benchmarkTopUnits.length === 0 ? (
                                            <div className="transport-empty-state">
                                                <strong>Sem benchmark no periodo</strong>
                                                Nao ha dados suficientes para comparar unidades neste mes.
                                            </div>
                                        ) : (
                                            benchmarkTopUnits.map((unit, index) => (
                                                <div key={unit.unidade_id} className="transport-list-panel">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex min-w-0 items-center gap-2">
                                                            <span className="transport-value-pill shrink-0">#{index + 1}</span>
                                                            <p className="truncate font-medium">{unit.unidade_nome}</p>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatPercentBR(unit.operation_cost_share_percent)} do custo
                                                        </span>
                                                    </div>
                                                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                                        <div>
                                                            <p className="text-[11px] text-muted-foreground">Custo operacional</p>
                                                            <p className="font-semibold">{formatCurrencyBR(unit.operation_cost_total)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] text-muted-foreground">Custo por viagem</p>
                                                            <p className="font-semibold">
                                                                {unit.cost_per_trip != null ? formatCurrencyBR(unit.cost_per_trip) : '-'}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] text-muted-foreground">KM total</p>
                                                            <p className="font-semibold">{formatIntegerBR(Math.round(unit.km_total))}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Forecast 30/60/90</CardTitle>
                                    <p className="transport-dashboard-section-subtitle">
                                        Projecao de ferias e previsao de folha para planejamento operacional.
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <div className="transport-list-panel">
                                            <p className="text-xs text-muted-foreground">Ferias ate 30 dias</p>
                                            <p className="mt-1 text-lg font-semibold">
                                                {formatIntegerBR(state.forecast.vacations.next_30_days)}
                                            </p>
                                        </div>
                                        <div className="transport-list-panel">
                                            <p className="text-xs text-muted-foreground">Ferias ate 60 dias</p>
                                            <p className="mt-1 text-lg font-semibold">
                                                {formatIntegerBR(state.forecast.vacations.next_60_days)}
                                            </p>
                                        </div>
                                        <div className="transport-list-panel">
                                            <p className="text-xs text-muted-foreground">Ferias ate 90 dias</p>
                                            <p className="mt-1 text-lg font-semibold">
                                                {formatIntegerBR(state.forecast.vacations.next_90_days)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="transport-list-panel">
                                        <p className="text-xs text-muted-foreground">Previsao de folha (media ultimos 3 meses)</p>
                                        <p className="mt-1 text-lg font-semibold">
                                            {formatCurrencyBR(state.forecast.payroll_forecast.average_last_3_months)}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            30d: {formatCurrencyBR(state.forecast.payroll_forecast.next_30_days)} •
                                            60d: {formatCurrencyBR(state.forecast.payroll_forecast.next_60_days)} •
                                            90d: {formatCurrencyBR(state.forecast.payroll_forecast.next_90_days)}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Alertas prioritarios</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {mergedAlerts.length === 0 ? (
                                        <div className="transport-empty-state">
                                            <strong>Sem alertas relevantes</strong>
                                            Nao ha alertas ativos de alta prioridade no momento.
                                        </div>
                                    ) : (
                                        mergedAlerts.map((alert, index) => (
                                            <div key={`${alert.title}-${index}`} className={`rounded-md border p-3 ${alertToneClass(alert.level)}`}>
                                                <div className="flex items-start gap-2">
                                                    <AlertTriangle className={`mt-0.5 size-4 ${alertIconClass(alert.level)}`} />
                                                    <div>
                                                        <p className="text-sm font-medium">{alert.title}</p>
                                                        <p className="text-xs text-muted-foreground">{alert.detail}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Saude operacional</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="transport-list-panel">
                                        <p className="text-xs text-muted-foreground">Latencia mais lenta (p95)</p>
                                        <p className="mt-1 text-xl font-semibold">
                                            {formatIntegerBR(Math.round(state.observability.latency.slowest_p95_ms ?? 0))} ms
                                        </p>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="transport-list-panel">
                                            <p className="text-xs text-muted-foreground">Erros 5xx</p>
                                            <p className="mt-1 text-lg font-semibold">{formatIntegerBR(state.observability.http.http_5xx)}</p>
                                        </div>
                                        <div className="transport-list-panel">
                                            <p className="text-xs text-muted-foreground">Fila com falha</p>
                                            <p className="mt-1 text-lg font-semibold">{formatIntegerBR(state.observability.async_operations.failed)}</p>
                                        </div>
                                        <div className="transport-list-panel">
                                            <p className="text-xs text-muted-foreground">Fila processando</p>
                                            <p className="mt-1 text-lg font-semibold">{formatIntegerBR(state.observability.async_operations.processing)}</p>
                                        </div>
                                        <div className="transport-list-panel">
                                            <p className="text-xs text-muted-foreground">Requests na janela</p>
                                            <p className="mt-1 text-lg font-semibold">{formatIntegerBR(state.observability.http.total_requests_window)}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Pendencias por unidade</CardTitle>
                                    <p className="transport-dashboard-section-subtitle">
                                        Priorização por volume e urgência operacional.
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {topPendingUnits.length === 0 ? (
                                        <div className="transport-empty-state">
                                            <strong>Sem pendencias consolidadas</strong>
                                            Nao ha pendencias agrupadas por unidade para o periodo.
                                        </div>
                                    ) : (
                                        topPendingUnits.map((unit, index) => (
                                            <div key={unit.unidade_id} className="transport-list-panel">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <span className="transport-value-pill shrink-0">#{index + 1}</span>
                                                        <p className="truncate font-medium">{unit.unidade_nome}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-semibold text-foreground">Pressão {formatIntegerBR(unit.pressure_score)}</p>
                                                        <p className="text-xs text-muted-foreground">{formatIntegerBR(unit.active_collaborators)} ativos</p>
                                                    </div>
                                                </div>
                                                <div className="transport-progress-track mt-2">
                                                    <div
                                                        className="transport-progress-fill bg-sky-600"
                                                        style={{ width: `${Math.min(100, Math.max(8, (unit.pressure_score / maxPendingPressure) * 100))}%` }}
                                                    />
                                                </div>
                                                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                                    <div>
                                                        <p className="text-[11px] text-muted-foreground">Folha pendente</p>
                                                        <p className="font-semibold">{formatIntegerBR(unit.payroll_pending_collaborators)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] text-muted-foreground">Onboarding atrasado</p>
                                                        <p className="font-semibold">{formatIntegerBR(unit.onboarding_overdue)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] text-muted-foreground">Cancelados a receber</p>
                                                        <p className="font-semibold">{formatIntegerBR(unit.freight_canceled_to_receive)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Qualidade de dados</CardTitle>
                                    <p className="transport-dashboard-section-subtitle">
                                        Campos faltantes e distribuicao de gaps por unidade.
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="transport-list-panel">
                                            <p className="text-xs text-muted-foreground">Sem telefone</p>
                                            <p className="mt-1 text-lg font-semibold">{formatIntegerBR(state.quality.summary.missing_phone)}</p>
                                        </div>
                                        <div className="transport-list-panel">
                                            <p className="text-xs text-muted-foreground">Sem e-mail</p>
                                            <p className="mt-1 text-lg font-semibold">{formatIntegerBR(state.quality.summary.missing_email)}</p>
                                        </div>
                                        <div className="transport-list-panel">
                                            <p className="text-xs text-muted-foreground">Sem foto</p>
                                            <p className="mt-1 text-lg font-semibold">{formatIntegerBR(state.quality.summary.missing_photo)}</p>
                                        </div>
                                        <div className="transport-list-panel">
                                            <p className="text-xs text-muted-foreground">CPF duplicado</p>
                                            <p className="mt-1 text-lg font-semibold">{formatIntegerBR(state.quality.summary.duplicate_cpf_groups)}</p>
                                        </div>
                                    </div>

                                    {worstQualityUnits.length > 0 ? (
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-muted-foreground">Unidades com mais gaps</p>
                                            {worstQualityUnits.map((row, index) => (
                                                <div key={row.unidade_id} className="transport-list-panel">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="transport-value-pill">#{index + 1}</span>
                                                            <span>Unidade #{row.unidade_id}</span>
                                                        </div>
                                                        <span className="font-medium">{formatIntegerBR(row.total_issues)} gaps</span>
                                                    </div>
                                                    <div className="transport-progress-track mt-2">
                                                        <div
                                                            className="transport-progress-fill bg-amber-500"
                                                            style={{ width: `${Math.min(100, Math.max(8, (row.total_issues / maxQualityIssues) * 100))}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </CardContent>
                            </Card>

                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Aprovacoes pendentes</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {state.approvals.data.length === 0 ? (
                                        <div className="transport-empty-state">
                                            <strong>Sem aprovacoes pendentes</strong>
                                            Nao ha solicitacoes financeiras aguardando aprovacao.
                                        </div>
                                    ) : (
                                        state.approvals.data.map((approval) => (
                                            <div key={approval.id} className="transport-list-panel">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="font-medium">{approval.summary?.unidade_nome ?? 'Sem unidade'}</p>
                                                    <span className={`transport-status-badge ${priorityToneClass(approval.priority)}`}>
                                                        {priorityLabel(approval.priority)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {approval.requester?.name ?? 'Sem solicitante'} • {formatIntegerBR(approval.summary?.total_colaboradores ?? 0)} colaboradores
                                                </p>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {approvalActionLabel(approval.action_key)} - Etapas {formatIntegerBR(approval.approved_steps)}/{formatIntegerBR(approval.required_approvals)}
                                                </p>
                                                <p className="mt-1 font-semibold">{formatCurrencyBR(approval.summary?.total_valor ?? 0)}</p>
                                                <div className="mt-3 flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        disabled={Boolean(approvalActionById[approval.id])}
                                                        onClick={() => void handleApprovalAction(approval.id, 'approve')}
                                                    >
                                                        Aprovar
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={Boolean(approvalActionById[approval.id])}
                                                        onClick={() => void handleApprovalAction(approval.id, 'reject')}
                                                    >
                                                        Rejeitar
                                                    </Button>
                                                </div>
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
