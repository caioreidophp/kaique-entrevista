import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { apiGet } from '@/lib/api-client';

interface Unidade {
    id: number;
    nome: string;
}

interface UnitReport {
    total_pago_mes: number;
    colaboradores_pagos: number;
    media_salarial: number;
    distribuicao: Array<{ faixa: string; quantidade: number }>;
    evolucao_mensal: Array<{
        competencia_ano: number;
        competencia_mes: number;
        total_valor: number;
        total_lancamentos: number;
    }>;
}

interface WrappedResponse<T> {
    data: T;
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
}

export default function TransportPayrollReportUnitPage() {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const [unidades, setUnidades] = useState<Unidade[]>([]);
    const [unidadeId, setUnidadeId] = useState('');
    const [month, setMonth] = useState(String(currentMonth));
    const [year, setYear] = useState(String(currentYear));
    const [report, setReport] = useState<UnitReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const monthOptions = useMemo(
        () => [
            { value: '1', label: 'Janeiro' },
            { value: '2', label: 'Fevereiro' },
            { value: '3', label: 'Março' },
            { value: '4', label: 'Abril' },
            { value: '5', label: 'Maio' },
            { value: '6', label: 'Junho' },
            { value: '7', label: 'Julho' },
            { value: '8', label: 'Agosto' },
            { value: '9', label: 'Setembro' },
            { value: '10', label: 'Outubro' },
            { value: '11', label: 'Novembro' },
            { value: '12', label: 'Dezembro' },
        ],
        [],
    );

    const yearOptions = useMemo(
        () => [
            String(currentYear - 1),
            String(currentYear),
            String(currentYear + 1),
        ],
        [currentYear],
    );

    async function loadUnits(): Promise<void> {
        try {
            const response =
                await apiGet<WrappedResponse<Unidade[]>>('/registry/unidades');
            setUnidades(response.data);
            if (!unidadeId && response.data.length) {
                setUnidadeId(String(response.data[0].id));
            }
        } catch {
            setNotification({
                message: 'Não foi possível carregar unidades.',
                variant: 'error',
            });
        }
    }

    async function loadReport(): Promise<void> {
        if (!unidadeId) return;

        setLoading(true);
        setNotification(null);

        try {
            const response = await apiGet<UnitReport>(
                `/payroll/reports/unidade?unidade_id=${unidadeId}&competencia_mes=${month}&competencia_ano=${year}`,
            );
            setReport(response);
        } catch {
            setNotification({
                message: 'Não foi possível carregar o relatório por unidade.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadUnits();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (unidadeId) void loadReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unidadeId, month, year]);

    return (
        <AdminLayout
            title="Pagamentos - Relatório por Unidade"
            active="payroll-report-unit"
            module="payroll"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">
                        Relatório por Unidade
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Métricas de pagamentos, distribuição e evolução mensal
                        por unidade.
                    </p>
                </div>

                {notification ? (
                    <Notification
                        message={notification.message}
                        variant={notification.variant}
                    />
                ) : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label>Unidade</Label>
                                <Select
                                    value={unidadeId}
                                    onValueChange={setUnidadeId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {unidades.map((u) => (
                                            <SelectItem
                                                key={u.id}
                                                value={String(u.id)}
                                            >
                                                {u.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Mês</Label>
                                <Select value={month} onValueChange={setMonth}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {monthOptions.map((m) => (
                                            <SelectItem
                                                key={m.value}
                                                value={m.value}
                                            >
                                                {m.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Ano</Label>
                                <Select value={year} onValueChange={setYear}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {yearOptions.map((y) => (
                                            <SelectItem key={y} value={y}>
                                                {y}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button
                                variant="outline"
                                onClick={() => void loadReport()}
                            >
                                Atualizar relatório
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando relatório...
                    </div>
                ) : report ? (
                    <>
                        <div className="grid gap-4 md:grid-cols-3">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Total pago no mês
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {formatCurrency(report.total_pago_mes)}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Colaboradores pagos
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {report.colaboradores_pagos}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Média salarial
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {formatCurrency(report.media_salarial)}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Distribuição (faixas)</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {report.distribuicao.map((item) => (
                                        <div
                                            key={item.faixa}
                                            className="rounded-md border p-3 text-sm"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span>{item.faixa}</span>
                                                <span className="font-semibold">
                                                    {item.quantidade}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Evolução mensal</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {report.evolucao_mensal.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Sem histórico para exibir.
                                        </p>
                                    ) : (
                                        report.evolucao_mensal.map((item) => (
                                            <div
                                                key={`${item.competencia_ano}-${item.competencia_mes}`}
                                                className="rounded-md border p-3 text-sm"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span>
                                                        {String(
                                                            item.competencia_mes,
                                                        ).padStart(2, '0')}
                                                        /{item.competencia_ano}
                                                    </span>
                                                    <span className="font-semibold">
                                                        {formatCurrency(
                                                            item.total_valor,
                                                        )}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {item.total_lancamentos}{' '}
                                                    lançamento(s)
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
