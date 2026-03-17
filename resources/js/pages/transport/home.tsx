import { Link } from '@inertiajs/react';
import {
    ArrowRight,
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
}

const metricLabels: Record<string, string> = {
    total_interviews: 'Total de entrevistas',
    payments_current_month: 'Pagamentos no mês atual',
    total_current_month: 'Total no mês atual',
    active_collaborators: 'Colaboradores ativos',
    freight_entries_current_month: 'Lançamentos de frete no mês',
    freight_total_current_month: 'Frete total no mês',
    vacations_expired: 'Férias vencidas',
    vacations_due_2_months: 'Limite próximos 2 meses',
    operations_pending_total: 'Pendências totais',
    executive_approval_rate: 'Taxa de aprovação',
};

function formatMetric(label: string, value: number): string {
    if (label.includes('approval_rate')) {
        return formatPercentBR(value);
    }

    if (
        label.includes('total_current_month') ||
        label.includes('freight_total_current_month') ||
        label.includes('payments_current_month')
    ) {
        return formatCurrencyBR(value);
    }

    return formatIntegerBR(value);
}

function moduleIcon(key: HomeModule['key']) {
    if (key === 'interviews') return <ListChecks className="size-5" />;
    if (key === 'payroll') return <Wallet className="size-5" />;
    if (key === 'vacations') return <ClipboardCheck className="size-5" />;
    if (key === 'freight') return <Truck className="size-5" />;
    if (key === 'operations') return <ClipboardCheck className="size-5" />;
    return <Users className="size-5" />;
}

export default function TransportHomePage() {
    const [modules, setModules] = useState<HomeModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiGet<HomeResponse>('/home')
            .then((response) => setModules(response.modules))
            .catch(() =>
                setError('Não foi possível carregar os painéis da Home.'),
            )
            .finally(() => setLoading(false));
    }, []);

    const visibleModules = modules.filter((module) => module.key !== 'operations');

    return (
        <AdminLayout title="Home" active="home">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Home</h2>
                    <p className="text-sm text-muted-foreground">
                        Escolha o painel para continuar.
                    </p>
                </div>

                {error ? (
                    <Notification message={error} variant="error" />
                ) : null}

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando painéis...
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
                                                    <span className="font-medium text-foreground">
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
