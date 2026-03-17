import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiGet } from '@/lib/api-client';
import { formatCurrencyBR } from '@/lib/transport-format';
import type { FreightOperationalReportResponse } from '@/types/freight';

export default function TransportFreightOperationalReportPage() {
    const currentYear = new Date().getFullYear();
    const [month, setMonth] = useState(String(new Date().getMonth() + 1));
    const [year, setYear] = useState(String(currentYear));
    const [data, setData] = useState<FreightOperationalReportResponse | null>(null);
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

    function handleMonthChange(value: string): void {
        setLoading(true);
        setError(null);
        setMonth(value);
    }

    function handleYearChange(value: string): void {
        setLoading(true);
        setError(null);
        setYear(value);
    }

    useEffect(() => {
        apiGet<FreightOperationalReportResponse>(`/freight/operational-report?competencia_mes=${month}&competencia_ano=${year}`)
            .then((response) => setData(response))
            .catch(() => setError('Não foi possível carregar o relatório operacional.'))
            .finally(() => setLoading(false));
    }, [month, year]);

    return (
        <AdminLayout title="Gestão de Fretes - Relatório Operacional" active="freight-operational-report" module="freight">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Relatório Operacional de Fretes</h2>
                    <p className="text-sm text-muted-foreground">Consolidação por Abatedouro, Frota (Dentro/Fora) e visão geral Kaique.</p>
                </div>

                {error ? <Notification message={error} variant="error" /> : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Competência</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2">
                        <Select value={month} onValueChange={handleMonthChange}>
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
                        <Select value={year} onValueChange={handleYearChange}>
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
                    </CardContent>
                </Card>

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando relatório...
                    </div>
                ) : data ? (
                    <>
                        <div className="grid gap-3 md:grid-cols-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-muted-foreground">Total Abatedouro</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg font-semibold">{formatCurrencyBR(data.geral_kaique.total_abatedouro)}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-muted-foreground">Frota Dentro</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg font-semibold">{formatCurrencyBR(data.geral_kaique.frota_dentro)}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-muted-foreground">Frota Fora</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg font-semibold">{formatCurrencyBR(data.geral_kaique.frota_fora)}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm text-muted-foreground">Total Frota</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg font-semibold">{formatCurrencyBR(data.geral_kaique.total_frota)}</p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Visão por Abatedouro</CardTitle>
                            </CardHeader>
                            <CardContent className="overflow-x-auto">
                                <table className="w-full min-w-[760px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-2 pr-3 font-medium">Unidade</th>
                                            <th className="py-2 pr-3 font-medium">Frota no abatedouro</th>
                                            <th className="py-2 pr-3 font-medium">Terceiros no abatedouro</th>
                                            <th className="py-2 pr-3 font-medium">Total abatedouro</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.abatedouro.map((item) => (
                                            <tr key={item.unidade_id} className="border-b last:border-b-0">
                                                <td className="py-2 pr-3">{item.unidade_nome ?? '-'}</td>
                                                <td className="py-2 pr-3">{formatCurrencyBR(item.frota_no_abatedouro)}</td>
                                                <td className="py-2 pr-3">{formatCurrencyBR(item.terceiros_no_abatedouro)}</td>
                                                <td className="py-2 pr-3 font-semibold">{formatCurrencyBR(item.total_abatedouro)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Visão Frota (Dentro/Fora)</CardTitle>
                            </CardHeader>
                            <CardContent className="overflow-x-auto">
                                <table className="w-full min-w-[760px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-2 pr-3 font-medium">Frota</th>
                                            <th className="py-2 pr-3 font-medium">Dentro</th>
                                            <th className="py-2 pr-3 font-medium">Fora (Spot)</th>
                                            <th className="py-2 pr-3 font-medium">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.frota.map((item) => (
                                            <tr key={item.unidade_id} className="border-b last:border-b-0">
                                                <td className="py-2 pr-3">{item.unidade_nome ?? '-'}</td>
                                                <td className="py-2 pr-3">{formatCurrencyBR(item.dentro)}</td>
                                                <td className="py-2 pr-3">{formatCurrencyBR(item.fora)}</td>
                                                <td className="py-2 pr-3 font-semibold">{formatCurrencyBR(item.total_frota)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    </>
                ) : null}
            </div>
        </AdminLayout>
    );
}
