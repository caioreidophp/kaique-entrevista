import { Link } from '@inertiajs/react';
import {
    ArrowRight,
    CheckCircle2,
    Clock3,
    FileText,
    LoaderCircle,
    PlusSquare,
    TestTube2,
    TrendingUp,
    XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
            className={`transport-kpi-card py-0 transition-transform duration-150 hover:-translate-y-0.5 ${tone ? `transport-kpi-soft-${tone}` : ''}`}
        >
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 py-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                <span className="transport-kpi-icon">{icon}</span>
            </CardHeader>
            <CardContent className="py-5">
                <p className="transport-kpi-value md:text-3xl">{value}</p>
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
        let active = true;

        apiGet<DashboardSummary>('/dashboard/summary')
            .then((response) => {
                if (active) {
                    setSummary(response);
                }
            })
            .catch(() => {
                if (active) {
                    setError('Não foi possível carregar os indicadores.');
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });

        return () => {
            active = false;
        };
    }, []);

    const approvalRate = useMemo(() => {
        if (!summary || summary.total_interviews === 0) {
            return 0;
        }

        return (summary.total_approved / summary.total_interviews) * 100;
    }, [summary]);

    return (
        <AdminLayout title="Dashboard" active="dashboard">
            <div className="space-y-6">
                <section className="transport-surface overflow-hidden">
                    <div className="grid gap-6 p-6 xl:grid-cols-[1.25fr_0.95fr]">
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <span className="transport-chip">Recrutamento</span>
                                <span className="transport-chip">Entrevistas de motoristas</span>
                            </div>
                            <div className="space-y-2">
                                <h2 className="transport-section-title">
                                    Pipeline de contratação com leitura rápida de avanço e gargalos.
                                </h2>
                                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                                    Uma visão consolidada do funil de entrevistas, aprovações,
                                    pendências e atividade recente para acelerar decisão de RH e operação.
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                            <div className="rounded-xl border border-border/75 bg-muted/25 p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Taxa de aprovação
                                </p>
                                <p className="mt-3 text-3xl font-semibold">
                                    {formatPercentBR(approvalRate)}
                                </p>
                            </div>
                            <div className="rounded-xl border border-border/75 bg-muted/25 p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Pendências totais
                                </p>
                                <p className="mt-3 text-3xl font-semibold">
                                    {summary?.pending_actions.total ?? 0}
                                </p>
                            </div>
                            <div className="rounded-xl border border-border/75 bg-muted/25 p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Aguardando vaga
                                </p>
                                <p className="mt-3 text-3xl font-semibold">
                                    {summary?.pending_actions.waiting_vacancy ?? 0}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {error ? <Notification message={error} variant="error" /> : null}

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando indicadores...
                    </div>
                ) : summary ? (
                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                            <SummaryCard
                                title="Total de entrevistas"
                                value={summary.total_interviews}
                                icon={<FileText className="size-4 text-muted-foreground" />}
                            />
                            <SummaryCard
                                title="Total aprovados"
                                value={summary.total_approved}
                                tone="success"
                                icon={<CheckCircle2 className="size-4 text-muted-foreground" />}
                            />
                            <SummaryCard
                                title="Total reprovados"
                                value={summary.total_reproved}
                                tone="danger"
                                icon={<XCircle className="size-4 text-muted-foreground" />}
                            />
                            <SummaryCard
                                title="Aguardando vaga"
                                value={summary.total_waiting_vacancy}
                                tone="warning"
                                icon={<Clock3 className="size-4 text-muted-foreground" />}
                            />
                            <SummaryCard
                                title="Teste prático"
                                value={summary.total_practical_test}
                                icon={<TestTube2 className="size-4 text-muted-foreground" />}
                            />
                            <SummaryCard
                                title="GUEP pendente"
                                value={summary.pending_actions.guep_to_do}
                                tone="info"
                                icon={<TrendingUp className="size-4 text-muted-foreground" />}
                            />
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[1.55fr_0.95fr]">
                            <Card className="transport-surface py-0">
                                <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 py-5">
                                    <div>
                                        <p className="transport-section-label">Últimas movimentações</p>
                                        <CardTitle className="mt-2">Últimas entrevistas</CardTitle>
                                    </div>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href="/transport/interviews">
                                            Ver todas
                                            <ArrowRight className="size-4" />
                                        </Link>
                                    </Button>
                                </CardHeader>
                                <CardContent className="space-y-3 py-5">
                                    {summary.recent_interviews.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Nenhuma entrevista recente.
                                        </p>
                                    ) : (
                                        summary.recent_interviews.map((item) => (
                                            <div
                                                key={item.id}
                                                className="rounded-xl border border-border/80 bg-muted/15 p-4"
                                            >
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div className="space-y-1">
                                                        <p className="font-semibold">{item.full_name}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {item.city} • {item.author_name ?? 'Sem entrevistador'}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge className={`transport-status-badge ${hrStatusBadgeClass(item.hr_status)}`}>
                                                            {hrStatusLabel(item.hr_status)}
                                                        </Badge>
                                                        <Badge className={`transport-status-badge ${guepStatusBadgeClass(item.guep_status)}`}>
                                                            {guepStatusLabel(item.guep_status)}
                                                        </Badge>
                                                        <Button size="sm" variant="outline" asChild>
                                                            <Link href={`/transport/interviews/${item.id}`}>
                                                                Ver
                                                            </Link>
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>

                            <div className="space-y-4">
                                <Card className="transport-surface py-0">
                                    <CardHeader className="border-b border-border/70 py-5">
                                        <p className="transport-section-label">Atalhos</p>
                                        <CardTitle className="mt-2">Ações operacionais</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 py-5 text-sm">
                                        <Button variant="outline" className="w-full justify-between" asChild>
                                            <Link href="/transport/payroll/launch">
                                                Lançar pagamentos
                                                <ArrowRight className="size-4" />
                                            </Link>
                                        </Button>
                                        <Button variant="outline" className="w-full justify-between" asChild>
                                            <Link href="/transport/payroll/list">
                                                Lista de pagamentos
                                                <ArrowRight className="size-4" />
                                            </Link>
                                        </Button>
                                        <Button variant="outline" className="w-full justify-between" asChild>
                                            <Link href="/transport/freight/dashboard">
                                                Dashboard de fretes
                                                <ArrowRight className="size-4" />
                                            </Link>
                                        </Button>
                                        <Button variant="outline" className="w-full justify-between" asChild>
                                            <Link href="/transport/activity-log">
                                                Atividade do sistema
                                                <ArrowRight className="size-4" />
                                            </Link>
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card className="transport-surface py-0">
                                    <CardHeader className="border-b border-border/70 py-5">
                                        <p className="transport-section-label">Fila de ação</p>
                                        <CardTitle className="mt-2">Ações pendentes</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 py-5 text-sm">
                                        <div className="transport-metric-row">
                                            <span>Vagas aguardando</span>
                                            <Badge variant="secondary">
                                                {summary.pending_actions.waiting_vacancy}
                                            </Badge>
                                        </div>
                                        <div className="transport-metric-row">
                                            <span>Teste prático</span>
                                            <Badge variant="secondary">
                                                {summary.pending_actions.practical_test}
                                            </Badge>
                                        </div>
                                        <div className="transport-metric-row">
                                            <span>GUEP a fazer</span>
                                            <Badge variant="secondary">
                                                {summary.pending_actions.guep_to_do}
                                            </Badge>
                                        </div>
                                        <div className="transport-metric-row border-border/80 bg-muted/20">
                                            <span className="font-medium">Total pendente</span>
                                            <Badge>{summary.pending_actions.total}</Badge>
                                        </div>
                                        <Button className="mt-2 w-full justify-between" asChild>
                                            <Link href="/transport/interviews/create">
                                                Nova entrevista
                                                <PlusSquare className="size-4" />
                                            </Link>
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card className="transport-surface py-0">
                                    <CardHeader className="border-b border-border/70 py-5">
                                        <p className="transport-section-label">Feed</p>
                                        <CardTitle className="mt-2">Atividade recente</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 py-5">
                                        {summary.recent_activity.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                Sem atividade recente.
                                            </p>
                                        ) : (
                                            summary.recent_activity.map((activity) => (
                                                <div
                                                    key={`${activity.id}-${activity.at}`}
                                                    className="rounded-lg border border-border/75 bg-muted/15 p-3 text-sm"
                                                >
                                                    <p className="font-medium">{activity.full_name}</p>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {activity.event} • {formatDateTimeBR(activity.at)}
                                                    </p>
                                                </div>
                                            ))
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
