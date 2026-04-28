import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet } from '@/lib/api-client';
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
        status: string;
        priority: 'normal' | 'medium' | 'high';
        expires_soon: boolean;
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
    if (priority === 'medium') return 'Média';
    return 'Normal';
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
    const [state, setState] = useState<ExecutiveDashboardState | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);

        Promise.all([
            apiGet<ExecutiveInsightsResponse>('/insights/executive'),
            apiGet<PendingByUnitResponse>('/insights/pending-by-unit'),
            apiGet<DataQualityResponse>('/insights/data-quality'),
            apiGet<ObservabilityResponse>('/system/observability'),
            apiGet<PayrollApprovalsResponse>('/payroll/approvals?status=pending&per_page=5'),
        ])
            .then(([executive, pendingByUnit, quality, observability, approvals]) => {
                setState({
                    executive: executive.data,
                    pendingByUnit: pendingByUnit.data,
                    quality,
                    observability,
                    approvals,
                });
            })
            .catch(() => setError('Não foi possível carregar o dashboard executivo.'))
            .finally(() => setLoading(false));
    }, []);

    const mergedAlerts = useMemo(() => {
        if (!state) {
            return [];
        }

        return [...state.executive.alerts, ...state.observability.alerts].slice(0, 8);
    }, [state]);

    const topPendingUnits = useMemo(() => {
        if (!state) {
            return [];
        }

        return [...state.pendingByUnit]
            .sort((a, b) => {
                const left = a.payroll_pending_collaborators + a.freight_canceled_to_receive + (a.onboarding_overdue * 2);
                const right = b.payroll_pending_collaborators + b.freight_canceled_to_receive + (b.onboarding_overdue * 2);
                return right - left;
            })
            .slice(0, 6);
    }, [state]);

    const worstQualityUnits = useMemo(() => {
        if (!state) {
            return [];
        }

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

    return (
        <AdminLayout title="Dashboard Executivo" active="executive-dashboard" module="home">
            <div className="transport-dashboard-page">
                <div className="transport-dashboard-header">
                    <p className="transport-dashboard-eyebrow">Visão consolidada</p>
                    <h2 className="transport-dashboard-title">Dashboard Executivo</h2>
                    <p className="transport-dashboard-subtitle">
                        Visão consolidada da operação com pendências, qualidade de dados e saúde do sistema.
                    </p>
                </div>

                {error ? <Notification message={error} variant="error" /> : null}

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando indicadores executivos...
                    </div>
                ) : state ? (
                    <>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <InfoMetric
                                title="Aprovação em entrevistas"
                                value={formatPercentBR(state.executive.interviews.approval_rate)}
                                detail={`${formatIntegerBR(state.executive.interviews.approved)} aprovados de ${formatIntegerBR(state.executive.interviews.total)} entrevistas`}
                                tone="success"
                            />
                            <InfoMetric
                                title="Cobertura da folha"
                                value={formatPercentBR(state.executive.payroll.coverage_rate)}
                                detail={`${formatCurrencyBR(state.executive.payroll.total)} em ${formatIntegerBR(state.executive.payroll.launches)} lançamentos`}
                                tone="info"
                            />
                            <InfoMetric
                                title="Frete total no mês"
                                value={formatCurrencyBR(state.executive.freight.total)}
                                detail={`Spot em ${formatPercentBR(state.executive.freight.spot_share)} do total monitorado`}
                                tone="info"
                            />
                            <InfoMetric
                                title="Aprovações financeiras"
                                value={formatIntegerBR(state.approvals.summary.pending)}
                                detail={`${formatIntegerBR(state.approvals.summary.expires_soon)} vencendo em breve`}
                                tone="warning"
                            />
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Alertas prioritários</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {mergedAlerts.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Sem alertas relevantes no momento.</p>
                                    ) : (
                                        mergedAlerts.map((alert, index) => (
                                            <div
                                                key={`${alert.title}-${index}`}
                                                className={`rounded-md border p-3 ${alertToneClass(alert.level)}`}
                                            >
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
                                    <CardTitle className="transport-dashboard-section-title">Saúde operacional</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="transport-list-panel">
                                        <p className="text-xs text-muted-foreground">Latência mais lenta (p95)</p>
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
                                    <CardTitle className="transport-dashboard-section-title">Pendências por unidade</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {topPendingUnits.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Sem pendências consolidadas por unidade.</p>
                                    ) : (
                                        topPendingUnits.map((unit) => (
                                            <div key={unit.unidade_id} className="transport-list-panel">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="font-medium">{unit.unidade_nome}</p>
                                                    <p className="text-xs text-muted-foreground">{formatIntegerBR(unit.active_collaborators)} ativos</p>
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
                                            {worstQualityUnits.map((row) => (
                                                <div key={row.unidade_id} className="transport-compare-row">
                                                    <span>Unidade #{row.unidade_id}</span>
                                                    <span className="font-medium">{formatIntegerBR(row.total_issues)} gaps</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </CardContent>
                            </Card>

                            <Card className="transport-insight-card">
                                <CardHeader>
                                    <CardTitle className="transport-dashboard-section-title">Aprovações pendentes</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {state.approvals.data.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Sem aprovações pendentes.</p>
                                    ) : (
                                        state.approvals.data.map((approval) => (
                                            <div key={approval.id} className="transport-list-panel">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="font-medium">{approval.summary?.unidade_nome ?? 'Sem unidade'}</p>
                                                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                        {priorityLabel(approval.priority)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {approval.requester?.name ?? 'Sem solicitante'} • {formatIntegerBR(approval.summary?.total_colaboradores ?? 0)} colaboradores
                                                </p>
                                                <p className="mt-1 font-semibold">{formatCurrencyBR(approval.summary?.total_valor ?? 0)}</p>
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
