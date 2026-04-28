import { Link } from '@inertiajs/react';
import {
    ArrowRight,
    CheckCircle2,
    Clock3,
    FileText,
    LoaderCircle,
    PlusSquare,
    TestTube2,
    XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet } from '@/lib/api-client';
import { formatDateTimeBR, formatPercentBR } from '@/lib/transport-format';
import type { DashboardSummary } from '@/types/driver-interview';

function SummaryCard({
    title,
    value,
    icon,
    tone,
}: {
    title: string;
    value: number;
    icon: React.ReactNode;
    tone?: 'danger' | 'warning' | 'success' | 'info';
}) {
    return (
        <Card
            className={`transport-metric-card ${tone ? `transport-tone-${tone}` : 'transport-tone-info'}`}
        >
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="transport-metric-label">
                    {title}
                </CardTitle>
                <span className="transport-kpi-icon">{icon}</span>
            </CardHeader>
            <CardContent>
                <p className="transport-metric-value">{value}</p>
            </CardContent>
        </Card>
    );
}

function hrStatusLabel(status: string): string {
    if (status === 'aprovado') return 'Aprovado';
    if (status === 'reprovado') return 'Reprovado';
    if (status === 'em_analise') return 'Em análise';
    if (status === 'aguardando_vaga') return 'Aguardando vaga';
    if (status === 'guep') return 'GUEP';
    return 'Teste prático';
}

function guepStatusLabel(status: string): string {
    if (status === 'nao_fazer') return 'Não fazer';
    if (status === 'a_fazer') return 'A fazer';
    if (status === 'aprovado') return 'Aprovado';
    if (status === 'reprovado') return 'Reprovado';
    return 'Aguardando';
}

function hrStatusBadgeClass(status: string): string {
    if (status === 'aprovado') return 'transport-status-success';
    if (status === 'reprovado') return 'transport-status-danger';
    if (status === 'em_analise' || status === 'aguardando_vaga') return 'transport-status-warning';
    return 'transport-status-info';
}

function guepStatusBadgeClass(status: string): string {
    if (status === 'aprovado') return 'transport-status-success';
    if (status === 'reprovado') return 'transport-status-danger';
    if (status === 'a_fazer') return 'transport-status-warning';
    return 'transport-status-info';
}

export default function TransportDashboardPage() {
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiGet<DashboardSummary>('/dashboard/summary')
            .then((response) => setSummary(response))
            .catch(() => setError('Não foi possível carregar os indicadores.'))
            .finally(() => setLoading(false));
    }, []);

    const approvalRate =
        summary && summary.total_interviews > 0
            ? (summary.total_approved / summary.total_interviews) * 100
            : 0;

    return (
        <AdminLayout title="Entrevistas - Dashboard" active="dashboard">
            <div className="transport-dashboard-page">
                <div className="transport-dashboard-header">
                    <p className="transport-dashboard-eyebrow">Recrutamento</p>
                    <h2 className="transport-dashboard-title">Dashboard de Entrevistas</h2>
                    <p className="transport-dashboard-subtitle">
                        Visão executiva do funil de entrevistas, gargalos e ações pendentes do RH.
                    </p>
                </div>

                {error ? (
                    <Notification message={error} variant="error" />
                ) : null}

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando indicadores...
                    </div>
                ) : summary ? (
                    <div className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                            <SummaryCard
                                title="Total de entrevistas"
                                value={summary.total_interviews}
                                icon={
                                    <FileText className="size-4 text-muted-foreground" />
                                }
                            />
                            <SummaryCard
                                title="Total aprovados"
                                value={summary.total_approved}
                                tone="success"
                                icon={
                                    <CheckCircle2 className="size-4 text-muted-foreground" />
                                }
                            />
                            <SummaryCard
                                title="Total reprovados"
                                value={summary.total_reproved}
                                tone="danger"
                                icon={
                                    <XCircle className="size-4 text-muted-foreground" />
                                }
                            />
                            <SummaryCard
                                title="Aguardando vaga"
                                value={summary.total_waiting_vacancy}
                                tone="warning"
                                icon={
                                    <Clock3 className="size-4 text-muted-foreground" />
                                }
                            />
                            <SummaryCard
                                title="Teste prático"
                                value={summary.total_practical_test}
                                icon={
                                    <TestTube2 className="size-4 text-muted-foreground" />
                                }
                            />
                            <SummaryCard
                                title="GUEP pendente"
                                value={summary.pending_actions.guep_to_do}
                                tone="info"
                                icon={
                                    <Clock3 className="size-4 text-muted-foreground" />
                                }
                            />
                        </div>

                        <Card className="transport-insight-card">
                            <CardHeader>
                                <CardTitle className="transport-dashboard-section-title">Eficiência do funil</CardTitle>
                                <p className="transport-dashboard-section-subtitle">
                                    Ritmo de aprovação e gargalos que pedem ação do time.
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="transport-insight-row">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground">Taxa de aprovação</p>
                                        <p className="text-xs font-semibold text-muted-foreground">
                                            {formatPercentBR(approvalRate)}
                                        </p>
                                    </div>
                                    <div className="transport-progress-track mt-2">
                                        <div
                                            className="transport-progress-fill bg-emerald-500"
                                            style={{ width: `${Math.min(100, Math.max(0, approvalRate))}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="transport-list-panel">
                                        <p className="text-xs text-muted-foreground">Pendências totais</p>
                                        <p className="mt-1 text-xl font-semibold">{summary.pending_actions.total}</p>
                                    </div>
                                    <div className="transport-list-panel">
                                        <p className="text-xs text-muted-foreground">Aguardando vaga</p>
                                        <p className="mt-1 text-xl font-semibold">{summary.pending_actions.waiting_vacancy}</p>
                                    </div>
                                    <div className="transport-list-panel">
                                        <p className="text-xs text-muted-foreground">Teste prático</p>
                                        <p className="mt-1 text-xl font-semibold">{summary.pending_actions.practical_test}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
                            <Card className="transport-insight-card">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle className="transport-dashboard-section-title">Últimas entrevistas</CardTitle>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href="/transport/interviews">
                                            Ver todas
                                            <ArrowRight className="size-4" />
                                        </Link>
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    {summary.recent_interviews.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Sem entrevistas recentes.
                                        </p>
                                    ) : (
                                        <div className="space-y-3">
                                            {summary.recent_interviews.map(
                                                (item) => (
                                                    <div
                                                        key={item.id}
                                                        className="transport-list-panel"
                                                    >
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div>
                                                                <p className="font-medium">
                                                                    {
                                                                        item.full_name
                                                                    }
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {item.city}{' '}
                                                                    •{' '}
                                                                    {item.author_name ??
                                                                        'Sem entrevistador'}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Badge className={`transport-status-badge ${hrStatusBadgeClass(item.hr_status)}`}>
                                                                    {hrStatusLabel(
                                                                        item.hr_status,
                                                                    )}
                                                                </Badge>
                                                                <Badge className={`transport-status-badge ${guepStatusBadgeClass(item.guep_status)}`}>
                                                                    {guepStatusLabel(
                                                                        item.guep_status,
                                                                    )}
                                                                </Badge>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    asChild
                                                                >
                                                                    <Link
                                                                        href={`/transport/interviews/${item.id}`}
                                                                    >
                                                                        Ver
                                                                    </Link>
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <div className="space-y-4">
                                <Card className="transport-insight-card">
                                    <CardHeader>
                                        <CardTitle className="transport-dashboard-section-title">Atalhos operacionais</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <Button variant="outline" className="w-full justify-start" asChild>
                                            <Link href="/transport/payroll/launch">Lançar pagamentos</Link>
                                        </Button>
                                        <Button variant="outline" className="w-full justify-start" asChild>
                                            <Link href="/transport/payroll/list">Lista de pagamentos</Link>
                                        </Button>
                                        <Button variant="outline" className="w-full justify-start" asChild>
                                            <Link href="/transport/freight/dashboard">Dashboard de fretes</Link>
                                        </Button>
                                        <Button variant="outline" className="w-full justify-start" asChild>
                                            <Link href="/transport/activity-log">Atividade do sistema</Link>
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card className="transport-insight-card">
                                    <CardHeader>
                                        <CardTitle className="transport-dashboard-section-title">Ações pendentes</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span>Vagas aguardando</span>
                                            <Badge variant="secondary">
                                                {
                                                    summary.pending_actions
                                                        .waiting_vacancy
                                                }
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Teste prático</span>
                                            <Badge variant="secondary">
                                                {
                                                    summary.pending_actions
                                                        .practical_test
                                                }
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>GUEP a fazer</span>
                                            <Badge variant="secondary">
                                                {
                                                    summary.pending_actions
                                                        .guep_to_do
                                                }
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between border-t pt-2">
                                            <span className="font-medium">
                                                Total pendente
                                            </span>
                                            <Badge>
                                                {summary.pending_actions.total}
                                            </Badge>
                                        </div>
                                        <Button className="mt-2 w-full" asChild>
                                            <Link href="/transport/interviews/create">
                                                <PlusSquare className="size-4" />
                                                Nova entrevista
                                            </Link>
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card className="transport-insight-card">
                                    <CardHeader>
                                        <CardTitle className="transport-dashboard-section-title">Atividade recente</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {summary.recent_activity.length ===
                                        0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                Sem atividades recentes.
                                            </p>
                                        ) : (
                                            <div className="space-y-3">
                                                {summary.recent_activity.map(
                                                    (activity) => (
                                                        <div
                                                            key={`${activity.id}-${activity.at}`}
                                                            className="text-sm"
                                                        >
                                                            <p className="font-medium">
                                                                {
                                                                    activity.full_name
                                                                }
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {activity.event}{' '}
                                                                •{' '}
                                                                {formatDateTimeBR(activity.at)}
                                                            </p>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </AdminLayout>
    );
}
