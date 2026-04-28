import { Link } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    BriefcaseBusiness,
    CalendarDays,
    CircleAlert,
    ClipboardCheck,
    LoaderCircle,
    ShieldCheck,
    Truck,
    Users,
    Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import { apiGet } from '@/lib/api-client';
import { formatCurrencyBR, formatIntegerBR, formatPercentBR } from '@/lib/transport-format';

interface HomeModule {
    key:
        | 'interviews'
        | 'payroll'
        | 'registry'
        | 'freight'
        | 'vacations'
        | 'fines'
        | 'programming'
        | 'operations';
    title: string;
    description: string;
    href: string;
    icon: string;
    metrics: Record<string, number>;
}

interface HomeResponse {
    modules: HomeModule[];
}

type ModuleTone = {
    icon: React.ReactNode;
    accentClass: string;
    panelClass: string;
};

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
    programming_trips_today: 'Viagens previstas hoje',
    programming_unassigned_today: 'Viagens sem escala hoje',
    programming_available_drivers: 'Motoristas disponíveis hoje',
    programming_available_trucks: 'Caminhões disponíveis hoje',
    fines_count_current_month: 'Multas no mês atual',
    fines_total_current_month: 'Valor total em multas',
};

const moduleToneByKey: Record<HomeModule['key'], ModuleTone> = {
    interviews: {
        icon: <BriefcaseBusiness className="size-5" />,
        accentClass: 'text-sky-100',
        panelClass: 'from-sky-500/16 via-white to-white',
    },
    payroll: {
        icon: <Wallet className="size-5" />,
        accentClass: 'text-emerald-100',
        panelClass: 'from-emerald-500/16 via-white to-white',
    },
    registry: {
        icon: <Users className="size-5" />,
        accentClass: 'text-amber-100',
        panelClass: 'from-amber-500/16 via-white to-white',
    },
    freight: {
        icon: <Truck className="size-5" />,
        accentClass: 'text-orange-100',
        panelClass: 'from-orange-500/16 via-white to-white',
    },
    vacations: {
        icon: <ClipboardCheck className="size-5" />,
        accentClass: 'text-cyan-100',
        panelClass: 'from-cyan-500/16 via-white to-white',
    },
    fines: {
        icon: <CircleAlert className="size-5" />,
        accentClass: 'text-rose-100',
        panelClass: 'from-rose-500/16 via-white to-white',
    },
    programming: {
        icon: <CalendarDays className="size-5" />,
        accentClass: 'text-indigo-100',
        panelClass: 'from-indigo-500/16 via-white to-white',
    },
    operations: {
        icon: <ShieldCheck className="size-5" />,
        accentClass: 'text-violet-100',
        panelClass: 'from-violet-500/16 via-white to-white',
    },
};

function formatMetric(label: string, value: number): string {
    if (
        label.includes('approval_rate') ||
        label.includes('coverage') ||
        label.includes('share') ||
        label.includes('expired_rate')
    ) {
        return formatPercentBR(value);
    }

    if (
        label.includes('total_current_month') ||
        label.includes('freight_total_current_month') ||
        label.includes('avg_km_current_month') ||
        label.includes('fines_total_current_month')
    ) {
        return formatCurrencyBR(value);
    }

    return formatIntegerBR(value);
}

function metricValueClass(label: string, value: number): string {
    if (label === 'vacations_expired' && value > 0) {
        return 'font-semibold text-red-700';
    }

    if (label === 'payments_pending_current_month' && value > 0) {
        return 'font-semibold text-amber-700';
    }

    if (label === 'programming_unassigned_today' && value > 0) {
        return 'font-semibold text-orange-700';
    }

    if (label === 'fines_total_current_month' && value > 0) {
        return 'font-semibold text-rose-700';
    }

    return 'font-semibold text-foreground';
}

function metricPriority(label: string, value: number): number {
    if (label === 'vacations_expired') return value > 0 ? 110 + value : 0;
    if (label === 'payments_pending_current_month') return value > 0 ? 90 + value : 0;
    if (label === 'programming_unassigned_today') return value > 0 ? 80 + value : 0;
    if (label === 'operations_pending_total') return value > 0 ? 70 + value : 0;
    if (label === 'fines_total_current_month') return value > 0 ? 60 + value : 0;
    if (label === 'freight_third_share_current_month') return value >= 35 ? 50 + value : 0;
    return 0;
}

function metricSummary(label: string, value: number): string {
    if (label === 'vacations_expired' && value > 0) {
        return 'colaboradores já passaram do limite ideal de programação.';
    }

    if (label === 'payments_pending_current_month' && value > 0) {
        return 'itens seguem pendentes no ciclo de pagamentos atual.';
    }

    if (label === 'programming_unassigned_today' && value > 0) {
        return 'viagens ainda estão sem motorista ou caminhão definido.';
    }

    if (label === 'operations_pending_total' && value > 0) {
        return 'itens precisam de atuação da operação ou liderança.';
    }

    if (label === 'fines_total_current_month' && value > 0) {
        return 'em impacto financeiro acumulado nas multas do período.';
    }

    if (label === 'freight_third_share_current_month' && value >= 35) {
        return 'da operação de frete está terceirizada neste mês.';
    }

    return 'indicador operacional em observação.';
}

export default function TransportHomePage() {
    const [modules, setModules] = useState<HomeModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        apiGet<HomeResponse>('/home')
            .then((response) => {
                if (active) {
                    setModules(response.modules);
                }
            })
            .catch(() => {
                if (active) {
                    setError('Não foi possível carregar os painéis da Home.');
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });

        return () => {
            active = false;
        };
    }, []);

    const visibleModules = useMemo(
        () => modules.filter((module) => module.key !== 'operations'),
        [modules],
    );

    const operationsModule = useMemo(
        () => modules.find((module) => module.key === 'operations') ?? null,
        [modules],
    );

    const highlightedModule = visibleModules[0] ?? null;

    const prioritizedAlerts = useMemo(() => {
        return visibleModules
            .flatMap((module) =>
                Object.entries(module.metrics).map(([label, value]) => ({
                    moduleKey: module.key,
                    moduleTitle: module.title,
                    href: module.href,
                    label,
                    value,
                    priority: metricPriority(label, value),
                })),
            )
            .filter((entry) => entry.priority > 0)
            .sort((left, right) => right.priority - left.priority)
            .slice(0, 4);
    }, [visibleModules]);

    const quickHighlights = useMemo(() => {
        return visibleModules.slice(0, 3).map((module) => {
            const [primaryLabel, primaryValue] = Object.entries(module.metrics)[0] ?? [
                'items',
                0,
            ];

            return {
                key: module.key,
                title: module.title,
                href: module.href,
                label: metricLabels[primaryLabel] ?? primaryLabel,
                value: formatMetric(primaryLabel, primaryValue),
            };
        });
    }, [visibleModules]);

    return (
        <AdminLayout title="Home" active="home">
            <div className="space-y-6">
                <section className="grid gap-4 xl:grid-cols-[1.5fr_0.95fr]">
                    <div className="transport-hero-card overflow-hidden p-6">
                        <div className="flex h-full flex-col justify-between gap-6">
                            <div className="space-y-4">
                                <div className="flex flex-wrap gap-2">
                                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                                        Command Center
                                    </span>
                                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                                        Operação integrada
                                    </span>
                                </div>

                                <div className="max-w-3xl space-y-3">
                                    <h2 className="text-3xl font-semibold tracking-tight text-white">
                                        Visão central da operação, com foco no que pede ação agora.
                                    </h2>
                                    <p className="max-w-2xl text-sm leading-6 text-white/72">
                                        A Home agora prioriza leitura executiva, urgências operacionais
                                        e acesso rápido aos módulos com maior impacto no dia.
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                                {quickHighlights.map((highlight) => (
                                    <Link
                                        key={highlight.key}
                                        href={highlight.href}
                                        className="rounded-xl border border-white/12 bg-white/10 p-4 transition-colors hover:bg-white/14"
                                    >
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/62">
                                            {highlight.title}
                                        </p>
                                        <p className="mt-3 text-2xl font-semibold text-white">
                                            {highlight.value}
                                        </p>
                                        <p className="mt-1 text-xs text-white/68">
                                            {highlight.label}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>

                    <Card className="transport-surface py-0">
                        <CardHeader className="border-b border-border/70 py-5">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="transport-section-label">Leitura rápida</p>
                                    <CardTitle className="mt-2 text-xl">
                                        Radar operacional
                                    </CardTitle>
                                </div>
                                <Badge variant="outline">
                                    {visibleModules.length} módulos ativos
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 py-5">
                            {highlightedModule ? (
                                <div className="rounded-xl border border-border/80 bg-muted/25 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                Módulo em foco
                                            </p>
                                            <p className="mt-2 text-lg font-semibold">
                                                {highlightedModule.title}
                                            </p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {highlightedModule.description}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-border/80 bg-background p-3 shadow-sm">
                                            {moduleToneByKey[highlightedModule.key]?.icon}
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {operationsModule ? (
                                <Link
                                    href={operationsModule.href}
                                    className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 transition-colors hover:bg-amber-50"
                                >
                                    <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                                        <AlertTriangle className="size-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-amber-950">
                                            Pendências centralizadas
                                        </p>
                                        <p className="mt-1 text-sm text-amber-900/80">
                                            {formatIntegerBR(
                                                operationsModule.metrics.operations_pending_total ?? 0,
                                            )}{' '}
                                            itens aguardando tratativa no hub de operação.
                                        </p>
                                    </div>
                                </Link>
                            ) : null}

                            <div className="grid gap-3 sm:grid-cols-2">
                                <Button className="w-full justify-between" asChild>
                                    <Link href="/transport/operations-hub">
                                        Abrir pendências
                                        <ArrowRight className="size-4" />
                                    </Link>
                                </Button>
                                <Button variant="outline" className="w-full justify-between" asChild>
                                    <Link href="/transport/activity-log">
                                        Ver governança
                                        <ArrowRight className="size-4" />
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {error ? <Notification message={error} variant="error" /> : null}

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando painéis operacionais...
                    </div>
                ) : (
                    <>
                        <section className="space-y-3">
                            <div className="flex items-end justify-between gap-3">
                                <div>
                                    <p className="transport-section-label">Prioridades</p>
                                    <h3 className="transport-section-title">O que merece atenção</h3>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Alertas práticos para acelerar decisão.
                                </p>
                            </div>

                            {prioritizedAlerts.length === 0 ? (
                                <Card className="transport-surface">
                                    <CardContent className="py-6 text-sm text-muted-foreground">
                                        Nenhum alerta crítico foi identificado na leitura atual dos módulos.
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid gap-4 xl:grid-cols-4">
                                    {prioritizedAlerts.map((alert) => (
                                        <Link
                                            key={`${alert.moduleKey}-${alert.label}`}
                                            href={alert.href}
                                            className="transport-surface rounded-xl p-4 transition-transform duration-150 hover:-translate-y-0.5"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <Badge variant="outline">{alert.moduleTitle}</Badge>
                                                <AlertTriangle className="size-4 text-amber-600" />
                                            </div>
                                            <p className="mt-4 text-sm font-medium text-foreground">
                                                {metricLabels[alert.label] ?? alert.label}
                                            </p>
                                            <p className="mt-2 text-2xl font-semibold">
                                                {formatMetric(alert.label, alert.value)}
                                            </p>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                                {formatIntegerBR(alert.value)} {metricSummary(alert.label, alert.value)}
                                            </p>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="space-y-3">
                            <div className="flex items-end justify-between gap-3">
                                <div>
                                    <p className="transport-section-label">Módulos</p>
                                    <h3 className="transport-section-title">Painéis de execução</h3>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Entradas rápidas para cada frente da operação.
                                </p>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                {visibleModules.map((module) => {
                                    const tone = moduleToneByKey[module.key];

                                    return (
                                        <Card
                                            key={module.key}
                                            className={`overflow-hidden border-border/80 bg-gradient-to-br ${tone.panelClass} py-0 transition-transform duration-150 hover:-translate-y-0.5`}
                                        >
                                            <CardHeader className="border-b border-border/70 py-5">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="rounded-xl border border-border/70 bg-background/80 p-3 shadow-sm">
                                                        {tone.icon}
                                                    </div>
                                                    <Badge variant="outline">{module.title}</Badge>
                                                </div>
                                                <CardTitle className="pt-3 text-xl">
                                                    {module.title}
                                                </CardTitle>
                                                <CardDescription className="min-h-[3.75rem] text-sm leading-6">
                                                    {module.description}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="flex h-full flex-col gap-3 py-5">
                                                <div className="space-y-2">
                                                    {Object.entries(module.metrics).map(([label, value]) => (
                                                        <div key={label} className="transport-metric-row">
                                                            <span className="text-sm text-muted-foreground">
                                                                {metricLabels[label] ?? label.replace(/_/g, ' ')}
                                                            </span>
                                                            <span className={metricValueClass(label, value)}>
                                                                {formatMetric(label, value)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                <Button className="mt-auto w-full justify-between" asChild>
                                                    <Link href={module.href}>
                                                        Acessar módulo
                                                        <ArrowRight className="size-4" />
                                                    </Link>
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </AdminLayout>
    );
}
