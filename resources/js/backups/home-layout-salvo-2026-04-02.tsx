import { Link } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    CalendarClock,
    ClipboardCheck,
    ListChecks,
    LoaderCircle,
    Truck,
    Users,
    Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { apiGet } from '@/lib/api-client';
import { formatCurrencyBR, formatIntegerBR, formatPercentBR } from '@/lib/transport-format';

interface HomeModule {
    key:
        | 'interviews'
        | 'payroll'
        | 'registry'
        | 'freight'
        | 'vacations'
        | 'operations';
    title: string;
    description: string;
    href: string;
    icon: string;
    metrics: Record<string, number>;
}

interface HomeResponse {
    modules: HomeModule[];
    filters: {
        period_mode: '1m' | '3m' | 'month';
        competencia_mes: number;
        competencia_ano: number;
        payroll_competencia_mes: number;
        payroll_competencia_ano: number;
        month_options: Array<{
            value: string;
            label: string;
            mes: number;
            ano: number;
        }>;
        period_start: string;
        period_end: string;
    };
    super_dashboard: {
        freight: {
            cards: Array<{
                unidade_id: number;
                unidade_nome: string;
                total_valor: number;
                percentual_total: number;
            }>;
            company: {
                unidade_nome: string;
                total_valor: number;
                percentual_total: number;
            };
        } | null;
        vacations: {
            by_unit: Array<{
                unidade_id: number;
                unidade_nome: string;
                urgent_count: number;
                on_vacation: Array<{
                    colaborador_id: number;
                    nome: string;
                    data_inicio: string | null;
                    data_fim: string | null;
                }>;
            }>;
        } | null;
        payroll: {
            columns: Array<{
                key: string;
                label: string;
                tipo_pagamento_id: number | null;
            }>;
            rows: Array<{
                unidade_id: number;
                unidade_nome: string;
                values: Record<string, number>;
                total: number;
            }>;
            totals: {
                values: Record<string, number>;
                total: number;
            };
        } | null;
        interviews: {
            totals_by_unit: Array<{
                unidade_id: number;
                unidade_nome: string;
                total_entrevistas: number;
            }>;
            recent_admissions: Array<{
                id: number;
                nome: string;
                unidade_nome: string;
                funcao_nome: string;
                data: string | null;
            }>;
            recent_dismissals: Array<{
                id: number;
                nome: string;
                unidade_nome: string;
                funcao_nome: string;
                data: string | null;
            }>;
        } | null;
    };
}

const metricLabels: Record<string, string> = {
    total_interviews: 'Total de entrevistas',
    payments_current_month: 'Pagamentos no mês atual',
    total_current_month: 'Total no mês atual',
    payments_pending_current_month: 'Pagamentos pendentes',
    payments_coverage_current_month: 'Cobertura de pagamentos',
    active_collaborators: 'Colaboradores ativos',
    freight_entries_current_month: 'Lançamentos de frete no mês',
    freight_total_current_month: 'Frete total no mês',
    freight_avg_km_current_month: 'Média R$/KM no mês',
    freight_third_share_current_month: 'Participação de terceiros',
    vacations_expired: 'Férias vencidas',
    vacations_due_2_months: 'Limite próximos 2 meses',
    vacations_due_4_months: 'Limite próximos 4 meses',
    vacations_expired_rate: 'Taxa de férias vencidas',
    operations_pending_total: 'Pendências totais',
    executive_approval_rate: 'Taxa de aprovação',
};

function formatMetric(label: string, value: number): string {
    if (label.includes('approval_rate')) {
        return formatPercentBR(value);
    }

    if (label.includes('coverage') || label.includes('share') || label.includes('expired_rate')) {
        return formatPercentBR(value);
    }

    if (
        label.includes('total_current_month') ||
        label.includes('freight_total_current_month') ||
        label.includes('avg_km_current_month')
    ) {
        return formatCurrencyBR(value);
    }

    return formatIntegerBR(value);
}

function metricValueClass(label: string, value: number): string {
    if (label === 'vacations_expired' && value > 0) {
        return 'font-semibold text-destructive';
    }

    if (label === 'payments_pending_current_month' && value > 0) {
        return 'font-semibold text-amber-700';
    }

    if (label === 'freight_third_share_current_month' && value >= 35) {
        return 'font-semibold text-indigo-700';
    }

    return 'font-medium text-foreground';
}

function moduleIcon(key: HomeModule['key']) {
    if (key === 'interviews') return <ListChecks className="size-5" />;
    if (key === 'payroll') return <Wallet className="size-5" />;
    if (key === 'vacations') return <ClipboardCheck className="size-5" />;
    if (key === 'freight') return <Truck className="size-5" />;
    if (key === 'operations') return <ClipboardCheck className="size-5" />;
    return <Users className="size-5" />;
}

const ENABLE_CLASSIC_LAYOUT = false;

export default function TransportHomePage() {
    const [modules, setModules] = useState<HomeModule[]>([]);
    const [superDashboard, setSuperDashboard] = useState<HomeResponse['super_dashboard'] | null>(null);
    const [monthOptions, setMonthOptions] = useState<HomeResponse['filters']['month_options']>([]);
    const [periodMode, setPeriodMode] = useState<'1m' | '3m' | 'month'>('1m');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [payrollMonth, setPayrollMonth] = useState('');
    const [periodLabel, setPeriodLabel] = useState('');
    const [layoutMode, setLayoutMode] = useState<'classic' | 'super'>(() => {
        if (typeof window === 'undefined') return 'super';
        const persisted = window.localStorage.getItem('transport:home:layout');
        return persisted === 'classic' ? 'classic' : 'super';
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const effectiveLayoutMode: 'classic' | 'super' = ENABLE_CLASSIC_LAYOUT ? layoutMode : 'super';

    useEffect(() => {
        setLoading(true);
        setError(null);

        const query = new URLSearchParams();
        query.set('period_mode', periodMode);

        if (periodMode === 'month' && selectedMonth) {
            const [yearString, monthString] = selectedMonth.split('-');
            const year = Number(yearString);
            const month = Number(monthString);

            if (Number.isFinite(year) && Number.isFinite(month)) {
                query.set('competencia_ano', String(year));
                query.set('competencia_mes', String(month));
            }
        }

        if (payrollMonth) {
            const [yearString, monthString] = payrollMonth.split('-');
            const year = Number(yearString);
            const month = Number(monthString);

            if (Number.isFinite(year) && Number.isFinite(month)) {
                query.set('payroll_competencia_ano', String(year));
                query.set('payroll_competencia_mes', String(month));
            }
        }

        apiGet<HomeResponse>(`/home?${query.toString()}`)
            .then((response) => {
                setModules(response.modules);
                setSuperDashboard(response.super_dashboard);
                setMonthOptions(response.filters.month_options ?? []);

                const nextSelectedMonth = `${String(response.filters.competencia_ano)}-${String(response.filters.competencia_mes).padStart(2, '0')}`;
                if (!selectedMonth) {
                    setSelectedMonth(nextSelectedMonth);
                }

                const nextPayrollMonth = `${String(response.filters.payroll_competencia_ano)}-${String(response.filters.payroll_competencia_mes).padStart(2, '0')}`;
                if (!payrollMonth) {
                    setPayrollMonth(nextPayrollMonth);
                }

                const rangeStart = response.filters.period_start?.slice(0, 10) ?? '-';
                const rangeEnd = response.filters.period_end?.slice(0, 10) ?? '-';
                setPeriodLabel(`${rangeStart} até ${rangeEnd}`);
            })
            .catch(() =>
                setError('Não foi possível carregar os painéis da Home.'),
            )
            .finally(() => setLoading(false));
    }, [periodMode, selectedMonth, payrollMonth]);

    useEffect(() => {
        if (!ENABLE_CLASSIC_LAYOUT) return;
        if (typeof window === 'undefined') return;
        window.localStorage.setItem('transport:home:layout', layoutMode);
    }, [layoutMode]);

    const visibleModules = modules.filter((module) => module.key !== 'operations');
    const freightChartColumns = superDashboard?.freight
        ? [
              ...superDashboard.freight.cards.map((card) => ({
                  unidade_id: card.unidade_id,
                  unidade_nome: card.unidade_nome,
                  total_valor: card.total_valor,
                  percentual_total: card.percentual_total,
                  is_company: false,
              })),
              {
                  unidade_id: 0,
                  unidade_nome: superDashboard.freight.company.unidade_nome,
                  total_valor: superDashboard.freight.company.total_valor,
                  percentual_total: superDashboard.freight.company.percentual_total,
                  is_company: true,
              },
          ]
        : [];
    const freightChartMax =
        freightChartColumns.length > 0
            ? Math.max(...freightChartColumns.map((item) => item.total_valor), 1)
            : 1;
    const freightOnlyUnits = superDashboard?.freight?.cards ?? [];
    const freightTopUnit = freightOnlyUnits.reduce<
        | {
              unidade_nome: string;
              total_valor: number;
              percentual_total: number;
          }
        | null
    >((best, current) => {
        if (!best || current.total_valor > best.total_valor) {
            return current;
        }

        return best;
    }, null);
    const freightAveragePerUnit =
        freightOnlyUnits.length > 0
            ? freightOnlyUnits.reduce((sum, unit) => sum + unit.total_valor, 0) /
              freightOnlyUnits.length
            : 0;

    return (
        <AdminLayout title="Home" active="home">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Home</h2>
                    <p className="text-sm text-muted-foreground">
                        {effectiveLayoutMode === 'super'
                            ? 'Super dashboard operacional por permissões.'
                            : 'Escolha o painel para continuar.'}
                    </p>
                </div>

                {ENABLE_CLASSIC_LAYOUT ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant={layoutMode === 'super' ? 'default' : 'outline'}
                            onClick={() => setLayoutMode('super')}
                        >
                            Super dashboard
                        </Button>
                        <Button
                            type="button"
                            variant={layoutMode === 'classic' ? 'default' : 'outline'}
                            onClick={() => setLayoutMode('classic')}
                        >
                            Layout clássico
                        </Button>
                    </div>
                ) : null}

                {error ? (
                    <Notification message={error} variant="error" />
                ) : null}

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando painéis...
                    </div>
                ) : effectiveLayoutMode === 'super' && superDashboard ? (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <CardTitle>Período</CardTitle>
                                    <CardDescription>{periodLabel}</CardDescription>
                                </div>
                                <div className="grid gap-2 md:grid-cols-2">
                                    <Select
                                        value={periodMode}
                                        onValueChange={(value: '1m' | '3m' | 'month') =>
                                            setPeriodMode(value)
                                        }
                                    >
                                        <SelectTrigger className="w-full md:w-36">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1m">Último 1 mês</SelectItem>
                                            <SelectItem value="3m">Últimos 3 meses</SelectItem>
                                            <SelectItem value="month">Mês específico</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Select
                                        value={selectedMonth || undefined}
                                        onValueChange={setSelectedMonth}
                                        disabled={periodMode !== 'month'}
                                    >
                                        <SelectTrigger className="w-full md:w-44">
                                            <SelectValue placeholder="Selecione o mês" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {monthOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                        </Card>

                        {superDashboard.freight ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Análise de frete por unidade</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-4 xl:grid-cols-[7fr_3fr]">
                                        <div className="overflow-x-auto pb-1">
                                            <div className="flex min-w-[640px] items-end gap-2 px-1">
                                                {freightChartColumns.map((column, index) => {
                                                    const barHeight = Math.max(
                                                        58,
                                                        Math.round(
                                                            (column.total_valor / freightChartMax) * 210,
                                                        ),
                                                    );
                                                    const fillHeight = Math.max(
                                                        10,
                                                        Math.min(
                                                            100,
                                                            Math.round(
                                                                column.percentual_total,
                                                            ),
                                                        ),
                                                    );

                                                    return (
                                                        <div
                                                            key={`freight-column-${column.unidade_id}-${index}`}
                                                            className="flex min-w-[108px] flex-col items-center gap-2"
                                                        >
                                                            <div
                                                                className="relative w-[96px] overflow-hidden rounded-md border bg-background"
                                                                style={{ height: `${barHeight}px` }}
                                                            >
                                                                <div
                                                                    className="absolute right-0 bottom-0 left-0 bg-muted"
                                                                    style={{
                                                                        height: `${fillHeight}%`,
                                                                    }}
                                                                />

                                                                <p className="absolute top-2 right-0 left-0 px-2 text-center text-xs font-medium text-foreground">
                                                                    {formatCurrencyBR(
                                                                        column.total_valor,
                                                                    )}
                                                                </p>

                                                                <p className="absolute right-0 bottom-2 left-0 text-center text-xs text-muted-foreground">
                                                                    {formatPercentBR(
                                                                        column.percentual_total,
                                                                    )}
                                                                </p>
                                                            </div>

                                                            <p className="text-center text-xs font-semibold text-foreground uppercase">
                                                                {column.unidade_nome}
                                                            </p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="space-y-2 rounded-md border p-3 text-sm">
                                            <p className="font-medium">Resumo de frete</p>
                                            <div className="space-y-1 text-muted-foreground">
                                                <p>
                                                    Total empresa:{' '}
                                                    <span className="font-medium text-foreground">
                                                        {formatCurrencyBR(
                                                            superDashboard
                                                                .freight.company
                                                                .total_valor,
                                                        )}
                                                    </span>
                                                </p>
                                                <p>
                                                    Maior unidade:{' '}
                                                    <span className="font-medium text-foreground">
                                                        {freightTopUnit
                                                            ? freightTopUnit.unidade_nome
                                                            : '-'}
                                                    </span>
                                                </p>
                                                <p>
                                                    Participação líder:{' '}
                                                    <span className="font-medium text-foreground">
                                                        {freightTopUnit
                                                            ? formatPercentBR(
                                                                  freightTopUnit.percentual_total,
                                                              )
                                                            : '-'}
                                                    </span>
                                                </p>
                                                <p>
                                                    Média por unidade:{' '}
                                                    <span className="font-medium text-foreground">
                                                        {formatCurrencyBR(
                                                            freightAveragePerUnit,
                                                        )}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : null}

                        {superDashboard.vacations ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-emerald-950">
                                        <CalendarClock className="size-5" />
                                        Férias por unidade
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        {superDashboard.vacations.by_unit.map((unit) => (
                                            <div
                                                key={`vacation-unit-${unit.unidade_id}`}
                                                className={`rounded-md border p-3 ${
                                                    unit.urgent_count > 0
                                                        ? 'border-amber-300'
                                                        : ''
                                                }`}
                                            >
                                                <div className="mb-2 flex items-center justify-between gap-2">
                                                    <p className="text-base font-semibold text-foreground">{unit.unidade_nome}</p>
                                                    {unit.urgent_count > 0 ? (
                                                        <Badge className="transport-status-badge border-amber-300 bg-amber-100 text-amber-900">
                                                            <AlertTriangle className="mr-1 size-3" />
                                                            {unit.urgent_count} em urgente
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="transport-status-badge border-emerald-300 bg-emerald-100 text-emerald-900">
                                                            Sem urgentes
                                                        </Badge>
                                                    )}
                                                </div>

                                                {unit.on_vacation.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground">Ninguém de férias agora.</p>
                                                ) : (
                                                    <div className="space-y-2 text-sm">
                                                        {unit.on_vacation.map((row) => (
                                                            <div
                                                                key={`vacation-row-${unit.unidade_id}-${row.colaborador_id}`}
                                                                className="rounded-md border px-2 py-1.5"
                                                            >
                                                                <p className="font-medium text-foreground">{row.nome}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {row.data_inicio ?? '-'} até {row.data_fim ?? '-'}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ) : null}

                        {superDashboard.payroll ? (
                            <Card>
                                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <CardTitle>Pagamentos por unidade</CardTitle>

                                    <Select value={payrollMonth || undefined} onValueChange={setPayrollMonth}>
                                        <SelectTrigger className="w-full md:w-44">
                                            <SelectValue placeholder="Mês da folha" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {monthOptions.map((option) => (
                                                <SelectItem key={`payroll-month-${option.value}`} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[780px] text-sm">
                                            <thead>
                                                <tr className="border-b text-left text-muted-foreground">
                                                    <th className="py-2 pr-3 font-medium">Unidade</th>
                                                    {superDashboard.payroll.columns.map((column) => (
                                                        <th key={`payroll-col-${column.key}`} className="py-2 pr-3 font-medium">
                                                            {column.label}
                                                        </th>
                                                    ))}
                                                    <th className="py-2 pr-3 font-medium">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {superDashboard.payroll.rows.length === 0 ? (
                                                    <tr>
                                                        <td
                                                            className="py-6 text-center text-muted-foreground"
                                                            colSpan={superDashboard.payroll.columns.length + 2}
                                                        >
                                                            Sem lançamentos para a competência selecionada.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    superDashboard.payroll.rows.map((row) => (
                                                        <tr key={`payroll-row-${row.unidade_id}`} className="border-b">
                                                            <td className="py-2 pr-3 font-medium">{row.unidade_nome}</td>
                                                            {superDashboard.payroll.columns.map((column) => (
                                                                <td key={`payroll-cell-${row.unidade_id}-${column.key}`} className="py-2 pr-3">
                                                                    {formatCurrencyBR(row.values[column.key] ?? 0)}
                                                                </td>
                                                            ))}
                                                            <td className="py-2 pr-3 font-semibold">{formatCurrencyBR(row.total)}</td>
                                                        </tr>
                                                    ))
                                                )}
                                                <tr className="bg-muted/20 font-semibold">
                                                    <td className="py-2 pr-3">Total</td>
                                                    {superDashboard.payroll.columns.map((column) => (
                                                        <td key={`payroll-total-${column.key}`} className="py-2 pr-3">
                                                            {formatCurrencyBR(superDashboard.payroll.totals.values[column.key] ?? 0)}
                                                        </td>
                                                    ))}
                                                    <td className="py-2 pr-3">{formatCurrencyBR(superDashboard.payroll.totals.total)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : null}

                        {superDashboard.interviews ? (
                            <div className="grid gap-4 xl:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Total de entrevistas por unidade</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 text-sm">
                                            {superDashboard.interviews.totals_by_unit.length === 0 ? (
                                                <p className="text-muted-foreground">Sem entrevistas no período.</p>
                                            ) : (
                                                superDashboard.interviews.totals_by_unit.map((row) => (
                                                    <div key={`interviews-unit-${row.unidade_id}`} className="flex items-center justify-between rounded border px-3 py-2">
                                                        <span>{row.unidade_nome}</span>
                                                        <strong>{formatIntegerBR(row.total_entrevistas)}</strong>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Admissões e demissões recentes</CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid gap-3 md:grid-cols-2">
                                        <div>
                                            <p className="mb-2 text-sm font-medium">Admissões</p>
                                            <div className="max-h-64 space-y-2 overflow-auto pr-1 text-sm">
                                                {superDashboard.interviews.recent_admissions.length === 0 ? (
                                                    <p className="text-muted-foreground">Sem admissões recentes.</p>
                                                ) : (
                                                    superDashboard.interviews.recent_admissions.map((row) => (
                                                        <div key={`admission-${row.id}`} className="rounded border px-2 py-1.5">
                                                            <p className="font-medium">{row.nome}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {row.unidade_nome} • {row.funcao_nome} • {row.data ?? '-'}
                                                            </p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="mb-2 text-sm font-medium">Demissões</p>
                                            <div className="max-h-64 space-y-2 overflow-auto pr-1 text-sm">
                                                {superDashboard.interviews.recent_dismissals.length === 0 ? (
                                                    <p className="text-muted-foreground">Sem demissões recentes.</p>
                                                ) : (
                                                    superDashboard.interviews.recent_dismissals.map((row) => (
                                                        <div key={`dismissal-${row.id}`} className="rounded border px-2 py-1.5">
                                                            <p className="font-medium">{row.nome}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {row.unidade_nome} • {row.funcao_nome} • {row.data ?? '-'}
                                                            </p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {visibleModules.map((module) => (
                            <Card
                                key={module.key}
                                className="flex h-full flex-col border-border/80 transition-colors hover:bg-muted/20"
                            >
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                                            {moduleIcon(module.key)}
                                        </div>
                                        <Badge variant="outline">
                                            {module.title}
                                        </Badge>
                                    </div>
                                    <CardTitle className="pt-2 text-xl">
                                        {module.title}
                                    </CardTitle>
                                    <CardDescription className="min-h-[3.5rem]">
                                        {module.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="mt-auto flex flex-1 flex-col gap-4">
                                    <div className="min-h-12 space-y-2 text-sm text-muted-foreground">
                                        {Object.entries(module.metrics).map(
                                            ([label, value]) => (
                                                <div
                                                    key={label}
                                                    className="flex items-center justify-between"
                                                >
                                                    <span className="capitalize">
                                                        {metricLabels[label] ??
                                                            label.replace(
                                                                /_/g,
                                                                ' ',
                                                            )}
                                                    </span>
                                                    <span className={metricValueClass(label, value)}>
                                                        {formatMetric(label, value)}
                                                    </span>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                    <Button className="mt-auto w-full" asChild>
                                        <Link href={module.href}>
                                            Acessar
                                            <ArrowRight className="size-4" />
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
