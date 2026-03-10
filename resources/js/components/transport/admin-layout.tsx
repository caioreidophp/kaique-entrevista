import { Head, Link, router } from '@inertiajs/react';
import {
    Briefcase,
    ClipboardCheck,
    Cog,
    LayoutDashboard,
    ListChecks,
    LogOut,
    ReceiptText,
    List,
    BarChart3,
    ChartColumn,
    PlusSquare,
    ScrollText,
    UserPlus,
    Users,
    Wallet,
    Workflow,
    Truck,
    Menu,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { ApiError, apiPost } from '@/lib/api-client';
import {
    clearAuthToken,
    getAuthToken,
    redirectToLogin,
} from '@/lib/transport-auth';
import {
    clearStoredUser,
    fetchCurrentUser,
    getStoredUser,
    type TransportAuthUser,
} from '@/lib/transport-session';

interface AdminLayoutProps {
    title: string;
    active:
        | 'home'
        | 'dashboard'
        | 'interviews'
        | 'create'
        | 'next-steps'
        | 'onboarding'
        | 'payroll-dashboard'
        | 'payroll-launch'
        | 'payroll-list'
        | 'payroll-adjustments'
        | 'payroll-report-unit'
        | 'payroll-report-collaborator'
        | 'freight-dashboard'
        | 'freight-launch'
        | 'freight-monthly'
        | 'freight-timeline'
        | 'settings'
        | 'registry-collaborators'
        | 'registry-users'
        | 'registry-functions'
        | 'registry-payment-types'
        | 'activity-log';
    module?: 'home' | 'interviews' | 'registry' | 'payroll' | 'freight';
    children: React.ReactNode;
}

export function AdminLayout({
    title,
    active,
    module,
    children,
}: AdminLayoutProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [user, setUser] = useState<TransportAuthUser | null>(() =>
        typeof window === 'undefined' ? null : getStoredUser(),
    );

    useEffect(() => {
        const token = getAuthToken();

        if (!token) {
            redirectToLogin();
            return;
        }

        let active = true;

        fetchCurrentUser(false)
            .then((currentUser) => {
                if (active) {
                    setUser(currentUser);
                }
            })
            .catch((error) => {
                if (!active) return;

                if (error instanceof ApiError && error.status === 401) {
                    clearAuthToken();
                    clearStoredUser();
                    redirectToLogin();
                }
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [active]);

    const currentModule = useMemo(() => {
        if (module) return module;
        if (active === 'home') return 'home';
        if (active === 'settings' || active === 'activity-log') return 'home';
        if (active.startsWith('registry-')) return 'registry';
        if (active.startsWith('payroll-')) return 'payroll';
        if (active.startsWith('freight-')) return 'freight';
        return 'interviews';
    }, [active, module]);

    const links = useMemo(
        () => [
            ...(currentModule === 'home'
                ? []
                : currentModule === 'registry'
                  ? [
                        {
                            key: 'registry-collaborators',
                            label: 'Colaboradores',
                            href: '/transport/registry/collaborators',
                            icon: Users,
                        },
                        {
                            key: 'registry-users',
                            label: 'Usuários',
                            href: '/transport/registry/users',
                            icon: UserPlus,
                        },
                        {
                            key: 'registry-functions',
                            label: 'Funções',
                            href: '/transport/registry/functions',
                            icon: Briefcase,
                        },
                        {
                            key: 'registry-payment-types',
                            label: 'Tipo de Pagamentos',
                            href: '/transport/registry/payment-types',
                            icon: ReceiptText,
                        },
                    ]
                  : currentModule === 'payroll'
                    ? [
                          {
                              key: 'payroll-dashboard',
                              label: 'Dashboard',
                              href: '/transport/payroll/dashboard',
                              icon: Wallet,
                          },
                          {
                              key: 'payroll-launch',
                              label: 'Lançar Pagamentos',
                              href: '/transport/payroll/launch',
                              icon: ReceiptText,
                          },
                          {
                              key: 'payroll-list',
                              label: 'Lista de Pagamentos',
                              href: '/transport/payroll/list',
                              icon: List,
                          },
                          {
                              key: 'payroll-adjustments',
                              label: 'Descontos e Empréstimos',
                              href: '/transport/payroll/adjustments',
                              icon: ReceiptText,
                          },
                          {
                              key: 'payroll-report-unit',
                              label: 'Relatório por Unidade',
                              href: '/transport/payroll/reports/unit',
                              icon: BarChart3,
                          },
                          {
                              key: 'payroll-report-collaborator',
                              label: 'Relatório por Colaborador',
                              href: '/transport/payroll/reports/collaborator',
                              icon: ChartColumn,
                          },
                          {
                              key: 'registry-payment-types',
                              label: 'Cadastro de Tipo',
                              href: '/transport/registry/payment-types',
                              icon: Cog,
                          },
                      ]
                    : currentModule === 'freight'
                      ? [
                            {
                                key: 'freight-dashboard',
                                label: 'Dashboard',
                                href: '/transport/freight/dashboard',
                                icon: Truck,
                            },
                            {
                                key: 'freight-launch',
                                label: 'Lançar',
                                href: '/transport/freight/launch',
                                icon: Truck,
                            },
                            {
                                key: 'freight-monthly',
                                label: 'Análise Mensal',
                                href: '/transport/freight/monthly',
                                icon: Truck,
                            },
                            {
                                key: 'freight-timeline',
                                label: 'Linha do Tempo',
                                href: '/transport/freight/timeline',
                                icon: Truck,
                            },
                        ]
                      : [
                            {
                                key: 'dashboard',
                                label: 'Dashboard',
                                href: '/transport/dashboard',
                                icon: LayoutDashboard,
                            },
                            {
                                key: 'interviews',
                                label: 'Entrevistas',
                                href: '/transport/interviews',
                                icon: ListChecks,
                            },
                            {
                                key: 'create',
                                label: 'Nova entrevista',
                                href: '/transport/interviews/create',
                                icon: PlusSquare,
                            },
                            {
                                key: 'next-steps',
                                label: 'Próximos Passos',
                                href: '/transport/next-steps',
                                icon: Workflow,
                            },
                            {
                                key: 'onboarding',
                                label: 'Onboarding',
                                href: '/transport/onboarding',
                                icon: ClipboardCheck,
                            },
                        ]),
        ],
        [currentModule],
    );

    const settingsLink = useMemo(
        () => ({
            key: 'settings',
            label: 'Configurações',
            href: '/transport/settings',
            icon: Cog,
        }),
        [],
    );

    const panelTitle = useMemo(() => {
        if (currentModule === 'home') return 'Painel Principal';
        if (currentModule === 'registry') return 'Painel de Cadastro';
        if (currentModule === 'payroll') return 'Painel de Pagamentos';
        if (currentModule === 'freight') return 'Gestão de Fretes';
        return 'Painel de Entrevistas';
    }, [currentModule]);

    async function handleLogout(): Promise<void> {
        try {
            await apiPost('/logout');
        } finally {
            clearAuthToken();
            clearStoredUser();
            router.visit('/transport/login');
        }
    }

    return (
        <>
            <Head title={title} />

            <div className="min-h-screen bg-muted/20 print:min-h-0 print:bg-white">
                <div className="grid min-h-screen w-full grid-cols-1 gap-4 p-3 sm:p-4 lg:grid-cols-[260px_1fr] lg:p-6 print:block print:min-h-0 print:max-w-none print:p-0">
                    <div className="flex items-center justify-between rounded-xl border bg-card p-3 shadow-sm lg:hidden print:hidden">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setMobileMenuOpen(true)}
                            aria-label="Abrir menu"
                        >
                            <Menu className="size-5" />
                        </Button>
                        <div className="min-w-0 text-right">
                            <p className="truncate text-xs tracking-wide text-muted-foreground uppercase">
                                Kaique Transportes
                            </p>
                            <h1 className="truncate text-sm font-semibold">
                                {panelTitle}
                            </h1>
                        </div>
                    </div>

                    <aside className="hidden h-full flex-col rounded-xl border bg-card p-4 shadow-sm lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-3rem)] print:hidden">
                        <div className="mb-6 border-b pb-4">
                            <Link href="/transport/home" className="mb-3 block">
                                <div className="flex min-h-[84px] items-center justify-center rounded-lg border bg-muted/20 p-2">
                                    <Logo className="h-14 w-[220px] object-contain object-center" />
                                </div>
                            </Link>
                            <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                Kaique Transportes
                            </p>
                            <h1 className="mt-1 text-lg font-semibold">
                                {panelTitle}
                            </h1>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {user?.name} ({user?.email})
                            </p>
                            <p className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">
                                Perfil:{' '}
                                {user?.role === 'master_admin'
                                    ? 'Master Admin'
                                    : user?.role === 'usuario'
                                      ? 'Usuário'
                                      : 'Admin'}
                            </p>
                        </div>

                        <nav className="space-y-2">
                            {links.map((link) => {
                                const Icon = link.icon;
                                const isActive = link.key === active;

                                return (
                                    <Link
                                        key={link.key}
                                        href={link.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                                            isActive
                                                ? 'bg-primary text-primary-foreground'
                                                : 'hover:bg-muted'
                                        }`}
                                    >
                                        <Icon className="size-4" />
                                        <span>{link.label}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="mt-auto pt-6">
                            {user?.role === 'master_admin' && (
                                <Link
                                    href="/transport/activity-log"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                                        active === 'activity-log'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'hover:bg-muted'
                                    }`}
                                >
                                    <ScrollText className="size-4" />
                                    <span>Log de Ações</span>
                                </Link>
                            )}
                            {(() => {
                                const Icon = settingsLink.icon;
                                const isActive = settingsLink.key === active;

                                return (
                                    <Link
                                        href={settingsLink.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                                            isActive
                                                ? 'bg-primary text-primary-foreground'
                                                : 'hover:bg-muted'
                                        }`}
                                    >
                                        <Icon className="size-4" />
                                        <span>{settingsLink.label}</span>
                                    </Link>
                                );
                            })()}
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            className="mt-3 w-full"
                            onClick={handleLogout}
                        >
                            <LogOut className="size-4" />
                            Sair
                        </Button>
                    </aside>

                    {mobileMenuOpen && (
                        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
                            <button
                                type="button"
                                className="absolute inset-0 bg-black/60"
                                onClick={() => setMobileMenuOpen(false)}
                                aria-label="Fechar menu"
                            />
                            <aside className="relative h-full w-[78%] max-w-[320px] overflow-y-auto border-r bg-card p-4 shadow-xl">
                                <div className="mb-6 border-b pb-4">
                                    <Link
                                        href="/transport/home"
                                        className="mb-3 block"
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        <div className="flex min-h-[84px] items-center justify-center rounded-lg border bg-muted/20 p-2">
                                            <Logo className="h-14 w-[220px] object-contain object-center" />
                                        </div>
                                    </Link>
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        Kaique Transportes
                                    </p>
                                    <h1 className="mt-1 text-lg font-semibold">
                                        {panelTitle}
                                    </h1>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        {user?.name} ({user?.email})
                                    </p>
                                    <p className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">
                                        Perfil:{' '}
                                        {user?.role === 'master_admin'
                                            ? 'Master Admin'
                                                                                        : user?.role === 'usuario'
                                                                                            ? 'Usuário'
                                                                                            : 'Admin'}
                                    </p>
                                </div>

                                <nav className="space-y-2">
                                    {links.map((link) => {
                                        const Icon = link.icon;
                                        const isActive = link.key === active;

                                        return (
                                            <Link
                                                key={link.key}
                                                href={link.href}
                                                onClick={() =>
                                                    setMobileMenuOpen(false)
                                                }
                                                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                                                    isActive
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'hover:bg-muted'
                                                }`}
                                            >
                                                <Icon className="size-4" />
                                                <span>{link.label}</span>
                                            </Link>
                                        );
                                    })}
                                </nav>

                                <div className="mt-auto pt-6">
                                    {user?.role === 'master_admin' && (
                                        <Link
                                            href="/transport/activity-log"
                                            onClick={() =>
                                                setMobileMenuOpen(false)
                                            }
                                            className={`mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                                                active === 'activity-log'
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'hover:bg-muted'
                                            }`}
                                        >
                                            <ScrollText className="size-4" />
                                            <span>Log de Ações</span>
                                        </Link>
                                    )}
                                    {(() => {
                                        const Icon = settingsLink.icon;
                                        const isActive =
                                            settingsLink.key === active;

                                        return (
                                            <Link
                                                href={settingsLink.href}
                                                onClick={() =>
                                                    setMobileMenuOpen(false)
                                                }
                                                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                                                    isActive
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'hover:bg-muted'
                                                }`}
                                            >
                                                <Icon className="size-4" />
                                                <span>{settingsLink.label}</span>
                                            </Link>
                                        );
                                    })()}
                                </div>

                                <Button
                                    type="button"
                                    variant="outline"
                                    className="mt-3 w-full"
                                    onClick={handleLogout}
                                >
                                    <LogOut className="size-4" />
                                    Sair
                                </Button>
                            </aside>
                        </div>
                    )}

                    <main className="min-w-0 rounded-xl border bg-card p-3 shadow-sm sm:p-4 lg:p-6 print:rounded-none print:border-0 print:p-0 print:shadow-none">
                        {children}
                    </main>
                </div>
            </div>
        </>
    );
}
