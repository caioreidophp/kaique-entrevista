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
import type { DashboardSummary } from '@/types/driver-interview';

function SummaryCard({
    title,
    value,
    icon,
}: {
    title: string;
    value: number;
    icon: React.ReactNode;
}) {
    return (
        <Card className="transition-colors hover:bg-muted/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                <span className="rounded-md bg-muted p-2">{icon}</span>
            </CardHeader>
            <CardContent>
                <p className="text-2xl font-semibold md:text-3xl">{value}</p>
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

    return (
        <AdminLayout title="Dashboard" active="dashboard">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Dashboard</h2>
                    <p className="text-sm text-muted-foreground">
                        Resumo das entrevistas de motoristas.
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
                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
                                icon={
                                    <CheckCircle2 className="size-4 text-muted-foreground" />
                                }
                            />
                            <SummaryCard
                                title="Total reprovados"
                                value={summary.total_reproved}
                                icon={
                                    <XCircle className="size-4 text-muted-foreground" />
                                }
                            />
                            <SummaryCard
                                title="Aguardando vaga"
                                value={summary.total_waiting_vacancy}
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
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle>Últimas entrevistas</CardTitle>
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
                                            Nenhuma entrevista recente.
                                        </p>
                                    ) : (
                                        <div className="space-y-3">
                                            {summary.recent_interviews.map(
                                                (item) => (
                                                    <div
                                                        key={item.id}
                                                        className="rounded-md border p-3"
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
                                                                <Badge variant="secondary">
                                                                    {hrStatusLabel(
                                                                        item.hr_status,
                                                                    )}
                                                                </Badge>
                                                                <Badge variant="outline">
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
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Ações pendentes</CardTitle>
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

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Atividade recente</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {summary.recent_activity.length ===
                                        0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                Sem atividade recente.
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
                                                                {new Date(
                                                                    activity.at,
                                                                ).toLocaleString(
                                                                    'pt-BR',
                                                                )}
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
