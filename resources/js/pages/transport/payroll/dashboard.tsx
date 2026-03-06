import { LoaderCircle, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet } from '@/lib/api-client';

interface DashboardPagamento {
    id: number;
    competencia_mes: number;
    competencia_ano: number;
    valor: string;
    colaborador?: { nome: string };
    unidade?: { nome: string };
}

interface PayrollDashboard {
    competencia_mes: number;
    competencia_ano: number;
    total_pagamentos_a_fazer: number;
    total_pagamentos_lancados: number;
    colaboradores_ativos: number;
    total_a_pagar_mes_atual: number;
    totais_por_unidade: Array<{
        unidade_id: number;
        unidade_nome: string | null;
        total_lancamentos: number;
        total_valor: number;
    }>;
    pagamentos_recentes: DashboardPagamento[];
}

function formatCurrency(value: number | string): string {
    const numeric = typeof value === 'string' ? Number(value) : value;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(Number.isFinite(numeric) ? numeric : 0);
}

export default function TransportPayrollDashboardPage() {
    const [data, setData] = useState<PayrollDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiGet<PayrollDashboard>('/payroll/dashboard')
            .then((response) => setData(response))
            .catch(() =>
                setError('Não foi possível carregar o dashboard de salários.'),
            )
            .finally(() => setLoading(false));
    }, []);

    const monthLabel = useMemo(() => {
        if (!data) return '';
        return `${String(data.competencia_mes).padStart(2, '0')}/${data.competencia_ano}`;
    }, [data]);

    return (
        <AdminLayout
            title="Salários - Dashboard"
            active="payroll-dashboard"
            module="payroll"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">
                        Dashboard Salários
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Visão geral dos pagamentos da competência atual{' '}
                        {monthLabel ? `(${monthLabel})` : ''}.
                    </p>
                </div>

                {error ? (
                    <Notification message={error} variant="error" />
                ) : null}

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando dashboard...
                    </div>
                ) : data ? (
                    <>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Pagamentos a fazer
                                    </CardTitle>
                                    <Wallet className="size-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {data.total_pagamentos_a_fazer}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Pagamentos lançados
                                    </CardTitle>
                                    <Wallet className="size-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {data.total_pagamentos_lancados}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Colaboradores ativos
                                    </CardTitle>
                                    <Wallet className="size-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {data.colaboradores_ativos}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Total a pagar (mês)
                                    </CardTitle>
                                    <Wallet className="size-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {formatCurrency(
                                            data.total_a_pagar_mes_atual,
                                        )}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Totais por unidade</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {data.totais_por_unidade.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Sem lançamentos no período.
                                        </p>
                                    ) : (
                                        data.totais_por_unidade.map((item) => (
                                            <div
                                                key={item.unidade_id}
                                                className="flex items-center justify-between rounded-md border p-3 text-sm"
                                            >
                                                <div>
                                                    <p className="font-medium">
                                                        {item.unidade_nome ??
                                                            'Sem unidade'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.total_lancamentos}{' '}
                                                        lançamentos
                                                    </p>
                                                </div>
                                                <p className="font-semibold">
                                                    {formatCurrency(
                                                        item.total_valor,
                                                    )}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Pagamentos recentes</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {data.pagamentos_recentes.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Sem pagamentos recentes.
                                        </p>
                                    ) : (
                                        data.pagamentos_recentes.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between rounded-md border p-3 text-sm"
                                            >
                                                <div>
                                                    <p className="font-medium">
                                                        {item.colaborador
                                                            ?.nome ?? '-'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.unidade?.nome ??
                                                            '-'}{' '}
                                                        •{' '}
                                                        {String(
                                                            item.competencia_mes,
                                                        ).padStart(2, '0')}
                                                        /{item.competencia_ano}
                                                    </p>
                                                </div>
                                                <p className="font-semibold">
                                                    {formatCurrency(item.valor)}
                                                </p>
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
