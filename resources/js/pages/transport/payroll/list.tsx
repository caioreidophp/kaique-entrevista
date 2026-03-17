import { LoaderCircle, PencilLine, Printer, Trash2 } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';
import { formatCurrencyBR, formatDateBR } from '@/lib/transport-format';

interface Unidade {
    id: number;
    nome: string;
}

interface TipoPagamento {
    id: number;
    nome: string;
    categoria?: 'salario' | 'beneficios' | 'extras';
}

interface Colaborador {
    id: number;
    nome: string;
    cpf?: string | null;
    nome_banco?: string | null;
    numero_banco?: string | null;
    numero_agencia?: string | null;
    tipo_conta?: string | null;
    numero_conta?: string | null;
    tipo_chave_pix?: string | null;
    chave_pix?: string | null;
    banco_salario?: string | null;
    numero_agencia_salario?: string | null;
    numero_conta_salario?: string | null;
    conta_pagamento?: string | null;
}

interface Pagamento {
    id: number;
    colaborador_id: number;
    unidade_id: number;
    tipo_pagamento_id: number | null;
    valor: string;
    descricao: string | null;
    data_pagamento: string | null;
    competencia_mes: number;
    competencia_ano: number;
    observacao?: string | null;
    colaborador?: Colaborador;
    unidade?: Unidade;
}

interface GroupedPayment {
    key: string;
    colaborador: Colaborador;
    unidade: Unidade | null;
    descricao: string;
    data_pagamento: string | null;
    byType: Map<number, Pagamento>;
    allItems: Pagamento[];
}

interface LaunchGroup {
    key: string;
    descricao: string;
    unidade: Unidade | null;
    data_pagamento: string | null;
    competencia_mes: number;
    competencia_ano: number;
    tipoIds: number[];
    colaboradores: GroupedPayment[];
    total: number;
}

interface SortState {
    key: 'colaborador' | 'valor' | 'total';
    direction: 'asc' | 'desc';
}

interface PaginatedResponse<T> {
    current_page: number;
    data: T[];
    last_page: number;
    total: number;
}

interface WrappedResponse<T> {
    data: T;
}

interface DescontoAplicadoPreview {
    id: number;
    descricao: string;
    tipo_saida: 'extras' | 'salario' | 'beneficios' | 'direto';
    aplicado_no_mes: number;
    saldo_restante: number;
}

interface LaunchCollaboratorPreview {
    colaborador_id: number;
    total_bruto: number;
    total_descontado: number;
    total_liquido: number;
    descontos: DescontoAplicadoPreview[];
}

interface LaunchDiscountPreviewResponse {
    data: LaunchCollaboratorPreview[];
}

interface PensaoColaborador {
    id: number;
    colaborador_id: number;
    nome_beneficiaria: string;
    cpf_beneficiaria: string | null;
    valor: string;
    nome_banco: string;
    numero_agencia: string;
    tipo_conta: string;
    numero_conta: string;
    tipo_chave_pix: string | null;
    chave_pix: string | null;
    ativo: boolean;
}

interface LaunchDraftCandidate {
    id: number;
    nome: string;
    cpf: string;
    unidade?: Unidade;
    pagamentos_existentes_por_tipo: Record<
        string,
        {
            id: number;
            valor: number;
        }
    >;
    pensoes: Array<{
        id: number;
        nome_beneficiaria: string;
        cpf_beneficiaria?: string | null;
        nome_banco?: string | null;
        numero_agencia?: string | null;
        tipo_conta?: string | null;
        numero_conta?: string | null;
        tipo_chave_pix?: string | null;
        chave_pix?: string | null;
    }>;
}

interface LaunchDraftSnapshot {
    version: number;
    updatedAt: string;
    data: {
        descricao: string;
        dataPagamento: string;
        unidadeId: string;
        selectedTipoIds: number[];
        candidates: LaunchDraftCandidate[];
        selectedCollaborators: Record<number, boolean>;
        values: Record<string, string>;
        pensionValues: Record<string, string>;
        defaultWorkDays?: string;
        defaultVrDaily?: string;
        defaultVtDaily?: string;
        workDaysByCollaborator?: Record<number, string>;
    };
}

const now = new Date();
const defaultMonth = String(now.getMonth() + 1);
const defaultYear = String(now.getFullYear());
const PAYROLL_LAUNCH_DRAFT_STORAGE_KEY = 'transport:payroll:launch-draft:v1';

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function printHtmlWithFallback(html: string): boolean {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    const win = iframe.contentWindow;

    if (!doc || !win) {
        document.body.removeChild(iframe);
        return false;
    }

    doc.open();
    doc.write(html);
    doc.close();

    window.setTimeout(() => {
        win.focus();
        win.print();
        window.setTimeout(() => {
            document.body.removeChild(iframe);
        }, 800);
    }, 100);

    return true;
}

function formatCpf(value: string | null | undefined): string {
    if (!value) return '-';
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length !== 11) return value;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function parsePensionValuesFromObservation(observacao: string | null | undefined): Map<number, number> {
    if (!observacao) return new Map();

    try {
        const parsed = JSON.parse(observacao) as {
            pensoes?: Array<{ pensao_id?: number; valor?: number | string }>;
        };

        const entries = (parsed.pensoes ?? [])
            .map((item) => ({
                pensaoId: Number(item.pensao_id ?? 0),
                valor: Number(item.valor ?? 0),
            }))
            .filter((item) => item.pensaoId > 0 && Number.isFinite(item.valor) && item.valor > 0);

        return new Map(entries.map((item) => [item.pensaoId, item.valor] as const));
    } catch {
        return new Map();
    }
}

export default function TransportPayrollListPage() {
    const [items, setItems] = useState<Pagamento[]>([]);
    const [tipos, setTipos] = useState<TipoPagamento[]>([]);
    const [unidades, setUnidades] = useState<Unidade[]>([]);
    const [pensoes, setPensoes] = useState<PensaoColaborador[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [printingLaunchKey, setPrintingLaunchKey] = useState<string | null>(null);

    const [monthFilter, setMonthFilter, resetMonthFilter] = usePersistedState(
        'transport:payroll:list:monthFilter',
        defaultMonth,
    );
    const [yearFilter, setYearFilter, resetYearFilter] = usePersistedState(
        'transport:payroll:list:yearFilter',
        defaultYear,
    );
    const [unidadeFilter, setUnidadeFilter, resetUnidadeFilter] = usePersistedState(
        'transport:payroll:list:unidadeFilter',
        'all',
    );

    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const [deleteCandidate, setDeleteCandidate] = useState<GroupedPayment | null>(null);
    const [deleteLaunchCandidate, setDeleteLaunchCandidate] = useState<LaunchGroup | null>(null);
    const [editCandidate, setEditCandidate] = useState<GroupedPayment | null>(null);
    const [editDate, setEditDate] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editValues, setEditValues] = useState<Record<number, string>>({});

    const [expandedLaunchKey, setExpandedLaunchKey] = useState<string | null>(null);
    const [launchSorts, setLaunchSorts] = useState<Record<string, SortState>>({});

    const monthOptions = useMemo(
        () => [
            { value: '1', label: 'Jan' },
            { value: '2', label: 'Fev' },
            { value: '3', label: 'Mar' },
            { value: '4', label: 'Abr' },
            { value: '5', label: 'Mai' },
            { value: '6', label: 'Jun' },
            { value: '7', label: 'Jul' },
            { value: '8', label: 'Ago' },
            { value: '9', label: 'Set' },
            { value: '10', label: 'Out' },
            { value: '11', label: 'Nov' },
            { value: '12', label: 'Dez' },
        ],
        [],
    );

    const yearOptions = useMemo(
        () => [
            String(now.getFullYear() - 1),
            String(now.getFullYear()),
            String(now.getFullYear() + 1),
        ],
        [],
    );

    const groupedItems = useMemo(() => {
        const map = new Map<string, GroupedPayment>();

        items.forEach((item) => {
            if (!item.colaborador) return;

            const key = [
                item.colaborador_id,
                item.unidade_id,
                item.data_pagamento ?? `${item.competencia_ano}-${String(item.competencia_mes).padStart(2, '0')}-01`,
                item.descricao ?? '',
            ].join('|');

            if (!map.has(key)) {
                map.set(key, {
                    key,
                    colaborador: item.colaborador,
                    unidade: item.unidade ?? null,
                    descricao: item.descricao ?? '-',
                    data_pagamento: item.data_pagamento,
                    byType: new Map<number, Pagamento>(),
                    allItems: [],
                });
            }

            const group = map.get(key);
            if (!group) return;

            if (item.tipo_pagamento_id) {
                group.byType.set(item.tipo_pagamento_id, item);
            }
            group.allItems.push(item);
        });

        return Array.from(map.values());
    }, [items]);

    const launchGroups = useMemo(() => {
        const map = new Map<string, LaunchGroup>();

        groupedItems.forEach((item) => {
            const reference = item.allItems[0];
            const competenciaMes = Number(reference?.competencia_mes ?? now.getMonth() + 1);
            const competenciaAno = Number(reference?.competencia_ano ?? now.getFullYear());
            const dataBase = item.data_pagamento ?? `${competenciaAno}-${String(competenciaMes).padStart(2, '0')}-01`;
            const key = [
                item.descricao,
                item.unidade?.id ?? 'no-unit',
                dataBase,
                competenciaMes,
                competenciaAno,
            ].join('|');

            if (!map.has(key)) {
                map.set(key, {
                    key,
                    descricao: item.descricao,
                    unidade: item.unidade,
                    data_pagamento: item.data_pagamento,
                    competencia_mes: competenciaMes,
                    competencia_ano: competenciaAno,
                    tipoIds: [],
                    colaboradores: [],
                    total: 0,
                });
            }

            const launch = map.get(key);
            if (!launch) return;

            const rowTotal = Array.from(item.byType.values()).reduce(
                (acc, pagamento) => acc + Number(pagamento.valor ?? 0),
                0,
            );

            launch.colaboradores.push(item);
            launch.total += rowTotal;

            Array.from(item.byType.keys()).forEach((tipoId) => {
                if (!launch.tipoIds.includes(tipoId)) {
                    launch.tipoIds.push(tipoId);
                }
            });
        });

        return Array.from(map.values()).sort((a, b) => {
            const dateA = a.data_pagamento ?? `${a.competencia_ano}-${String(a.competencia_mes).padStart(2, '0')}-01`;
            const dateB = b.data_pagamento ?? `${b.competencia_ano}-${String(b.competencia_mes).padStart(2, '0')}-01`;

            return dateB.localeCompare(dateA);
        });
    }, [groupedItems]);

    async function loadOptions(): Promise<void> {
        try {
            const [unitsRes, tiposRes, pensoesRes] = await Promise.all([
                apiGet<WrappedResponse<Unidade[]>>('/registry/unidades'),
                apiGet<WrappedResponse<TipoPagamento[]>>('/registry/tipos-pagamento'),
                apiGet<WrappedResponse<PensaoColaborador[]>>('/payroll/pensoes?ativo=1'),
            ]);
            setUnidades(unitsRes.data);
            setTipos(tiposRes.data);
            setPensoes(pensoesRes.data);
        } catch {
            setNotification({
                message: 'Não foi possível carregar filtros e tipos de pagamento.',
                variant: 'error',
            });
        }
    }

    function buildQuery(page: number): string {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('per_page', '80');
        params.set('competencia_mes', monthFilter);
        params.set('competencia_ano', yearFilter);

        if (unidadeFilter !== 'all') {
            params.set('unidade_id', unidadeFilter);
        }

        return params.toString();
    }

    async function load(page = 1): Promise<void> {
        setLoading(true);
        setNotification(null);

        try {
            const response = await apiGet<PaginatedResponse<Pagamento>>(`/payroll/pagamentos?${buildQuery(page)}`);
            setItems(response.data);
            setCurrentPage(response.current_page);
            setLastPage(response.last_page);
            setTotal(response.total);
        } catch {
            setNotification({
                message: 'Não foi possível carregar a lista de pagamentos.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadOptions();
        void load(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function clearFilters(): void {
        resetMonthFilter();
        resetYearFilter();
        resetUnidadeFilter();
        void load(1);
    }

    function toggleLaunchExpanded(launchKey: string): void {
        setExpandedLaunchKey((previous) => {
            if (previous === launchKey) {
                return null;
            }

            setLaunchSorts((current) => ({
                ...current,
                [launchKey]: current[launchKey] ?? {
                    key: 'colaborador',
                    direction: 'asc',
                },
            }));

            return launchKey;
        });
    }

    function toggleLaunchSort(launchKey: string, nextKey: SortState['key']): void {
        setLaunchSorts((previous) => {
            const current = previous[launchKey] ?? {
                key: 'colaborador',
                direction: 'asc' as const,
            };

            if (current.key === nextKey) {
                return {
                    ...previous,
                    [launchKey]: {
                        key: nextKey,
                        direction: current.direction === 'asc' ? 'desc' : 'asc',
                    },
                };
            }

            return {
                ...previous,
                [launchKey]: {
                    key: nextKey,
                    direction: 'asc',
                },
            };
        });
    }

    function getSortIndicator(launchKey: string, key: SortState['key']): string {
        const sort = launchSorts[launchKey] ?? { key: 'colaborador', direction: 'asc' as const };

        if (sort.key !== key) return '';

        return sort.direction === 'asc' ? ' ↑' : ' ↓';
    }

    function getSortedCollaborators(launch: LaunchGroup): GroupedPayment[] {
        const sort = launchSorts[launch.key] ?? { key: 'colaborador', direction: 'asc' as const };
        const rows = [...launch.colaboradores];

        rows.sort((first, second) => {
            const firstTotal = launch.tipoIds.reduce((acc, tipoId) => acc + Number(first.byType.get(tipoId)?.valor ?? 0), 0);
            const secondTotal = launch.tipoIds.reduce((acc, tipoId) => acc + Number(second.byType.get(tipoId)?.valor ?? 0), 0);
            const firstPrimaryType = Number(first.byType.get(launch.tipoIds[0] ?? 0)?.valor ?? 0);
            const secondPrimaryType = Number(second.byType.get(launch.tipoIds[0] ?? 0)?.valor ?? 0);

            let comparison = 0;

            if (sort.key === 'colaborador') {
                comparison = first.colaborador.nome.localeCompare(second.colaborador.nome, 'pt-BR', {
                    sensitivity: 'base',
                });
            } else if (sort.key === 'valor') {
                comparison = firstPrimaryType - secondPrimaryType;
            } else {
                comparison = firstTotal - secondTotal;
            }

            if (comparison === 0) {
                comparison = first.colaborador.nome.localeCompare(second.colaborador.nome, 'pt-BR', {
                    sensitivity: 'base',
                });
            }

            return sort.direction === 'asc' ? comparison : -comparison;
        });

        return rows;
    }

    function openEditDialog(item: GroupedPayment): void {
        setEditCandidate(item);
        setEditDate(item.data_pagamento ? item.data_pagamento.slice(0, 10) : '');
        setEditDescription(item.descricao === '-' ? '' : item.descricao);

        const values: Record<number, string> = {};
        tipos.forEach((tipo) => {
            values[tipo.id] = item.byType.get(tipo.id)?.valor ? String(item.byType.get(tipo.id)?.valor) : '0';
        });
        setEditValues(values);
    }

    async function saveEdition(): Promise<void> {
        if (!editCandidate) return;

        const payloads = editCandidate.allItems.map((item) => ({
            id: item.id,
            payload: {
                valor: editValues[item.tipo_pagamento_id ?? 0] ?? item.valor,
                descricao: editDescription || null,
                data_pagamento: editDate || null,
            },
        }));

        setSaving(true);
        setNotification(null);

        try {
            await Promise.all(payloads.map((entry) => apiPut(`/payroll/pagamentos/${entry.id}`, entry.payload)));
            setNotification({ message: 'Pagamentos atualizados com sucesso.', variant: 'success' });
            setEditCandidate(null);
            await load(currentPage);
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({ message: error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível atualizar os pagamentos.', variant: 'error' });
            }
        } finally {
            setSaving(false);
        }
    }

    async function confirmDelete(): Promise<void> {
        if (!deleteCandidate) return;

        setDeleting(true);

        try {
            await Promise.all(deleteCandidate.allItems.map((item) => apiDelete(`/payroll/pagamentos/${item.id}`)));
            setNotification({ message: 'Lançamento excluído com sucesso.', variant: 'success' });
            setDeleteCandidate(null);
            await load(currentPage);
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({ message: error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível excluir o lançamento.', variant: 'error' });
            }
        } finally {
            setDeleting(false);
        }
    }

    async function confirmDeleteLaunch(): Promise<void> {
        if (!deleteLaunchCandidate) return;

        const paymentIds = Array.from(
            new Set(
                deleteLaunchCandidate.colaboradores.flatMap((grouped) =>
                    grouped.allItems.map((payment) => payment.id),
                ),
            ),
        );

        if (paymentIds.length === 0) {
            setDeleteLaunchCandidate(null);
            return;
        }

        setDeleting(true);

        try {
            await Promise.all(paymentIds.map((id) => apiDelete(`/payroll/pagamentos/${id}`)));
            setNotification({ message: 'Pagamento completo excluído com sucesso.', variant: 'success' });
            if (expandedLaunchKey === deleteLaunchCandidate.key) {
                setExpandedLaunchKey(null);
            }
            setDeleteLaunchCandidate(null);
            await load(currentPage);
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({ message: error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível excluir o pagamento completo.', variant: 'error' });
            }
        } finally {
            setDeleting(false);
        }
    }

    function editFullLaunch(launch: LaunchGroup): void {
        const selectedCollaborators: Record<number, boolean> = {};
        const values: Record<string, string> = {};
        const pensionValues: Record<string, string> = {};
        const workDaysByCollaborator: Record<number, string> = {};

        const candidates: LaunchDraftCandidate[] = launch.colaboradores.map((row) => {
            selectedCollaborators[row.colaborador.id] = true;
            workDaysByCollaborator[row.colaborador.id] = '0';

            const pagamentosExistentesPorTipo: Record<string, { id: number; valor: number }> = {};

            launch.tipoIds.forEach((tipoId) => {
                const pagamento = row.byType.get(tipoId);
                if (!pagamento) return;

                pagamentosExistentesPorTipo[String(tipoId)] = {
                    id: pagamento.id,
                    valor: Number(pagamento.valor ?? 0),
                };
                values[`${row.colaborador.id}:${tipoId}`] = String(pagamento.valor ?? '0');
            });

            const salaryObservation = row.allItems
                .map((payment) => payment.observacao)
                .find((value) => Boolean(value));
            const launchPensionValues = parsePensionValuesFromObservation(salaryObservation);

            const collaboratorPensoes = pensoes
                .filter((pensao) => pensao.ativo && pensao.colaborador_id === row.colaborador.id)
                .map((pensao) => {
                    const value = launchPensionValues.get(pensao.id);
                    if (value && value > 0) {
                        pensionValues[`${row.colaborador.id}:${pensao.id}`] = String(value);
                    }

                    return {
                        id: pensao.id,
                        nome_beneficiaria: pensao.nome_beneficiaria,
                        cpf_beneficiaria: pensao.cpf_beneficiaria,
                        nome_banco: pensao.nome_banco,
                        numero_agencia: pensao.numero_agencia,
                        tipo_conta: pensao.tipo_conta,
                        numero_conta: pensao.numero_conta,
                        tipo_chave_pix: pensao.tipo_chave_pix,
                        chave_pix: pensao.chave_pix,
                    };
                });

            return {
                id: row.colaborador.id,
                nome: row.colaborador.nome,
                cpf: row.colaborador.cpf ?? '',
                unidade: launch.unidade ?? undefined,
                pagamentos_existentes_por_tipo: pagamentosExistentesPorTipo,
                pensoes: collaboratorPensoes,
            };
        });

        const snapshot: LaunchDraftSnapshot = {
            version: 1,
            updatedAt: new Date().toISOString(),
            data: {
                descricao: launch.descricao === '-' ? '' : launch.descricao,
                dataPagamento:
                    launch.data_pagamento ??
                    `${launch.competencia_ano}-${String(launch.competencia_mes).padStart(2, '0')}-01`,
                unidadeId: String(launch.unidade?.id ?? ''),
                selectedTipoIds: launch.tipoIds,
                candidates,
                selectedCollaborators,
                values,
                pensionValues,
                defaultWorkDays: '0',
                defaultVrDaily: '0',
                defaultVtDaily: '0',
                workDaysByCollaborator,
            },
        };

        if (typeof window !== 'undefined') {
            window.localStorage.setItem(PAYROLL_LAUNCH_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
            window.location.href = '/transport/payroll/launch';
        }
    }

    async function printLaunch(launch: LaunchGroup): Promise<void> {
        setPrintingLaunchKey(launch.key);

        try {
            const isSalaryOnly =
                launch.tipoIds.length > 0 &&
                launch.tipoIds.every((tipoId) => {
                    const tipo = tipos.find((item) => item.id === tipoId);
                    return tipo?.categoria === 'salario';
                });

            const payloadRows = launch.colaboradores.map((row) => {
                const categoriaTotais = {
                    salario: 0,
                    beneficios: 0,
                    extras: 0,
                };

                launch.tipoIds.forEach((tipoId) => {
                    const tipo = tipos.find((item) => item.id === tipoId);
                    const categoria = tipo?.categoria;

                    if (!categoria) return;

                    categoriaTotais[categoria] += Number(row.byType.get(tipoId)?.valor ?? 0);
                });

                return {
                    colaborador_id: row.colaborador.id,
                    categoria_totais: categoriaTotais,
                };
            });

            const preview = await apiPost<LaunchDiscountPreviewResponse>('/payroll/launch-discount-preview', {
                competencia_mes: launch.competencia_mes,
                competencia_ano: launch.competencia_ano,
                rows: payloadRows,
            });

            const previewMap = new Map<number, LaunchCollaboratorPreview>();
            preview.data.forEach((item) => {
                previewMap.set(item.colaborador_id, item);
            });

            if (isSalaryOnly) {
                const salaryOnlyRows = [...launch.colaboradores].sort((a, b) =>
                    a.colaborador.nome.localeCompare(b.colaborador.nome, 'pt-BR', { sensitivity: 'base' }),
                );
                const pensionByCollaborator = new Map<number, PensaoColaborador[]>();

                pensoes.forEach((item) => {
                    if (!item.ativo) return;
                    const current = pensionByCollaborator.get(item.colaborador_id) ?? [];
                    current.push(item);
                    pensionByCollaborator.set(item.colaborador_id, current);
                });

                const specialRows: Array<string> = [];
                const salaryRows: Array<string> = [];
                let totalContaSalario = 0;
                let totalGeral = 0;

                salaryOnlyRows.forEach((row) => {
                    const collaborator = row.colaborador;
                    const previewItem = previewMap.get(collaborator.id);
                    const baseLiquid = Number(previewItem?.total_liquido ?? 0);
                    const collaboratorPensoes = pensionByCollaborator.get(collaborator.id) ?? [];
                    const salaryObservation = row.allItems
                        .map((payment) => payment.observacao)
                        .find((value) => Boolean(value));
                    const launchPensionValues = parsePensionValuesFromObservation(salaryObservation);

                    let pensionAppliedTotal = 0;
                    const pensionRowsForCollaborator: Array<string> = [];

                    collaboratorPensoes.forEach((pensao) => {
                        const pensionValue = Number(launchPensionValues.get(pensao.id) ?? 0);
                        if (pensionValue <= 0) return;
                        const applied = pensionValue;
                        pensionAppliedTotal += applied;

                        if (applied > 0) {
                            pensionRowsForCollaborator.push(`
                                <tr>
                                    <td>${escapeHtml(`${collaborator.nome} - Pensão`)}</td>
                                    <td>${escapeHtml(formatCurrencyBR(applied))}</td>
                                    <td>${escapeHtml(pensao.nome_banco ?? '-')}</td>
                                    <td>${escapeHtml(pensao.numero_agencia ?? '-')}</td>
                                    <td>${escapeHtml(pensao.tipo_conta ?? '-')}</td>
                                    <td>${escapeHtml(pensao.numero_conta ?? '-')}</td>
                                    <td>${escapeHtml(pensao.chave_pix ?? '-')}</td>
                                    <td>${escapeHtml(formatCpf(pensao.cpf_beneficiaria))}</td>
                                </tr>
                            `);
                        }
                    });

                    const collaboratorPay = Math.max(baseLiquid, 0);
                    const isParticular = collaborator.conta_pagamento === 'particular';
                    const targetRows = isParticular ? specialRows : salaryRows;

                    const bankName = isParticular
                        ? collaborator.nome_banco ?? '-'
                        : collaborator.banco_salario ?? 'CONTA SALÁRIO';
                    const agency = isParticular
                        ? collaborator.numero_agencia ?? '-'
                        : collaborator.numero_agencia_salario ?? '-';
                    const accountType = isParticular
                        ? collaborator.tipo_conta ?? '-'
                        : 'SAL';
                    const accountNumber = isParticular
                        ? collaborator.numero_conta ?? '-'
                        : collaborator.numero_conta_salario ?? '-';
                    const pix = isParticular ? collaborator.chave_pix ?? '-' : '-';

                    targetRows.push(`
                        <tr>
                            <td>${escapeHtml(collaborator.nome)}</td>
                            <td>${escapeHtml(formatCurrencyBR(collaboratorPay))}</td>
                            <td>${escapeHtml(bankName)}</td>
                            <td>${escapeHtml(agency)}</td>
                            <td>${escapeHtml(accountType)}</td>
                            <td>${escapeHtml(accountNumber)}</td>
                            <td>${escapeHtml(pix)}</td>
                            <td>-</td>
                        </tr>
                    `);

                    if (pensionRowsForCollaborator.length > 0) {
                        specialRows.push(...pensionRowsForCollaborator);
                    }

                    if (!isParticular) {
                        totalContaSalario += collaboratorPay;
                    }

                    totalGeral += collaboratorPay + pensionAppliedTotal;
                });

                const htmlSalary = `
                    <!doctype html>
                    <html lang="pt-BR">
                    <head>
                        <meta charset="UTF-8" />
                        <title>Planilha de Salário Mensal</title>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 12px; color: #111; }
                            h1, h2 { margin: 0 0 6px; }
                            p { margin: 0 0 3px; font-size: 11px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                            th, td { border: 1px solid #cfcfcf; padding: 4px; text-align: left; font-size: 10px; }
                            th { background: #f3f4f6; }
                            .section { margin-top: 10px; }
                            .meta { margin-top: 10px; }
                            .header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
                            .logo { width: 178px; max-height: 50px; object-fit: contain; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>Planilha de Salário Mensal</h1>
                            <img src="/logo/logokaique.png" class="logo" alt="Kaique" onerror="this.style.display='none'" />
                        </div>
                        <p><strong>Lançamento:</strong> ${escapeHtml(launch.descricao)}</p>
                        <p><strong>Unidade:</strong> ${escapeHtml(launch.unidade?.nome ?? '-')}</p>
                        <p><strong>Data do pagamento:</strong> ${escapeHtml(formatDateBR(launch.data_pagamento))}</p>
                        <p><strong>Competência:</strong> ${escapeHtml(String(launch.competencia_mes).padStart(2, '0'))}/${escapeHtml(String(launch.competencia_ano))}</p>

                        <div class="section">
                            <h2>Conta Particular e Pensões</h2>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Valor</th>
                                        <th>Banco</th>
                                        <th>Agência</th>
                                        <th>Tipo</th>
                                        <th>Nº Conta</th>
                                        <th>PIX</th>
                                        <th>CPF</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${specialRows.length > 0 ? specialRows.join('') : '<tr><td colspan="8">Sem pagamentos neste bloco.</td></tr>'}
                                </tbody>
                            </table>
                        </div>

                        <div class="section">
                            <h2>Conta Salário</h2>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Valor</th>
                                        <th>Banco</th>
                                        <th>Agência</th>
                                        <th>Tipo</th>
                                        <th>Nº Conta</th>
                                        <th>PIX</th>
                                        <th>CPF</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${salaryRows.length > 0 ? salaryRows.join('') : '<tr><td colspan="8">Sem pagamentos neste bloco.</td></tr>'}
                                </tbody>
                            </table>
                        </div>

                        <div class="meta">
                            <p><strong>Soma apenas conta salário:</strong> ${escapeHtml(formatCurrencyBR(totalContaSalario))}</p>
                            <p><strong>Soma total (conta salário + pensão + conta particular):</strong> ${escapeHtml(formatCurrencyBR(totalGeral))}</p>
                        </div>
                    </body>
                    </html>
                `;

                if (!printHtmlWithFallback(htmlSalary)) {
                    setNotification({
                        message: 'Não foi possível preparar a impressão no navegador.',
                        variant: 'error',
                    });
                }
                return;
            }

            const typeHeaders = launch.tipoIds
                .map((tipoId) => `<th>${escapeHtml(tipos.find((tipo) => tipo.id === tipoId)?.nome ?? 'Tipo')}</th>`)
                .join('');

            const sortedRows = getSortedCollaborators(launch);

            const tableRows = sortedRows
                .map((row) => {
                    const collaboratorPreview = previewMap.get(row.colaborador.id);
                    const grossTotal = launch.tipoIds.reduce(
                        (acc, tipoId) => acc + Number(row.byType.get(tipoId)?.valor ?? 0),
                        0,
                    );

                    const discountTotal = Number(collaboratorPreview?.total_descontado ?? 0);
                    const netTotal = Number(collaboratorPreview?.total_liquido ?? grossTotal);

                    const cells = launch.tipoIds
                        .map((tipoId) => `<td>${escapeHtml(formatCurrencyBR(row.byType.get(tipoId)?.valor ?? 0))}</td>`)
                        .join('');

                    const discountDetail = (collaboratorPreview?.descontos ?? [])
                        .filter((item) => item.aplicado_no_mes > 0 || item.saldo_restante > 0)
                        .map((item) => {
                            const applied = formatCurrencyBR(item.aplicado_no_mes);
                            const remaining = formatCurrencyBR(item.saldo_restante);
                            return `${escapeHtml(item.descricao)} (aplicado: ${escapeHtml(applied)} | saldo: ${escapeHtml(remaining)})`;
                        })
                        .join(' | ');

                    return `
                        <tr>
                            <td>${escapeHtml(row.colaborador.nome)}</td>
                            ${cells}
                            <td>${escapeHtml(formatCurrencyBR(grossTotal))}</td>
                            <td>${escapeHtml(formatCurrencyBR(discountTotal))}</td>
                            <td>${escapeHtml(formatCurrencyBR(netTotal))}</td>
                            <td>${discountDetail || '-'}</td>
                        </tr>
                    `;
                })
                .join('');

            const totalBruto = sortedRows.reduce(
                (acc, row) =>
                    acc +
                    launch.tipoIds.reduce(
                        (inner, tipoId) => inner + Number(row.byType.get(tipoId)?.valor ?? 0),
                        0,
                    ),
                0,
            );

            const totalDescontado = preview.data.reduce((acc, row) => acc + Number(row.total_descontado ?? 0), 0);
            const totalLiquido = Math.max(totalBruto - totalDescontado, 0);

            const html = `
                <!doctype html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8" />
                    <title>Planilha de Pagamento</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
                        h1 { margin: 0 0 8px; }
                        p { margin: 0 0 6px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 14px; }
                        th, td { border: 1px solid #cfcfcf; padding: 7px; text-align: left; font-size: 12px; }
                        th { background: #f3f4f6; }
                        .meta { margin-top: 10px; }
                    </style>
                </head>
                <body>
                    <h1>Planilha de Pagamento - Lançamento Agrupado</h1>
                    <p><strong>Lançamento:</strong> ${escapeHtml(launch.descricao)}</p>
                    <p><strong>Unidade:</strong> ${escapeHtml(launch.unidade?.nome ?? '-')}</p>
                    <p><strong>Data:</strong> ${escapeHtml(formatDateBR(launch.data_pagamento))}</p>
                    <p><strong>Competência:</strong> ${escapeHtml(String(launch.competencia_mes).padStart(2, '0'))}/${escapeHtml(String(launch.competencia_ano))}</p>

                    <table>
                        <thead>
                            <tr>
                                <th>Colaborador</th>
                                ${typeHeaders}
                                <th>Total Bruto</th>
                                <th>Desconto no Mês</th>
                                <th>Total Líquido (a pagar)</th>
                                <th>Detalhe de desconto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>

                    <div class="meta">
                        <p><strong>Total bruto do lançamento:</strong> ${escapeHtml(formatCurrencyBR(totalBruto))}</p>
                        <p><strong>Total de descontos aplicados:</strong> ${escapeHtml(formatCurrencyBR(totalDescontado))}</p>
                        <p><strong>Total líquido para pagamento:</strong> ${escapeHtml(formatCurrencyBR(totalLiquido))}</p>
                    </div>
                </body>
                </html>
            `;

            if (!printHtmlWithFallback(html)) {
                setNotification({
                    message: 'Não foi possível preparar a impressão no navegador.',
                    variant: 'error',
                });
            }
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({ message: error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível gerar a planilha agrupada.', variant: 'error' });
            }
        } finally {
            setPrintingLaunchKey(null);
        }
    }

    return (
        <AdminLayout title="Pagamentos - Lista de Pagamentos" active="payroll-list" module="payroll">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Lista de Pagamentos</h2>
                    <p className="text-sm text-muted-foreground">
                        Cada linha representa um lançamento por nome/descrição. Expanda para ver os colaboradores.
                    </p>
                </div>

                {notification ? <Notification message={notification.message} variant={notification.variant} /> : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-4">
                            <div className="space-y-2">
                                <Label>Mês</Label>
                                <Select value={monthFilter} onValueChange={setMonthFilter}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {monthOptions.map((month) => (
                                            <SelectItem key={month.value} value={month.value}>
                                                {month.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Ano</Label>
                                <Select value={yearFilter} onValueChange={setYearFilter}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {yearOptions.map((year) => (
                                            <SelectItem key={year} value={year}>
                                                {year}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Unidade</Label>
                                <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        {unidades.map((unit) => (
                                            <SelectItem key={unit.id} value={String(unit.id)}>
                                                {unit.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end gap-2">
                                <Button variant="outline" onClick={() => void load(1)}>
                                    Aplicar filtros
                                </Button>
                                <Button variant="outline" onClick={clearFilters}>
                                    Limpar
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Lançamentos agrupados ({launchGroups.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando pagamentos...
                            </div>
                        ) : launchGroups.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum pagamento encontrado.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full table-fixed text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="w-[16%] py-2 pr-3 font-medium">Lançamento</th>
                                            <th className="w-[10%] py-2 pr-3 font-medium">Unidade</th>
                                            <th className="py-2 pr-3 font-medium">Tipos</th>
                                            <th className="w-[9%] py-2 px-3 text-center font-medium">Colaboradores</th>
                                            <th className="w-[10%] py-2 pr-3 font-medium">Total</th>
                                            <th className="w-[9%] py-2 pr-3 font-medium">Data</th>
                                            <th className="w-[26%] py-2 text-right font-medium">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {launchGroups.map((launch) => {
                                            const isExpanded = expandedLaunchKey === launch.key;
                                            return (
                                                <Fragment key={launch.key}>
                                                    <tr
                                                        className="cursor-pointer border-b hover:bg-muted/20"
                                                        onClick={() => toggleLaunchExpanded(launch.key)}
                                                    >
                                                        <td className="py-2 pr-3 font-medium">{launch.descricao}</td>
                                                        <td className="py-2 pr-3">{launch.unidade?.nome ?? '-'}</td>
                                                        <td className="py-2 pr-3">
                                                            <div className="flex flex-wrap gap-1">
                                                                {launch.tipoIds.map((tipoId) => (
                                                                    <span key={`${launch.key}-${tipoId}`} className="rounded-full border px-2 py-0.5 text-xs">
                                                                        {tipos.find((tipo) => tipo.id === tipoId)?.nome ?? 'Tipo'}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-3 text-center align-middle font-medium">{launch.colaboradores.length}</td>
                                                        <td className="py-2 pr-3 font-semibold">{formatCurrencyBR(launch.total)}</td>
                                                        <td className="py-2 pr-3">{formatDateBR(launch.data_pagamento)}</td>
                                                        <td className="py-2">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        toggleLaunchExpanded(launch.key);
                                                                    }}
                                                                >
                                                                    {isExpanded ? 'Ocultar' : 'Expandir'}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        editFullLaunch(launch);
                                                                    }}
                                                                >
                                                                    <PencilLine className="size-4" />
                                                                    Editar completo
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        void printLaunch(launch);
                                                                    }}
                                                                    disabled={printingLaunchKey === launch.key}
                                                                >
                                                                    <Printer className="size-4" />
                                                                    {printingLaunchKey === launch.key ? 'Gerando...' : 'Imprimir'}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        setDeleteLaunchCandidate(launch);
                                                                    }}
                                                                >
                                                                    <Trash2 className="size-4" />
                                                                    Excluir
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {isExpanded ? (
                                                        <tr className="border-b bg-muted/20">
                                                            <td colSpan={7} className="p-3">
                                                                <div className="overflow-x-auto rounded-md border bg-background">
                                                                    <table className="w-full min-w-[820px] text-sm">
                                                                        <thead className="bg-muted/40">
                                                                            <tr>
                                                                                <th className="px-2 py-2 text-left font-medium">
                                                                                    <button
                                                                                        type="button"
                                                                                        className="inline-flex items-center"
                                                                                        onClick={() => toggleLaunchSort(launch.key, 'colaborador')}
                                                                                    >
                                                                                        Colaborador{getSortIndicator(launch.key, 'colaborador')}
                                                                                    </button>
                                                                                </th>
                                                                                {launch.tipoIds.map((tipoId) => (
                                                                                    <th key={`${launch.key}-col-${tipoId}`} className="px-2 py-2 text-left font-medium">
                                                                                        <button
                                                                                            type="button"
                                                                                            className="inline-flex items-center"
                                                                                            onClick={() => toggleLaunchSort(launch.key, 'valor')}
                                                                                        >
                                                                                            {tipos.find((tipo) => tipo.id === tipoId)?.nome ?? 'Tipo'}
                                                                                            {getSortIndicator(launch.key, 'valor')}
                                                                                        </button>
                                                                                    </th>
                                                                                ))}
                                                                                <th className="px-2 py-2 text-left font-medium">
                                                                                    <button
                                                                                        type="button"
                                                                                        className="inline-flex items-center"
                                                                                        onClick={() => toggleLaunchSort(launch.key, 'total')}
                                                                                    >
                                                                                        Total{getSortIndicator(launch.key, 'total')}
                                                                                    </button>
                                                                                </th>
                                                                                <th className="px-2 py-2 text-right font-medium">Ações</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {getSortedCollaborators(launch).map((item) => {
                                                                                const totalRow = launch.tipoIds.reduce(
                                                                                    (acc, tipoId) => acc + Number(item.byType.get(tipoId)?.valor ?? 0),
                                                                                    0,
                                                                                );

                                                                                return (
                                                                                    <tr key={item.key} className="border-t">
                                                                                        <td className="px-2 py-2 font-medium">{item.colaborador.nome}</td>
                                                                                        {launch.tipoIds.map((tipoId) => (
                                                                                            <td key={`${item.key}-${tipoId}`} className="px-2 py-2">
                                                                                                {item.byType.has(tipoId)
                                                                                                    ? formatCurrencyBR(item.byType.get(tipoId)?.valor ?? 0)
                                                                                                    : '-'}
                                                                                            </td>
                                                                                        ))}
                                                                                        <td className="px-2 py-2 font-semibold">{formatCurrencyBR(totalRow)}</td>
                                                                                        <td className="px-2 py-2">
                                                                                            <div className="flex justify-end gap-2">
                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    variant="outline"
                                                                                                    onClick={() => openEditDialog(item)}
                                                                                                >
                                                                                                    <PencilLine className="size-4" />
                                                                                                    Editar
                                                                                                </Button>
                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    variant="destructive"
                                                                                                    onClick={() => setDeleteCandidate(item)}
                                                                                                >
                                                                                                    <Trash2 className="size-4" />
                                                                                                    Excluir
                                                                                                </Button>
                                                                                            </div>
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : null}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="mt-4 flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                Página {currentPage} de {lastPage} - Total de registros: {total}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    disabled={currentPage <= 1 || loading}
                                    onClick={() => void load(currentPage - 1)}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    disabled={currentPage >= lastPage || loading}
                                    onClick={() => void load(currentPage + 1)}
                                >
                                    Próxima
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog
                open={Boolean(deleteLaunchCandidate)}
                onOpenChange={(open) => {
                    if (!open) setDeleteLaunchCandidate(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir pagamento completo</DialogTitle>
                        <DialogDescription>
                            Essa ação exclui todo o lançamento agrupado com todos os colaboradores e tipos.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDeleteLaunchCandidate(null)}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => void confirmDeleteLaunch()}
                            disabled={deleting}
                        >
                            {deleting ? (
                                <>
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Excluindo...
                                </>
                            ) : (
                                'Excluir completo'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(deleteCandidate)}
                onOpenChange={(open) => {
                    if (!open) setDeleteCandidate(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir lançamento agrupado</DialogTitle>
                        <DialogDescription>
                            Essa ação exclui todos os tipos de pagamento deste lançamento.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDeleteCandidate(null)}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => void confirmDelete()}
                            disabled={deleting}
                        >
                            {deleting ? (
                                <>
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Excluindo...
                                </>
                            ) : (
                                'Excluir'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(editCandidate)}
                onOpenChange={(open) => {
                    if (!open) setEditCandidate(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar lançamento agrupado</DialogTitle>
                        <DialogDescription>
                            Edite descrição, data e valores dos tipos já lançados para este colaborador.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="edit-description">Descrição</Label>
                                <Input
                                    id="edit-description"
                                    value={editDescription}
                                    onChange={(event) => setEditDescription(event.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-date">Data pagamento</Label>
                                <Input
                                    id="edit-date"
                                    type="date"
                                    value={editDate}
                                    onChange={(event) => setEditDate(event.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            {tipos
                                .filter((tipo) => editCandidate?.byType.has(tipo.id))
                                .map((tipo) => (
                                    <div className="space-y-2" key={tipo.id}>
                                        <Label htmlFor={`tipo-${tipo.id}`}>{tipo.nome}</Label>
                                        <Input
                                            id={`tipo-${tipo.id}`}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={editValues[tipo.id] ?? '0'}
                                            onChange={(event) =>
                                                setEditValues((previous) => ({
                                                    ...previous,
                                                    [tipo.id]: event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditCandidate(null)}>
                            Cancelar
                        </Button>
                        <Button type="button" onClick={() => void saveEdition()} disabled={saving}>
                            {saving ? (
                                <>
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                'Salvar alterações'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
