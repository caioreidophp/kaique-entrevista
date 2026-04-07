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
    CalendarDays,
    Menu,
    TrendingUp,
    CircleX,
    CircleAlert,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
    clearAuthToken,
    getAuthToken,
    redirectToLogin,
} from '@/lib/transport-auth';
import { transportFeatures } from '@/lib/transport-features';
import {
    clearStoredUser,
    fetchCurrentUser,
    getStoredUser,
    type TransportAuthUser,
} from '@/lib/transport-session';

const BobChatButton = lazy(async () => {
    const module = await import('@/components/transport/bob-chat');

    return {
        default: module.BobChatButton,
    };
});

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
        | 'curriculums'
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
        | 'programming-dashboard'
        | 'settings'
        | 'registry-collaborators'
        | 'registry-birthdays'
        | 'registry-users'
        | 'registry-functions'
        | 'registry-payment-types'
        | 'registry-plates-aviaries'
        | 'registry-infractions'
        | 'fines-dashboard'
        | 'fines-launch'
        | 'fines-list'
        | 'activity-log';
    module?: 'home' | 'interviews' | 'registry' | 'payroll' | 'freight' | 'vacations' | 'programming' | 'fines';
    showBobChat?: boolean;
    children: React.ReactNode;
}

const adminLayoutCopy = {
    'pt-BR': {
        languageLabel: 'Idioma',
        languagePortuguese: 'Português',
        languageEnglish: 'Inglês',
        moduleNavigation: 'Navegação do módulo',
        generalAccess: 'Acesso geral',
        profile: 'Perfil',
        roleUser: 'Usuário',
        roleAdmin: 'Admin',
        openMenu: 'Abrir menu',
        closeMenu: 'Fechar menu',
        expandMenu: 'Expandir menu',
        collapseMenu: 'Minimizar menu',
        logout: 'Sair',
        pendingChanges: ' • alterações pendentes',
        quickNavigationTitle: 'Navegação rápida',
        quickNavigationDescription: 'Digite um número para navegar:',
        quickNavigationPlaceholder: 'Digite 1-7',
        shortcutsLegend:
            'Atalhos globais: Ctrl+S (salvar), Alt+Shift+1..3 (salvar perfil), Alt+1..3 (aplicar perfil), ESC (fechar).',
        panelHome: 'Painel Principal',
        panelRegistry: 'Painel de Cadastro',
        panelPayroll: 'Painel de Pagamentos',
        panelVacations: 'Painel Controle de Férias',
        panelFreight: 'Central de Fretes',
        panelProgramming: 'Painel de Programação',
        panelFines: 'Painel de Gestão de Multas',
        panelInterviews: 'Painel de Entrevistas',
        quickInterviews: 'Entrevistas',
        quickPayroll: 'Pagamentos',
        quickVacations: 'Férias',
        quickRegistry: 'Cadastro',
        quickFreight: 'Gestão de Fretes',
        quickProgramming: 'Programação',
        quickFines: 'Gestão de Multas',
        linkDashboard: 'Dashboard',
        linkInterviews: 'Entrevistas',
        linkCurriculums: 'Currículos',
        linkNewInterview: 'Nova entrevista',
        linkNextSteps: 'Próximos Passos',
        linkOnboarding: 'Onboarding',
        linkProgrammingDashboard: 'Programação de Viagens',
        linkCollaborators: 'Colaboradores',
        linkUsers: 'Usuários',
        linkFunctions: 'Funções',
        linkPaymentTypes: 'Tipo de Pagamentos',
        linkPlatesAviaries: 'Placas e Aviários',
        linkInfractions: 'Infrações',
        linkLaunchPayments: 'Lançar Pagamentos',
        linkPaymentList: 'Lista de Pagamentos',
        linkDiscounts: 'Descontos',
        linkUnitReport: 'Relatório por Unidade',
        linkCollaboratorReport: 'Relatório por Colaborador',
        linkVacationList: 'Lista de Férias',
        linkLaunchVacation: 'Lançar Férias',
        linkLaunchFreight: 'Lançar Fretes',
        linkFreightList: 'Lista de Fretes',
        linkSpotFreight: 'Lançar Fretes Spot',
        linkCanceledLoads: 'Cargas Canceladas',
        linkAnalyticsHub: 'Central Analítica',
        linkFinesDashboard: 'Dashboard de Multas',
        linkFinesLaunch: 'Lançar Multas',
        linkFinesList: 'Lista de Multas',
        linkPending: 'Pendências',
        linkSettings: 'Configurações',
        linkLog: 'Log',
    },
    'en-US': {
        languageLabel: 'Language',
        languagePortuguese: 'Portuguese',
        languageEnglish: 'English',
        moduleNavigation: 'Module navigation',
        generalAccess: 'General access',
        profile: 'Profile',
        roleUser: 'User',
        roleAdmin: 'Admin',
        openMenu: 'Open menu',
        closeMenu: 'Close menu',
        expandMenu: 'Expand menu',
        collapseMenu: 'Collapse menu',
        logout: 'Log out',
        pendingChanges: ' • pending changes',
        quickNavigationTitle: 'Quick navigation',
        quickNavigationDescription: 'Type a number to navigate:',
        quickNavigationPlaceholder: 'Type 1-7',
        shortcutsLegend:
            'Global shortcuts: Ctrl+S (save), Alt+Shift+1..3 (save profile), Alt+1..3 (apply profile), ESC (close).',
        panelHome: 'Main panel',
        panelRegistry: 'Registry panel',
        panelPayroll: 'Payroll panel',
        panelVacations: 'Vacation control panel',
        panelFreight: 'Freight hub',
        panelProgramming: 'Programming panel',
        panelFines: 'Fines management panel',
        panelInterviews: 'Interviews panel',
        quickInterviews: 'Interviews',
        quickPayroll: 'Payroll',
        quickVacations: 'Vacations',
        quickRegistry: 'Registry',
        quickFreight: 'Freight management',
        quickProgramming: 'Programming',
        quickFines: 'Fines management',
        linkDashboard: 'Dashboard',
        linkInterviews: 'Interviews',
        linkCurriculums: 'Resumes',
        linkNewInterview: 'New interview',
        linkNextSteps: 'Next steps',
        linkOnboarding: 'Onboarding',
        linkProgrammingDashboard: 'Trip scheduling',
        linkCollaborators: 'Collaborators',
        linkUsers: 'Users',
        linkFunctions: 'Functions',
        linkPaymentTypes: 'Payment types',
        linkPlatesAviaries: 'Plates and aviaries',
        linkInfractions: 'Infractions',
        linkLaunchPayments: 'Launch payroll',
        linkPaymentList: 'Payroll list',
        linkDiscounts: 'Deductions',
        linkUnitReport: 'Unit report',
        linkCollaboratorReport: 'Collaborator report',
        linkVacationList: 'Vacation list',
        linkLaunchVacation: 'Launch vacation',
        linkLaunchFreight: 'Launch freight',
        linkFreightList: 'Freight list',
        linkSpotFreight: 'Launch spot freight',
        linkCanceledLoads: 'Canceled loads',
        linkAnalyticsHub: 'Analytics hub',
        linkFinesDashboard: 'Fines dashboard',
        linkFinesLaunch: 'Launch fines',
        linkFinesList: 'Fines list',
        linkPending: 'Pending items',
        linkSettings: 'Settings',
        linkLog: 'Log',
    },
} as const;

export function AdminLayout({
    title,
    active,
    module,
    showBobChat = true,
    children,
}: AdminLayoutProps) {
    const bobEnabled = import.meta.env.VITE_BOB_ENABLED === 'true';
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [navigationOpen, setNavigationOpen] = useState(false);
    const [navigationInput, setNavigationInput] = useState('');
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem('transport.sidebar.collapsed') === '1';
    });
    const [focusMode, setFocusMode] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem('transport.focus.mode') === '1';
    });
    const [user, setUser] = useState<TransportAuthUser | null>(() =>
        typeof window === 'undefined' ? null : getStoredUser(),
    );
    const [globalNotice, setGlobalNotice] = useState<GlobalNotice | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [focusSidebarVisible, setFocusSidebarVisible] = useState(false);
    const focusSidebarCloseTimeoutRef = useRef<number | null>(null);
    const copy = adminLayoutCopy['pt-BR'];

    const clearFocusSidebarCloseTimeout = useCallback((): void => {
        if (focusSidebarCloseTimeoutRef.current !== null) {
            window.clearTimeout(focusSidebarCloseTimeoutRef.current);
            focusSidebarCloseTimeoutRef.current = null;
        }
    }, []);

    const showFocusSidebar = useCallback((): void => {
        clearFocusSidebarCloseTimeout();
        setFocusSidebarVisible(true);
    }, [clearFocusSidebarCloseTimeout]);

    const scheduleHideFocusSidebar = useCallback((delay = 110): void => {
        clearFocusSidebarCloseTimeout();
        focusSidebarCloseTimeoutRef.current = window.setTimeout(() => {
            setFocusSidebarVisible(false);
            focusSidebarCloseTimeoutRef.current = null;
        }, delay);
    }, [clearFocusSidebarCloseTimeout]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(
            'transport.sidebar.collapsed',
            sidebarCollapsed ? '1' : '0',
        );
    }, [sidebarCollapsed]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem('transport.focus.mode', focusMode ? '1' : '0');
    }, [focusMode]);

    useEffect(() => {
        if (!focusMode) {
            setFocusSidebarVisible(false);
            clearFocusSidebarCloseTimeout();
        }
    }, [clearFocusSidebarCloseTimeout, focusMode]);

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

        function onApiError(event: Event): void {
            const customEvent = event as CustomEvent<{
                message?: string;
                status?: number;
            }>;
            const message = customEvent.detail?.message?.trim();

            if (!message) {
                return;
            }

            setGlobalNotice({
                message,
                variant:
                    (customEvent.detail?.status ?? 500) >= 500
                        ? 'error'
                        : 'info',
            });
        }

        window.addEventListener('transport:api-error', onApiError as EventListener);

        return () => {
            window.removeEventListener('transport:api-error', onApiError as EventListener);
        };
    }, []);

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
                /(salvar|gravar|lançar|cadastrar|finalizar|importar|save|submit|create|finish)/i.test(
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
                /(salvar|gravar|lançar|cadastrar|finalizar|importar|save|submit|create|finish)/i.test(
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
            label: copy.quickInterviews,
            href: '/transport/interviews',
        },
        '2': {
            label: copy.quickPayroll,
            href: '/transport/payroll/dashboard',
        },
        '3': {
            label: copy.quickVacations,
            href: '/transport/vacations/dashboard',
        },
        '4': {
            label: copy.quickRegistry,
            href: '/transport/registry/collaborators',
        },
        '5': {
            label: copy.quickFreight,
            href: '/transport/freight/dashboard',
        },
        '6': {
            label: copy.quickProgramming,
            href: '/transport/programming/dashboard',
        },
        '7': {
            label: copy.quickFines,
            href: '/transport/fines/dashboard',
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
        if (active.startsWith('programming-')) return 'programming';
        if (active.startsWith('fines-')) return 'fines';
        return 'interviews';
    }, [active, module]);

    const hasPermission = useCallback((permissionKey: string): boolean => {
        if (!user) return false;
        if (user.role === 'master_admin') return true;

        if (!user.permissions || Object.keys(user.permissions).length === 0) {
            return true;
        }

        return Boolean(user.permissions?.[permissionKey]);
    }, [user]);

    const sidebarPermissionByLinkKey = useMemo<Record<string, string>>(() => ({
        dashboard: 'sidebar.dashboard.view',
        interviews: 'sidebar.interviews.view',
        curriculums: 'sidebar.curriculums.view',
        create: 'sidebar.interviews.create',
        'next-steps': 'sidebar.next-steps.view',
        onboarding: 'sidebar.onboarding.view',
        'registry-collaborators': 'sidebar.registry.collaborators.view',
        'registry-users': 'sidebar.registry.users.view',
        'registry-functions': 'sidebar.registry.functions.view',
        'registry-payment-types': 'sidebar.registry.payment-types.view',
        'registry-plates-aviaries': 'sidebar.registry.plates-aviaries.view',
        'registry-infractions': 'sidebar.registry.infractions.view',
        'payroll-dashboard': 'sidebar.payroll.dashboard.view',
        'payroll-launch': 'sidebar.payroll.launch.view',
        'payroll-list': 'sidebar.payroll.list.view',
        'payroll-adjustments': 'sidebar.payroll.adjustments.view',
        'payroll-report-unit': 'sidebar.payroll.report-unit.view',
        'payroll-report-collaborator': 'sidebar.payroll.report-collaborator.view',
        'vacations-dashboard': 'sidebar.vacations.dashboard.view',
        'vacations-list': 'sidebar.vacations.list.view',
        'vacations-launch': 'sidebar.vacations.launch.view',
        'freight-dashboard': 'sidebar.freight.dashboard.view',
        'freight-launch': 'sidebar.freight.launch.view',
        'freight-list': 'sidebar.freight.list.view',
        'freight-spot': 'sidebar.freight.spot.view',
        'freight-canceled-loads': 'sidebar.freight.canceled-loads.view',
        'freight-timeline': 'sidebar.freight.timeline.view',
        'programming-dashboard': 'sidebar.programming.dashboard.view',
        'fines-dashboard': 'sidebar.fines.dashboard.view',
        'fines-launch': 'sidebar.fines.launch.view',
        'fines-list': 'sidebar.fines.list.view',
        'operations-hub': 'sidebar.operations-hub.view',
        settings: 'sidebar.settings.view',
        'activity-log': 'sidebar.activity-log.view',
    }), []);

    const links = useMemo(
        () => [
            ...(currentModule === 'home'
                ? [
                    {
                        key: 'interviews',
                        label: copy.linkInterviews,
                        href: '/transport/interviews',
                        icon: ListChecks,
                    },
                    {
                        key: 'payroll-dashboard',
                        label: copy.quickPayroll,
                        href: '/transport/payroll/dashboard',
                        icon: Wallet,
                    },
                    {
                        key: 'vacations-dashboard',
                        label: copy.quickVacations,
                        href: '/transport/vacations/dashboard',
                        icon: ClipboardCheck,
                    },
                    {
                        key: 'registry-collaborators',
                        label: copy.quickRegistry,
                        href: '/transport/registry/collaborators',
                        icon: Users,
                    },
                    {
                        key: 'freight-dashboard',
                        label: copy.quickFreight,
                        href: '/transport/freight/dashboard',
                        icon: Truck,
                    },
                    {
                        key: 'programming-dashboard',
                        label: copy.quickProgramming,
                        href: '/transport/programming/dashboard',
                        icon: CalendarDays,
                    },
                    {
                        key: 'fines-dashboard',
                        label: copy.quickFines,
                        href: '/transport/fines/dashboard',
                        icon: LayoutDashboard,
                    },
                ]
                : currentModule === 'registry'
                    ? [
                        {
                            key: 'registry-collaborators',
                            label: copy.linkCollaborators,
                            href: '/transport/registry/collaborators',
                            icon: Users,
                        },
                        {
                            key: 'registry-users',
                            label: copy.linkUsers,
                            href: '/transport/registry/users',
                            icon: UserPlus,
                        },
                        {
                            key: 'registry-functions',
                            label: copy.linkFunctions,
                            href: '/transport/registry/functions',
                            icon: Briefcase,
                        },
                        {
                            key: 'registry-payment-types',
                            label: copy.linkPaymentTypes,
                            href: '/transport/registry/payment-types',
                            icon: ReceiptText,
                        },
                        {
                            key: 'registry-plates-aviaries',
                            label: copy.linkPlatesAviaries,
                            href: '/transport/registry/plates-aviaries',
                            icon: Truck,
                        },
                        {
                            key: 'registry-infractions',
                            label: copy.linkInfractions,
                            href: '/transport/registry/infractions',
                            icon: CircleAlert,
                        },
                    ]
                  : currentModule === 'payroll'
                    ? [
                          {
                              key: 'payroll-dashboard',
                              label: copy.linkDashboard,
                              href: '/transport/payroll/dashboard',
                              icon: Wallet,
                          },
                          {
                              key: 'payroll-launch',
                              label: copy.linkLaunchPayments,
                              href: '/transport/payroll/launch',
                              icon: ReceiptText,
                          },
                          {
                              key: 'payroll-list',
                              label: copy.linkPaymentList,
                              href: '/transport/payroll/list',
                              icon: List,
                          },
                          {
                              key: 'payroll-adjustments',
                              label: copy.linkDiscounts,
                              href: '/transport/payroll/adjustments',
                              icon: ReceiptText,
                          },
                          {
                              key: 'payroll-report-unit',
                              label: copy.linkUnitReport,
                              href: '/transport/payroll/reports/unit',
                              icon: BarChart3,
                          },
                          {
                              key: 'payroll-report-collaborator',
                              label: copy.linkCollaboratorReport,
                              href: '/transport/payroll/reports/collaborator',
                              icon: ChartColumn,
                          },
                      ]
                    : currentModule === 'vacations'
                      ? [
                            {
                                key: 'vacations-dashboard',
                                label: copy.linkDashboard,
                                href: '/transport/vacations/dashboard',
                                icon: ClipboardCheck,
                            },
                            {
                                key: 'vacations-list',
                                label: copy.linkVacationList,
                                href: '/transport/vacations/list',
                                icon: List,
                            },
                            {
                                key: 'vacations-launch',
                                label: copy.linkLaunchVacation,
                                href: '/transport/vacations/launch',
                                icon: PlusSquare,
                            },
                        ]
                    : currentModule === 'freight'
                      ? [
                            {
                                key: 'freight-dashboard',
                                label: copy.linkDashboard,
                                href: '/transport/freight/dashboard',
                                icon: LayoutDashboard,
                            },
                            {
                                key: 'freight-launch',
                                label: copy.linkLaunchFreight,
                                href: '/transport/freight/launch',
                                icon: PlusSquare,
                            },
                            {
                                key: 'freight-list',
                                label: copy.linkFreightList,
                                href: '/transport/freight/list',
                                icon: List,
                            },
                            {
                                key: 'freight-spot',
                                label: copy.linkSpotFreight,
                                href: '/transport/freight/spot',
                                icon: Truck,
                            },
                            {
                                key: 'freight-canceled-loads',
                                label: copy.linkCanceledLoads,
                                href: '/transport/freight/canceled-loads',
                                icon: CircleX,
                            },
                            {
                                key: 'freight-timeline',
                                label: copy.linkAnalyticsHub,
                                href: '/transport/freight/timeline',
                                icon: TrendingUp,
                            },
                        ]
                    : currentModule === 'programming'
                      ? [
                            {
                                key: 'programming-dashboard',
                                label: copy.linkProgrammingDashboard,
                                href: '/transport/programming/dashboard',
                                icon: CalendarDays,
                            },
                        ]
                    : currentModule === 'fines'
                      ? [
                            {
                                key: 'fines-dashboard',
                                label: copy.linkFinesDashboard,
                                href: '/transport/fines/dashboard',
                                icon: LayoutDashboard,
                            },
                            {
                                key: 'fines-launch',
                                label: copy.linkFinesLaunch,
                                href: '/transport/fines/launch',
                                icon: PlusSquare,
                            },
                            {
                                key: 'fines-list',
                                label: copy.linkFinesList,
                                href: '/transport/fines/list',
                                icon: List,
                            },
                        ]
                      : [
                            {
                                key: 'dashboard',
                                label: copy.linkDashboard,
                                href: '/transport/dashboard',
                                icon: LayoutDashboard,
                            },
                            {
                                key: 'interviews',
                                label: copy.linkInterviews,
                                href: '/transport/interviews',
                                icon: ListChecks,
                            },
                            {
                                key: 'curriculums',
                                label: copy.linkCurriculums,
                                href: '/transport/interviews/curriculums',
                                icon: ScrollText,
                            },
                            {
                                key: 'create',
                                label: copy.linkNewInterview,
                                href: '/transport/interviews/create',
                                icon: PlusSquare,
                            },
                            {
                                key: 'next-steps',
                                label: copy.linkNextSteps,
                                href: '/transport/next-steps',
                                icon: Workflow,
                            },
                            {
                                key: 'onboarding',
                                label: copy.linkOnboarding,
                                href: '/transport/onboarding',
                                icon: ClipboardCheck,
                            },
                        ]),
        ],
        [copy, currentModule],
    );

    const settingsLink = useMemo(
        () => ({
            key: 'settings',
            label: copy.linkSettings,
            href: '/transport/settings',
            icon: Cog,
        }),
        [copy.linkSettings],
    );

    const fixedLinks = useMemo(
        () => [
            ...(transportFeatures.operationsHub
                ? [
                      {
                          key: 'operations-hub' as const,
                          label: copy.linkPending,
                          href: '/transport/pendencias',
                          icon: Workflow,
                      },
                  ]
                : []),
            ...(user?.role === 'master_admin'
                ? [
                      {
                          key: 'activity-log' as const,
                          label: copy.linkLog,
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
        [copy.linkLog, copy.linkPending, settingsLink.href, settingsLink.icon, settingsLink.key, settingsLink.label, user?.role],
    );

    const visibleLinks = useMemo(
        () => links.filter((link) => hasPermission(sidebarPermissionByLinkKey[link.key] ?? '')),
        [hasPermission, links, sidebarPermissionByLinkKey],
    );

    const visibleFixedLinks = useMemo(
        () => fixedLinks.filter((link) => hasPermission(sidebarPermissionByLinkKey[link.key] ?? '')),
        [fixedLinks, hasPermission, sidebarPermissionByLinkKey],
    );

    const panelTitle = useMemo(() => {
        if (currentModule === 'home') return copy.panelHome;
        if (currentModule === 'registry') return copy.panelRegistry;
        if (currentModule === 'payroll') return copy.panelPayroll;
        if (currentModule === 'vacations') return copy.panelVacations;
        if (currentModule === 'freight') return copy.panelFreight;
        if (currentModule === 'programming') return copy.panelProgramming;
        if (currentModule === 'fines') return copy.panelFines;
        return copy.panelInterviews;
    }, [copy, currentModule]);

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

            <div
                data-transport-i18n-root="transport-app"
                className="min-h-screen bg-muted/20 print:min-h-0 print:bg-white"
            >
                {globalNotice ? (
                    <Notification
                        message={globalNotice.message}
                        variant={globalNotice.variant}
                        onClose={() => setGlobalNotice(null)}
                    />
                ) : null}
                <div
                    className={`grid min-h-screen w-full grid-cols-1 gap-4 p-3 sm:p-4 lg:transition-[grid-template-columns] lg:duration-200 lg:ease-out lg:p-6 print:block print:min-h-0 print:max-w-none print:p-0 ${
                        focusMode
                            ? 'lg:grid-cols-[1fr]'
                            : sidebarCollapsed
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
                            aria-label={copy.openMenu}
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

                    {focusMode ? (
                        <div
                            className="fixed inset-y-0 left-0 z-40 hidden w-3 lg:block print:hidden"
                            onMouseEnter={showFocusSidebar}
                            onMouseLeave={() => scheduleHideFocusSidebar()}
                            aria-hidden="true"
                        />
                    ) : null}

                    <aside
                        className={`hidden h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 ease-out lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] print:hidden ${
                            focusMode ? 'lg:hidden' : 'lg:flex'
                        } ${
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
                                        aria-label={copy.expandMenu}
                                        title={copy.expandMenu}
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
                                            {hasUnsavedChanges ? copy.pendingChanges : ''}
                                        </h1>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setSidebarCollapsed(true)}
                                            aria-label={copy.collapseMenu}
                                            title={copy.collapseMenu}
                                        >
                                            <ChevronLeft className="size-4" />
                                        </Button>
                                    </div>
                                    <p
                                        data-transport-translate="off"
                                        className="mt-2 text-sm text-muted-foreground"
                                    >
                                        {user?.name} ({user?.email})
                                    </p>
                                    <p className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">
                                        {copy.profile}:{' '}
                                        {user?.role === 'master_admin'
                                            ? 'Master Admin'
                                            : user?.role === 'usuario'
                                              ? copy.roleUser
                                              : copy.roleAdmin}
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col">
                            <div className="flex-1 overflow-y-auto">
                                {!sidebarCollapsed ? (
                                    <p className="mb-2 px-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                                        {copy.moduleNavigation}
                                    </p>
                                ) : null}
                                <nav className="space-y-2">
                                    {visibleLinks.map((link) => {
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
                                        {copy.generalAccess}
                                    </p>
                                ) : null}
                                {visibleFixedLinks.map((link) => {
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
                            title={copy.logout}
                        >
                            <LogOut className="size-4" />
                            {!sidebarCollapsed ? copy.logout : null}
                        </Button>
                    </aside>

                    {focusMode ? (
                        <aside
                            className={`fixed top-6 bottom-6 left-6 z-50 hidden w-[260px] flex-col overflow-hidden rounded-xl border bg-card p-4 shadow-xl transition-all duration-200 ease-out lg:flex print:hidden ${
                                focusSidebarVisible
                                    ? 'translate-x-0 opacity-100'
                                    : '-translate-x-[120%] opacity-0 pointer-events-none'
                            }`}
                            onMouseEnter={showFocusSidebar}
                            onMouseLeave={() => scheduleHideFocusSidebar(60)}
                        >
                            <div className="mb-6 border-b pb-4">
                                <div className="mb-3 block w-full">
                                    <Link href="/transport/home" prefetch className="mb-3 block w-full">
                                        <div className="flex min-h-[96px] w-full items-center justify-center rounded-lg border bg-muted/20 p-2">
                                            <Logo className="h-16 w-full max-w-[236px] object-contain object-center" />
                                        </div>
                                    </Link>
                                </div>
                                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                    Kaique Transportes
                                </p>
                                <h1 className="mt-1 text-lg font-semibold">
                                    {panelTitle}
                                    {hasUnsavedChanges ? copy.pendingChanges : ''}
                                </h1>
                                <p
                                    data-transport-translate="off"
                                    className="mt-2 text-sm text-muted-foreground"
                                >
                                    {user?.name} ({user?.email})
                                </p>
                            </div>

                            <div className="flex min-h-0 flex-1 flex-col">
                                <div className="flex-1 overflow-y-auto">
                                    <p className="mb-2 px-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                                        {copy.moduleNavigation}
                                    </p>
                                    <nav className="space-y-2">
                                        {visibleLinks.map((link) => {
                                            const Icon = link.icon;
                                            const isActive = link.key === active;

                                            return (
                                                <Link
                                                    key={link.key}
                                                    href={link.href}
                                                    prefetch
                                                    title={link.label}
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

                                <div className="mt-4 border-t pt-4">
                                    <p className="mb-2 px-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                                        {copy.generalAccess}
                                    </p>
                                    {visibleFixedLinks.map((link) => {
                                        const Icon = link.icon;
                                        const isActive = link.key === active;

                                        return (
                                            <Link
                                                key={link.key}
                                                href={link.href}
                                                prefetch
                                                title={link.label}
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
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                className="mt-3 w-full"
                                onClick={handleLogout}
                                title={copy.logout}
                            >
                                <LogOut className="size-4" />
                                {copy.logout}
                            </Button>
                        </aside>
                    ) : null}

                    {mobileMenuOpen && (
                        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
                            <button
                                type="button"
                                className="absolute inset-0 bg-black/60"
                                onClick={() => setMobileMenuOpen(false)}
                                aria-label={copy.closeMenu}
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
                                    <p
                                        data-transport-translate="off"
                                        className="mt-2 text-sm text-muted-foreground"
                                    >
                                        {user?.name} ({user?.email})
                                    </p>
                                    <p className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">
                                        {copy.profile}:{' '}
                                        {user?.role === 'master_admin'
                                            ? 'Master Admin'
                                            : user?.role === 'usuario'
                                                ? copy.roleUser
                                                : copy.roleAdmin}
                                    </p>
                                </div>

                                <div className="flex-1 overflow-y-auto">
                                    <p className="mb-2 text-[11px] tracking-wide text-muted-foreground uppercase">
                                        {copy.moduleNavigation}
                                    </p>
                                    <nav className="space-y-2">
                                        {visibleLinks.map((link) => {
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
                                        {copy.generalAccess}
                                    </p>
                                    {visibleFixedLinks.map((link) => {
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
                                    {copy.logout}
                                </Button>
                            </aside>
                        </div>
                    )}

                    <main
                        className={`transport-page min-w-0 rounded-xl border bg-card p-3 pb-24 shadow-sm transition-[margin] duration-200 ease-out sm:p-4 sm:pb-24 lg:p-6 lg:pb-28 print:rounded-none print:border-0 print:p-0 print:shadow-none ${
                            focusMode && focusSidebarVisible
                                ? 'lg:ml-[284px]'
                                : 'lg:ml-0'
                        }`}
                    >
                        {children}
                    </main>
                </div>
            </div>

            {bobEnabled && showBobChat ? (
                <Suspense fallback={null}>
                    <BobChatButton />
                </Suspense>
            ) : null}

            <Dialog open={navigationOpen} onOpenChange={setNavigationOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{copy.quickNavigationTitle}</DialogTitle>
                        <DialogDescription>
                            {copy.quickNavigationDescription}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Input
                            autoFocus
                            placeholder={copy.quickNavigationPlaceholder}
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
                                <span className="font-medium">{copy.quickInterviews}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                    2
                                </span>
                                <span className="font-medium">{copy.quickPayroll}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                    3
                                </span>
                                <span className="font-medium">{copy.quickVacations}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                    4
                                </span>
                                <span className="font-medium">{copy.quickRegistry}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                    5
                                </span>
                                <span className="font-medium">
                                    {copy.quickFreight}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                    6
                                </span>
                                <span className="font-medium">
                                    {copy.quickProgramming}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                    7
                                </span>
                                <span className="font-medium">
                                    {copy.quickFines}
                                </span>
                            </div>
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        {copy.shortcutsLegend}
                    </p>
                </DialogContent>
            </Dialog>
        </>
    );
}
