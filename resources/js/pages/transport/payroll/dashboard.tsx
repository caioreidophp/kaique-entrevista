import { AlertTriangle, CheckCircle2, LoaderCircle, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet } from '@/lib/api-client';
import { formatCurrencyBR, formatIntegerBR, formatPercentBR } from '@/lib/transport-format';

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

export default function TransportPayrollDashboardPage() {
    const [data, setData] = useState<PayrollDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiGet<PayrollDashboard>('/payroll/dashboard')
            .then((response) => setData(response))
            .catch(() =>
                setError('Não foi possível carregar o dashboard de pagamentos.'),
            )
            .finally(() => setLoading(false));
    }, []);

    const monthLabel = useMemo(() => {
        if (!data) return '';
        return `${String(data.competencia_mes).padStart(2, '0')}/${data.competencia_ano}`;
    }, [data]);

    const completionRate = useMemo(() => {
        if (!data || data.colaboradores_ativos === 0) return 0;
        return Math.round((data.total_pagamentos_lancados / data.colaboradores_ativos) * 100);
    }, [data]);

    const averageByLaunch = useMemo(() => {
        if (!data || data.total_pagamentos_lancados === 0) return 0;
        return data.total_a_pagar_mes_atual / data.total_pagamentos_lancados;
    }, [data]);

    const topUnit = useMemo(() => {
        if (!data || data.totais_por_unidade.length === 0) return null;

        return [...data.totais_por_unidade].sort((a, b) => b.total_valor - a.total_valor)[0] ?? null;
    }, [data]);

    const concentrationTopUnit = useMemo(() => {
        if (!data || !topUnit || data.total_a_pagar_mes_atual <= 0) return 0;
        return (topUnit.total_valor / data.total_a_pagar_mes_atual) * 100;
    }, [data, topUnit]);

    return (
        <AdminLayout
            title="Pagamentos - Dashboard"
            active="payroll-dashboard"
            module="payroll"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">
                        Dashboard Pagamentos
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
                                        Cobertura da folha
                                    </CardTitle>
                                    <Wallet className="size-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {formatPercentBR(completionRate, 0)}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Pendências da competência
                                    </CardTitle>
                                    <Wallet className="size-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {formatIntegerBR(data.total_pagamentos_a_fazer)}
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
                                        {formatCurrencyBR(
                                            data.total_a_pagar_mes_atual,
                                        )}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Ticket médio por lançamento
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">{formatCurrencyBR(averageByLaunch)}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Valor médio por lançamento registrado na competência.
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Colaboradores ativos
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">{formatIntegerBR(data.colaboradores_ativos)}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Base ativa usada para cálculo de cobertura e pendências.
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Unidade com maior volume
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg font-semibold">{topUnit?.unidade_nome ?? '-'}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {topUnit
                                            ? `${formatCurrencyBR(topUnit.total_valor)} • ${formatPercentBR(concentrationTopUnit)} do total do mês`
                                            : 'Sem dados no período.'}
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
                                                    {formatCurrencyBR(
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
                                                    {formatCurrencyBR(item.valor)}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Prioridades do mês</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="flex items-start gap-2 rounded-md border p-3">
                                        {data.total_pagamentos_a_fazer > 0 ? (
                                            <AlertTriangle className="mt-0.5 size-4 text-amber-600" />
                                        ) : (
                                            <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
                                        )}
                                        <div>
                                            <p className="font-medium">Pagamentos pendentes</p>
                                            <p className="text-xs text-muted-foreground">
                                                {data.total_pagamentos_a_fazer > 0
                                                    ? `${data.total_pagamentos_a_fazer} colaborador(es) ainda sem lançamento nesta competência.`
                                                    : 'Todos os colaboradores ativos possuem lançamento nesta competência.'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="rounded-md border p-3">
                                        <p className="font-medium">Monitoramento de fechamento</p>
                                        <p className="text-xs text-muted-foreground">
                                            Use a lista agrupada para imprimir por lançamento e validar o valor líquido antes do pagamento.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </>
                ) : null}
            </div>
        </AdminLayout>
    );
}
