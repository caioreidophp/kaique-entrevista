import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet } from '@/lib/api-client';
import { formatCurrencyBR } from '@/lib/transport-format';

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

function formatPercent(value: number): string {
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value ?? 0)}%`;
}

export default function TransportExecutiveDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ExecutiveInsightsResponse['data'] | null>(null);

    useEffect(() => {
        apiGet<ExecutiveInsightsResponse>('/insights/executive')
            .then((response) => setData(response.data))
            .catch(() => setError('Não foi possível carregar o dashboard executivo.'))
            .finally(() => setLoading(false));
    }, []);

    return (
        <AdminLayout title="Dashboard Executivo" active="executive-dashboard" module="home">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Dashboard Executivo</h2>
                    <p className="text-sm text-muted-foreground">
                        KPIs consolidados de Entrevistas, Folha e Fretes com alertas operacionais.
                    </p>
                </div>

                {error ? <Notification message={error} variant="error" /> : null}

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando indicadores executivos...
                    </div>
                ) : data ? (
                    <>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">Aprovação em entrevistas</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">{formatPercent(data.interviews.approval_rate)}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {data.interviews.approved} aprovados de {data.interviews.total} entrevistas.
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">Total da folha no mês</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">{formatCurrencyBR(data.payroll.total)}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Cobertura da folha: {formatPercent(data.payroll.coverage_rate)}
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">Frete total no mês</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">{formatCurrencyBR(data.freight.total)}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Spot: {formatCurrencyBR(data.freight.spot_total)} ({formatPercent(data.freight.spot_share)})
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Alertas</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {data.alerts.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sem alertas críticos na competência atual.</p>
                                ) : (
                                    data.alerts.map((alert, index) => (
                                        <div key={`${alert.title}-${index}`} className="rounded-md border p-3">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="mt-0.5 size-4 text-amber-600" />
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
                    </>
                ) : null}
            </div>
        </AdminLayout>
    );
}
