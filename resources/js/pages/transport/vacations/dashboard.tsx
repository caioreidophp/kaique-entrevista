import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet } from '@/lib/api-client';
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
    percentual_com_abono: number;
    percentual_sem_abono: number;
    taxa_vencidas_sobre_ativos: number;
}

export default function VacationsDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<VacationDashboard | null>(null);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    useEffect(() => {
        apiGet<WrappedResponse<VacationDashboard>>('/payroll/vacations/dashboard')
            .then((response) => setData(response.data))
            .catch(() =>
                setNotification({
                    message: 'Não foi possível carregar o dashboard de férias.',
                    variant: 'error',
                }),
            )
            .finally(() => setLoading(false));
    }, []);

    return (
        <AdminLayout
            title="Controle de Férias - Dashboard"
            active="vacations-dashboard"
            module="vacations"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Controle de Férias - Dashboard</h2>
                    <p className="text-sm text-muted-foreground">
                        Visão geral de vencimentos, prazos e distribuição de férias com e sem abono.
                    </p>
                </div>

                {notification ? (
                    <Notification message={notification.message} variant={notification.variant} />
                ) : null}

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando dashboard...
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-muted-foreground">Férias vencidas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-semibold text-destructive">{formatIntegerBR(data?.ferias_vencidas ?? 0)}</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-muted-foreground">Férias a vencer</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-semibold">{formatIntegerBR(data?.ferias_a_vencer ?? 0)}</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-muted-foreground">Faixa: À Vencer</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-semibold text-sky-700">{formatIntegerBR(data?.faixa_a_vencer ?? 0)}</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-muted-foreground">Faixa: Liberada</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-semibold text-emerald-700">{formatIntegerBR(data?.faixa_liberada ?? 0)}</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-muted-foreground">Faixa: Atenção</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-semibold text-amber-700">{formatIntegerBR(data?.faixa_atencao ?? 0)}</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-muted-foreground">Faixa: Urgente</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-semibold text-orange-700">{formatIntegerBR(data?.faixa_urgente ?? 0)}</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-muted-foreground">Limite próximos 4 meses</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-semibold">{formatIntegerBR(data?.limite_proximos_4_meses ?? 0)}</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-muted-foreground">Programadas 30 dias</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-semibold">{formatIntegerBR(data?.ferias_programadas_30_dias ?? 0)}</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-muted-foreground">Taxa de vencidas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-semibold text-destructive">{formatPercentBR(data?.taxa_vencidas_sobre_ativos ?? 0)}</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-muted-foreground">Lançamentos no ano</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-semibold">{formatIntegerBR(data?.lancamentos_ano_atual ?? 0)}</p>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
