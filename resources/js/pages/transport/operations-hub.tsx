import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet } from '@/lib/api-client';
import { formatIntegerBR } from '@/lib/transport-format';

interface PendingInsightsResponse {
    data: {
        interviews: {
            waiting_vacancy: number;
            practical_test: number;
            guep_to_do: number;
            total: number;
        };
        vacations: {
            expired: number;
            due_2_months: number;
        };
        freight: {
            canceled_to_receive: number;
        };
        payroll: {
            pending_collaborators: number;
        };
    };
}

function PendingCard({
    title,
    description,
    value,
}: {
    title: string;
    description: string;
    value: number;
}) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
                <p className="text-xs text-muted-foreground">{description}</p>
            </CardHeader>
            <CardContent>
                <p className="text-2xl font-semibold">{formatIntegerBR(value)}</p>
            </CardContent>
        </Card>
    );
}

export default function TransportOperationsHubPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<PendingInsightsResponse['data'] | null>(null);

    useEffect(() => {
        apiGet<PendingInsightsResponse>('/insights/pending')
            .then((response) => setData(response.data))
            .catch(() => setError('Não foi possível carregar o hub operacional.'))
            .finally(() => setLoading(false));
    }, []);

    const totalPending = useMemo(() => {
        if (!data) return 0;

        return (
            data.interviews.total +
            data.vacations.expired +
            data.vacations.due_2_months +
            data.freight.canceled_to_receive +
            data.payroll.pending_collaborators
        );
    }, [data]);

    return (
        <AdminLayout title="Pendências" active="operations-hub" module="home">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Pendências</h2>
                    <p className="text-sm text-muted-foreground">
                        Central de pendências críticas do dia a dia para priorização rápida.
                    </p>
                </div>

                {error ? <Notification message={error} variant="error" /> : null}

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando pendências...
                    </div>
                ) : data ? (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle>Total de pendências</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">{formatIntegerBR(totalPending)}</p>
                            </CardContent>
                        </Card>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <PendingCard
                                title="Entrevistas pendentes"
                                description="Candidatos aguardando avanço de etapa no funil de entrevistas."
                                value={data.interviews.total}
                            />
                            <PendingCard
                                title="Férias vencidas"
                                description="Períodos de férias já vencidos e ainda não lançados."
                                value={data.vacations.expired}
                            />
                            <PendingCard
                                title="Férias até 2 meses"
                                description="Colaboradores que entram na janela próxima para programação de férias."
                                value={data.vacations.due_2_months}
                            />
                            <PendingCard
                                title="Cargas a receber"
                                description="Cargas canceladas aguardando faturamento/recebimento."
                                value={data.freight.canceled_to_receive}
                            />
                            <PendingCard
                                title="Folha sem lançamento"
                                description="Colaboradores ativos sem pagamento lançado na competência atual."
                                value={data.payroll.pending_collaborators}
                            />
                            <PendingCard
                                title="GUEP a fazer"
                                description="Entrevistas com status de GUEP ainda pendente de execução."
                                value={data.interviews.guep_to_do}
                            />
                        </div>
                    </>
                ) : null}
            </div>
        </AdminLayout>
    );
}
