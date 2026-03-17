import { Head, Link, router } from '@inertiajs/react';
import {
    Briefcase,
    ChevronLeft,
    ChevronRight,
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
    TrendingUp,
    CircleX,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Logo } from '@/components/logo';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ApiError, apiPost } from '@/lib/api-client';
import { transportFeatures } from '@/lib/transport-features';
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

type GlobalNotice = {
    message: string;
    variant: 'success' | 'error' | 'info';
};

interface AdminLayoutProps {
    title: string;
    active:
        | 'home'
        | 'dashboard'
        | 'operations-hub'
        | 'executive-dashboard'
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
        | 'vacations-dashboard'
        | 'vacations-list'
        | 'vacations-launch'
        | 'freight-dashboard'
        | 'freight-launch'
        | 'freight-list'
        | 'freight-spot'
        | 'freight-canceled-loads'
        | 'freight-operational-report'
        | 'freight-monthly'
        | 'freight-timeline'
        | 'settings'
        | 'registry-collaborators'
        | 'registry-users'
        | 'registry-functions'
        | 'registry-payment-types'
        | 'registry-plates-aviaries'
        | 'activity-log';
    module?: 'home' | 'interviews' | 'registry' | 'payroll' | 'freight' | 'vacations';
    children: React.ReactNode;
}

export function AdminLayout({
    title,
    active,
    module,
    children,
}: AdminLayoutProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [navigationOpen, setNavigationOpen] = useState(false);
    const [navigationInput, setNavigationInput] = useState('');
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem('transport.sidebar.collapsed') === '1';
    });
    const [user, setUser] = useState<TransportAuthUser | null>(() =>
        typeof window === 'undefined' ? null : getStoredUser(),
    );
    const [globalNotice, setGlobalNotice] = useState<GlobalNotice | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(
            'transport.sidebar.collapsed',
            sidebarCollapsed ? '1' : '0',
        );
    }, [sidebarCollapsed]);

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

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let timeoutId: number | null = null;

        if (globalNotice) {
            timeoutId = window.setTimeout(() => setGlobalNotice(null), 2600);
        }

        return () => {
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [globalNotice]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const scope = document.querySelector('main.transport-page');

        if (!scope) return;

        const initialValues = new WeakMap<HTMLElement, string>();
        const dirtySet = new Set<HTMLElement>();
        const dirtyClassNames = [
            'ring-2',
            'ring-primary/30',
            'border-primary/40',
            'bg-primary/5',
        ];

        function elementValue(element: HTMLElement): string {
            if (element instanceof HTMLInputElement) {
                if (element.type === 'checkbox' || element.type === 'radio') {
                    return element.checked ? '1' : '0';
                }

                return element.value;
            }

            if (element instanceof HTMLSelectElement) {
                return element.value;
            }

            if (element instanceof HTMLTextAreaElement) {
                return element.value;
            }

            return '';
        }

        function applyDirtyState(element: HTMLElement, isDirty: boolean): void {
            if (isDirty) {
                dirtyClassNames.forEach((className) => element.classList.add(className));
                dirtySet.add(element);
            } else {
                dirtyClassNames.forEach((className) => element.classList.remove(className));
                dirtySet.delete(element);
            }

            setHasUnsavedChanges(dirtySet.size > 0);
        }

        function ensureInitial(element: HTMLElement): void {
            if (!initialValues.has(element)) {
                initialValues.set(element, elementValue(element));
            }
        }

        function evaluateElement(element: HTMLElement): void {
            ensureInitial(element);
            const initial = initialValues.get(element) ?? '';
            const current = elementValue(element);

            applyDirtyState(element, initial !== current);
        }

        function onFocusIn(event: Event): void {
            const target = event.target as HTMLElement | null;

            if (
                !(target instanceof HTMLInputElement) &&
                !(target instanceof HTMLSelectElement) &&
                !(target instanceof HTMLTextAreaElement)
            ) {
                return;
            }

            ensureInitial(target);
        }

        function onChangeOrInput(event: Event): void {
            const target = event.target as HTMLElement | null;

            if (
                !(target instanceof HTMLInputElement) &&
                !(target instanceof HTMLSelectElement) &&
                !(target instanceof HTMLTextAreaElement)
            ) {
                return;
            }

            evaluateElement(target);
        }

        function beforeUnload(event: BeforeUnloadEvent): void {
            if (dirtySet.size === 0) return;

            event.preventDefault();
            event.returnValue = '';
        }

        scope.addEventListener('focusin', onFocusIn);
        scope.addEventListener('change', onChangeOrInput);
        scope.addEventListener('input', onChangeOrInput);
        window.addEventListener('beforeunload', beforeUnload);

        return () => {
            scope.removeEventListener('focusin', onFocusIn);
            scope.removeEventListener('change', onChangeOrInput);
            scope.removeEventListener('input', onChangeOrInput);
            window.removeEventListener('beforeunload', beforeUnload);
        };
    }, [active]);

    useEffect(() => {
        function findSaveButton(scope: ParentNode): HTMLButtonElement | null {
            const explicit = scope.querySelector<HTMLButtonElement>(
                'button[data-save-action]:not([disabled])',
            );

            if (explicit) return explicit;

            const submit = scope.querySelector<HTMLButtonElement>(
                'button[type="submit"]:not([disabled])',
            );

            if (submit) return submit;

            const byText = Array.from(
                scope.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
            ).find((button) =>
                /(salvar|gravar|lançar|cadastrar|finalizar|importar)/i.test(
                    button.textContent ?? '',
                ),
            );

            return byText ?? null;
        }

        function triggerPageSave(): boolean {
            const activeElement =
                document.activeElement instanceof HTMLElement
                    ? document.activeElement
                    : null;
            const activeForm = activeElement?.closest('form');

            if (activeForm) {
                const activeFormButton = findSaveButton(activeForm);

                if (activeFormButton) {
                    activeFormButton.click();
                    return true;
                }

                const requestSubmit = (activeForm as HTMLFormElement).requestSubmit;

                if (typeof requestSubmit === 'function') {
                    requestSubmit.call(activeForm);
                    return true;
                }
            }

            const openDialog = document.querySelector<HTMLElement>(
                '[role="dialog"][data-state="open"]',
            );

            if (openDialog) {
                const dialogButton = findSaveButton(openDialog);

                if (dialogButton) {
                    dialogButton.click();
                    return true;
                }
            }

            const pageButton = findSaveButton(document);

            if (pageButton) {
                pageButton.click();
                return true;
            }

            return false;
        }

        function fieldIdentifier(element: HTMLElement, index: number): string {
            const path = window.location.pathname;
            const name = element.getAttribute('name');
            const id = element.getAttribute('id');

            if (name) return `${path}::name::${name}`;
            if (id) return `${path}::id::${id}`;
            return `${path}::index::${index}`;
        }

        function collectSnapshot(): Record<string, string> {
            const scope = document.querySelector('main.transport-page');

            if (!scope) return {};

            const fields = Array.from(
                scope.querySelectorAll<HTMLElement>('input, select, textarea'),
            );
            const snapshot: Record<string, string> = {};

            fields.forEach((element, index) => {
                if (element instanceof HTMLInputElement) {
                    if (element.type === 'checkbox' || element.type === 'radio') {
                        snapshot[fieldIdentifier(element, index)] = element.checked ? '1' : '0';
                        return;
                    }

                    snapshot[fieldIdentifier(element, index)] = element.value;
                    return;
                }

                if (element instanceof HTMLSelectElement) {
                    snapshot[fieldIdentifier(element, index)] = element.value;
                    return;
                }

                if (element instanceof HTMLTextAreaElement) {
                    snapshot[fieldIdentifier(element, index)] = element.value;
                }
            });

            return snapshot;
        }

        function applySnapshot(snapshot: Record<string, string>): number {
            const scope = document.querySelector('main.transport-page');

            if (!scope) return 0;

            const fields = Array.from(
                scope.querySelectorAll<HTMLElement>('input, select, textarea'),
            );
            let applied = 0;

            fields.forEach((element, index) => {
                const key = fieldIdentifier(element, index);
                const value = snapshot[key];

                if (typeof value !== 'string') return;

                if (element instanceof HTMLInputElement) {
                    if (element.type === 'checkbox' || element.type === 'radio') {
                        element.checked = value === '1';
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        element.value = value;
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                    }

                    applied += 1;
                    return;
                }

                if (element instanceof HTMLSelectElement) {
                    element.value = value;
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    applied += 1;
                    return;
                }

                if (element instanceof HTMLTextAreaElement) {
                    element.value = value;
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    applied += 1;
                }
            });

            return applied;
        }

        function snapshotStorageKey(slot: number): string {
            return `transport.snapshot.${window.location.pathname}.slot.${slot}`;
        }

        function saveSnapshot(slot: number): void {
            const snapshot = collectSnapshot();

            window.localStorage.setItem(
                snapshotStorageKey(slot),
                JSON.stringify({
                    savedAt: Date.now(),
                    snapshot,
                }),
            );

            setGlobalNotice({
                message: `Perfil ${slot} salvo (${Object.keys(snapshot).length} campos).`,
                variant: 'success',
            });
        }

        function loadSnapshot(slot: number): void {
            const raw = window.localStorage.getItem(snapshotStorageKey(slot));

            if (!raw) {
                setGlobalNotice({
                    message: `Nenhum perfil ${slot} salvo para esta tela.`,
                    variant: 'info',
                });

                return;
            }

            try {
                const parsed = JSON.parse(raw) as { snapshot?: Record<string, string> };
                const applied = applySnapshot(parsed.snapshot ?? {});

                setGlobalNotice({
                    message: `Perfil ${slot} aplicado (${applied} campos).`,
                    variant: 'success',
                });
            } catch {
                setGlobalNotice({
                    message: `Perfil ${slot} inválido. Salve novamente.`,
                    variant: 'error',
                });
            }
        }

        function onShortcuts(event: KeyboardEvent): void {
            const target = event.target as HTMLElement | null;
            const isTypingContext =
                !!target &&
                (target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.tagName === 'SELECT' ||
                    target.isContentEditable);

            if (event.ctrlKey && event.key.toLowerCase() === 's') {
                event.preventDefault();

                if (triggerPageSave()) {
                    setGlobalNotice({
                        message: 'Atalho Ctrl+S executado.',
                        variant: 'info',
                    });
                }

                return;
            }

            const slot = Number(event.key);

            if (!Number.isInteger(slot) || slot < 1 || slot > 3) {
                return;
            }

            if (!event.altKey) {
                return;
            }

            event.preventDefault();

            if (event.shiftKey) {
                saveSnapshot(slot);
                return;
            }

            if (isTypingContext) {
                return;
            }

            loadSnapshot(slot);
        }

        window.addEventListener('keydown', onShortcuts, true);

        return () => {
            window.removeEventListener('keydown', onShortcuts, true);
        };
    }, [active]);

    useEffect(() => {
        function findSaveButton(scope: ParentNode): HTMLButtonElement | null {
            const explicit = scope.querySelector<HTMLButtonElement>(
                'button[data-save-action]:not([disabled])',
            );

            if (explicit) return explicit;

            const submit = scope.querySelector<HTMLButtonElement>(
                'button[type="submit"]:not([disabled])',
            );

            if (submit) return submit;

            const byText = Array.from(
                scope.querySelectorAll<HTMLButtonElement>(
                    'button:not([disabled])',
                ),
            ).find((button) =>
                /(salvar|gravar|lançar|cadastrar|finalizar|importar)/i.test(
                    button.textContent ?? '',
                ),
            );

            return byText ?? null;
        }

        function handleAltAShortcut(event: KeyboardEvent): void {
            if (!event.altKey || event.key.toLowerCase() !== 'a') {
                return;
            }

            if (event.defaultPrevented) {
                return;
            }

            const target = event.target as HTMLElement | null;
            if (target && target.closest('[contenteditable="true"]')) {
                return;
            }

            const activeElement =
                document.activeElement instanceof HTMLElement
                    ? document.activeElement
                    : null;

            const activeForm = activeElement?.closest('form');

            if (activeForm) {
                const activeFormButton = findSaveButton(activeForm);

                if (activeFormButton) {
                    event.preventDefault();
                    activeFormButton.click();
                    return;
                }

                const requestSubmit = (
                    activeForm as HTMLFormElement
                ).requestSubmit;

                if (typeof requestSubmit === 'function') {
                    event.preventDefault();
                    requestSubmit.call(activeForm);
                    return;
                }
            }

            const openDialog = document.querySelector<HTMLElement>(
                '[role="dialog"][data-state="open"]',
            );

            if (openDialog) {
                const dialogButton = findSaveButton(openDialog);

                if (dialogButton) {
                    event.preventDefault();
                    dialogButton.click();
                    return;
                }
            }

            const pageButton = findSaveButton(document);

            if (pageButton) {
                event.preventDefault();
                pageButton.click();
            }
        }

        window.addEventListener('keydown', handleAltAShortcut, true);

        return () => {
            window.removeEventListener('keydown', handleAltAShortcut, true);
        };
    }, []);

    useEffect(() => {
        function handleNavigationShortcut(event: KeyboardEvent): void {
            if (!event.ctrlKey || event.key.toLowerCase() !== 'k') {
                return;
            }

            if (event.defaultPrevented) {
                return;
            }

            event.preventDefault();
            setNavigationOpen(true);
            setNavigationInput('');
        }

        window.addEventListener('keydown', handleNavigationShortcut, true);

        return () => {
            window.removeEventListener('keydown', handleNavigationShortcut, true);
        };
    }, []);

    const navigationOptions: Record<
        string,
        { label: string; href: string }
    > = {
        '1': {
            label: 'Entrevistas',
            href: '/transport/interviews',
        },
        '2': {
            label: 'Pagamentos',
            href: '/transport/payroll/dashboard',
        },
        '3': {
            label: 'Férias',
            href: '/transport/vacations/dashboard',
        },
        '4': {
            label: 'Cadastro',
            href: '/transport/registry/collaborators',
        },
        '5': {
            label: 'Central de Fretes',
            href: '/transport/freight/dashboard',
        },
    };

    function handleNavigationInput(
        event: React.KeyboardEvent<HTMLInputElement>,
    ): void {
        const key = event.key;

        if (navigationOptions[key]) {
            event.preventDefault();
            const option = navigationOptions[key];
            router.visit(option.href);
            setNavigationOpen(false);
            setNavigationInput('');
        } else if (key === 'Escape') {
            event.preventDefault();
            setNavigationOpen(false);
            setNavigationInput('');
        }
    }

    const currentModule = useMemo(() => {
        if (module) return module;
        if (active === 'home') return 'home';
        if (
            active === 'settings' ||
            active === 'activity-log' ||
            active === 'operations-hub'
        ) return 'home';
        if (active.startsWith('registry-')) return 'registry';
        if (active.startsWith('payroll-')) return 'payroll';
        if (active.startsWith('vacations-')) return 'vacations';
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
                        {
                            key: 'registry-plates-aviaries',
                            label: 'Placas e Aviários',
                            href: '/transport/registry/plates-aviaries',
                            icon: Truck,
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
                              label: 'Descontos',
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
                      ]
                    : currentModule === 'vacations'
                      ? [
                            {
                                key: 'vacations-dashboard',
                                label: 'Dashboard',
                                href: '/transport/vacations/dashboard',
                                icon: ClipboardCheck,
                            },
                            {
                                key: 'vacations-list',
                                label: 'Lista de Férias',
                                href: '/transport/vacations/list',
                                icon: List,
                            },
                            {
                                key: 'vacations-launch',
                                label: 'Lançar Férias',
                                href: '/transport/vacations/launch',
                                icon: PlusSquare,
                            },
                        ]
                    : currentModule === 'freight'
                      ? [
                            {
                                key: 'freight-dashboard',
                                label: 'Dashboard',
                                href: '/transport/freight/dashboard',
                                icon: LayoutDashboard,
                            },
                            {
                                key: 'freight-launch',
                                label: 'Lançar Fretes',
                                href: '/transport/freight/launch',
                                icon: PlusSquare,
                            },
                            {
                                key: 'freight-list',
                                label: 'Lista de Fretes',
                                href: '/transport/freight/list',
                                icon: List,
                            },
                            {
                                key: 'freight-spot',
                                label: 'Lançar Fretes Spot',
                                href: '/transport/freight/spot',
                                icon: Truck,
                            },
                            {
                                key: 'freight-canceled-loads',
                                label: 'Cargas Canceladas',
                                href: '/transport/freight/canceled-loads',
                                icon: CircleX,
                            },
                            {
                                key: 'freight-timeline',
                                label: 'Central Analítica',
                                href: '/transport/freight/timeline',
                                icon: TrendingUp,
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

    const fixedLinks = useMemo(
        () => [
            ...(transportFeatures.operationsHub
                ? [
                      {
                          key: 'operations-hub' as const,
                          label: 'Pendências',
                          href: '/transport/pendencias',
                          icon: Workflow,
                      },
                  ]
                : []),
            ...(user?.role === 'master_admin'
                ? [
                      {
                          key: 'activity-log' as const,
                          label: 'Log',
                          href: '/transport/activity-log',
                          icon: ScrollText,
                      },
                  ]
                : []),
            {
                key: settingsLink.key,
                label: settingsLink.label,
                href: settingsLink.href,
                icon: settingsLink.icon,
            },
        ],
        [settingsLink.href, settingsLink.icon, settingsLink.key, settingsLink.label, user?.role],
    );

    const panelTitle = useMemo(() => {
        if (currentModule === 'home') return 'Painel Principal';
        if (currentModule === 'registry') return 'Painel de Cadastro';
        if (currentModule === 'payroll') return 'Painel de Pagamentos';
        if (currentModule === 'vacations') return 'Painel Controle de Férias';
        if (currentModule === 'freight') return 'Central de Fretes';
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
                {globalNotice ? (
                    <Notification
                        message={globalNotice.message}
                        variant={globalNotice.variant}
                    />
                ) : null}
                <div
                    className={`grid min-h-screen w-full grid-cols-1 gap-4 p-3 sm:p-4 lg:transition-[grid-template-columns] lg:duration-200 lg:ease-out lg:p-6 print:block print:min-h-0 print:max-w-none print:p-0 ${
                        sidebarCollapsed
                            ? 'lg:grid-cols-[92px_1fr]'
                            : 'lg:grid-cols-[260px_1fr]'
                    }`}
                >
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

                    <aside
                        className={`hidden h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 ease-out lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-3rem)] print:hidden ${
                            sidebarCollapsed ? 'p-2' : 'p-4'
                        }`}
                    >
                        <div className="mb-6 border-b pb-4">
                            <div
                                className={`flex ${
                                    sidebarCollapsed
                                        ? 'justify-center'
                                        : 'items-start justify-between gap-2'
                                }`}
                            >
                                <Link
                                    href="/transport/home"
                                    prefetch
                                    className={sidebarCollapsed ? 'block' : 'mb-3 block w-full'}
                                >
                                    <div
                                        className={`flex items-center justify-center rounded-lg border bg-muted/20 p-2 ${
                                            sidebarCollapsed
                                                ? 'min-h-[72px] w-[72px]'
                                                : 'min-h-[96px] w-full'
                                        }`}
                                    >
                                        {sidebarCollapsed ? (
                                            <img
                                                src="/logo/kaiquesemfundo.png"
                                                alt="Kaique"
                                                className="h-10 w-10 object-contain"
                                                loading="eager"
                                                decoding="async"
                                            />
                                        ) : (
                                            <Logo className="h-16 w-full max-w-[236px] object-contain object-center" />
                                        )}
                                    </div>
                                </Link>
                            </div>

                            {sidebarCollapsed ? (
                                <div className="mt-3 flex justify-center">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setSidebarCollapsed(false)}
                                        aria-label="Expandir menu"
                                        title="Expandir menu"
                                    >
                                        <ChevronRight className="size-4" />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        Kaique Transportes
                                    </p>
                                    <div className="mt-1 flex items-center justify-between gap-2">
                                        <h1 className="text-lg font-semibold">
                                            {panelTitle}
                                            {hasUnsavedChanges ? ' • alterações pendentes' : ''}
                                        </h1>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setSidebarCollapsed(true)}
                                            aria-label="Minimizar menu"
                                            title="Minimizar menu"
                                        >
                                            <ChevronLeft className="size-4" />
                                        </Button>
                                    </div>
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
                                </>
                            )}
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col">
                            <div className="flex-1 overflow-y-auto">
                                {!sidebarCollapsed ? (
                                    <p className="mb-2 px-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                                        Navegação do módulo
                                    </p>
                                ) : null}
                                <nav className="space-y-2">
                                    {links.map((link) => {
                                        const Icon = link.icon;
                                        const isActive = link.key === active;

                                        return (
                                            <Link
                                                key={link.key}
                                                href={link.href}
                                                prefetch
                                                onClick={() => setMobileMenuOpen(false)}
                                                title={link.label}
                                                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                                                    isActive
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'hover:bg-muted'
                                                } ${
                                                    sidebarCollapsed
                                                        ? 'justify-center px-2'
                                                        : ''
                                                }`}
                                            >
                                                <Icon className="size-4" />
                                                {!sidebarCollapsed ? <span>{link.label}</span> : null}
                                            </Link>
                                        );
                                    })}
                                </nav>
                            </div>

                            <div className="mt-4 border-t pt-4">
                                {!sidebarCollapsed ? (
                                    <p className="mb-2 px-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                                        Acesso geral
                                    </p>
                                ) : null}
                                {fixedLinks.map((link) => {
                                    const Icon = link.icon;
                                    const isActive = link.key === active;

                                    return (
                                        <Link
                                            key={link.key}
                                            href={link.href}
                                            prefetch
                                            onClick={() => setMobileMenuOpen(false)}
                                            title={link.label}
                                            className={`mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                                                isActive
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'hover:bg-muted'
                                            } ${
                                                sidebarCollapsed
                                                    ? 'justify-center px-2'
                                                    : ''
                                            }`}
                                        >
                                            <Icon className="size-4" />
                                            {!sidebarCollapsed ? <span>{link.label}</span> : null}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            className={`mt-3 ${sidebarCollapsed ? 'w-auto self-center px-2' : 'w-full'}`}
                            onClick={handleLogout}
                            title="Sair"
                        >
                            <LogOut className="size-4" />
                            {!sidebarCollapsed ? 'Sair' : null}
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
                            <aside className="relative flex h-full w-[78%] max-w-[320px] flex-col border-r bg-card p-4 shadow-xl">
                                <div className="mb-6 border-b pb-4">
                                    <Link
                                        href="/transport/home"
                                        prefetch
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

                                <div className="flex-1 overflow-y-auto">
                                    <p className="mb-2 text-[11px] tracking-wide text-muted-foreground uppercase">
                                        Navegação do módulo
                                    </p>
                                    <nav className="space-y-2">
                                        {links.map((link) => {
                                            const Icon = link.icon;
                                            const isActive = link.key === active;

                                            return (
                                                <Link
                                                    key={link.key}
                                                    href={link.href}
                                                    prefetch
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
                                </div>

                                <div className="border-t pt-4">
                                    <p className="mb-2 text-[11px] tracking-wide text-muted-foreground uppercase">
                                        Acesso geral
                                    </p>
                                    {fixedLinks.map((link) => {
                                        const Icon = link.icon;
                                        const isActive = link.key === active;

                                        return (
                                            <Link
                                                key={link.key}
                                                href={link.href}
                                                prefetch
                                                onClick={() =>
                                                    setMobileMenuOpen(false)
                                                }
                                                className={`mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
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

                    <main className="transport-page min-w-0 rounded-xl border bg-card p-3 shadow-sm sm:p-4 lg:p-6 print:rounded-none print:border-0 print:p-0 print:shadow-none">
                        {children}
                    </main>
                </div>
            </div>

            <Dialog open={navigationOpen} onOpenChange={setNavigationOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Navegação rápida</DialogTitle>
                        <DialogDescription>
                            Digite um número para navegar:
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Input
                            autoFocus
                            placeholder="Digite 1-5"
                            value={navigationInput}
                            onChange={(event) =>
                                setNavigationInput(event.target.value)
                            }
                            onKeyDown={handleNavigationInput}
                            className="text-lg font-semibold"
                        />

                        <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                    1
                                </span>
                                <span className="font-medium">Entrevistas</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                    2
                                </span>
                                <span className="font-medium">Pagamentos</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                    3
                                </span>
                                <span className="font-medium">Férias</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                    4
                                </span>
                                <span className="font-medium">Cadastro</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                    5
                                </span>
                                <span className="font-medium">
                                    Gestão de Fretes
                                </span>
                            </div>
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        Atalhos globais: Ctrl+S (salvar), Alt+Shift+1..3 (salvar perfil), Alt+1..3 (aplicar perfil), ESC (fechar).
                    </p>
                </DialogContent>
            </Dialog>
        </>
    );
}
