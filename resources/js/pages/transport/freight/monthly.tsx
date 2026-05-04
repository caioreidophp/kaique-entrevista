import { Link } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { apiGet } from '@/lib/api-client';
import { formatCurrencyBR, formatIntegerBR } from '@/lib/transport-format';
import type { FreightMonthlyResponse, FreightUnit } from '@/types/freight';

interface WrappedResponse<T> {
    data: T;
}

export default function TransportFreightMonthlyPage() {
    const currentYear = new Date().getFullYear();
    const [month, setMonth] = useState(String(new Date().getMonth() + 1));
    const [year, setYear] = useState(String(currentYear));
    const [unidadeId, setUnidadeId] = useState('all');

    const [unidades, setUnidades] = useState<FreightUnit[]>([]);
    const [report, setReport] = useState<FreightMonthlyResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
        () => [String(currentYear - 1), String(currentYear), String(currentYear + 1)],
        [currentYear],
    );

    useEffect(() => {
        apiGet<WrappedResponse<FreightUnit[]>>('/registry/unidades')
            .then((response) => setUnidades(response.data))
            .catch(() => setError('Não foi possível carregar as unidades.'));
    }, []);

    useEffect(() => {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
            competencia_mes: month,
            competencia_ano: year,
        });

        if (unidadeId !== 'all') {
            params.set('unidade_id', unidadeId);
        }

        apiGet<FreightMonthlyResponse>(`/freight/monthly-unit-report?${params.toString()}`)
            .then((response) => setReport(response))
            .catch(() => setError('Não foi possível carregar o relatório mensal.'))
            .finally(() => setLoading(false));
    }, [month, year, unidadeId]);

    return (
        <AdminLayout
            title="Gestão de Fretes - Análise Mensal"
            active="freight-monthly"
            module="freight"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Análise mensal por unidade</h2>
                    <p className="text-sm text-muted-foreground">
                        Métricas consolidadas de produtividade e eficiência por unidade no mês.
                    </p>
                    <div className="mt-2">
                        <Link
                            href="/transport/freight/fleet-size-config"
                            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                            Configurar frota mensal
                        </Link>
                    </div>
                </div>

                {error ? <Notification message={error} variant="error" /> : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-3">
                        <div>
                            <p className="mb-2 text-sm text-muted-foreground">Mês</p>
                            <Select value={month} onValueChange={setMonth}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {monthOptions.map((item) => (
                                        <SelectItem key={item.value} value={item.value}>
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <p className="mb-2 text-sm text-muted-foreground">Ano</p>
                            <Select value={year} onValueChange={setYear}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {yearOptions.map((item) => (
                                        <SelectItem key={item} value={item}>
                                            {item}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <p className="mb-2 text-sm text-muted-foreground">Unidade</p>
                            <Select value={unidadeId} onValueChange={setUnidadeId}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {unidades.map((unidade) => (
                                        <SelectItem key={unidade.id} value={String(unidade.id)}>
                                            {unidade.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Indicadores mensais</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando análise...
                            </div>
                        ) : !report || report.data.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Sem dados para os filtros selecionados.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {report.data.map((item) => (
                                    <div key={item.unidade_id} className="rounded-lg border p-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xl font-semibold">
                                                {item.unidade_nome ?? 'Sem unidade'}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {formatIntegerBR(item.dias_trabalhados)} dia(s)
                                            </p>
                                        </div>
                                        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                            <div className="rounded-md border bg-muted/20 p-3">
                                                <p className="text-xs text-muted-foreground">Frete total</p>
                                                <p className="text-xl font-semibold">
                                                    {formatCurrencyBR(item.total_frete)}
                                                </p>
                                            </div>
                                            <div className="rounded-md border bg-muted/20 p-3">
                                                <p className="text-xs text-muted-foreground">Frete líquido</p>
                                                <p className="text-xl font-semibold">
                                                    {formatCurrencyBR(item.total_frete_liquido)}
                                                </p>
                                            </div>
                                            <div className="rounded-md border bg-muted/20 p-3">
                                                <p className="text-xs text-muted-foreground">Total KM</p>
                                                <p className="text-xl font-semibold">
                                                    {formatIntegerBR(item.total_km_rodado)}
                                                </p>
                                            </div>
                                            <div className="rounded-md border bg-muted/20 p-3">
                                                <p className="text-xs text-muted-foreground">Aves transportadas</p>
                                                <p className="text-xl font-semibold">
                                                    {formatIntegerBR(item.total_aves_transportadas)}
                                                </p>
                                            </div>
                                            <div className="rounded-md border bg-muted/20 p-3">
                                                <p className="text-xs text-muted-foreground">
                                                    Frete médio por caminhão trabalhado
                                                </p>
                                                <p className="text-xl font-semibold">
                                                    {formatCurrencyBR(item.frete_medio_por_caminhao_trabalhado)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatIntegerBR(item.caminhoes_trabalhados)} caminhão(ões)
                                                </p>
                                            </div>
                                            <div className="rounded-md border bg-muted/20 p-3">
                                                <p className="text-xs text-muted-foreground">
                                                    Frete médio por caminhão da frota
                                                </p>
                                                {item.frota_informada ? (
                                                    <>
                                                        <p className="text-xl font-semibold">
                                                            {formatCurrencyBR(item.frete_medio_por_caminhao_frota ?? 0)}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Frota cadastrada: {formatIntegerBR(item.frota_cadastrada ?? 0)}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="text-sm font-medium text-amber-700">
                                                        Não informado
                                                    </p>
                                                )}
                                            </div>
                                            <div className="rounded-md border bg-muted/20 p-3">
                                                <p className="text-xs text-muted-foreground">
                                                    Frete por dia trabalhado
                                                </p>
                                                <p className="text-xl font-semibold">
                                                    {formatCurrencyBR(item.frete_por_dia_trabalhado)}
                                                </p>
                                            </div>
                                            <div className="rounded-md border bg-muted/20 p-3">
                                                <p className="text-xs text-muted-foreground">Média R$/KM</p>
                                                <p className="text-xl font-semibold">
                                                    {formatCurrencyBR(item.media_reais_por_km)}
                                                </p>
                                            </div>
                                            <div className="rounded-md border bg-muted/20 p-3">
                                                <p className="text-xs text-muted-foreground">Média frete/KM</p>
                                                <p className="text-xl font-semibold">
                                                    {formatCurrencyBR(item.media_frete_por_km)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
