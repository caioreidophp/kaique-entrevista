import {
    LoaderCircle,
    PencilLine,
    PlusSquare,
    Trash2,
    Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';
import { formatCurrencyBR, formatDateBR } from '@/lib/transport-format';
import { fetchCurrentUser, getStoredUser } from '@/lib/transport-session';

interface Unidade {
    id: number;
    nome: string;
}

interface Colaborador {
    id: number;
    nome: string;
    unidade_id: number;
    unidade?: Unidade;
}

interface Pagamento {
    id: number;
    colaborador_id: number;
    unidade_id: number;
    autor_id: number;
    competencia_mes: number;
    competencia_ano: number;
    valor: string;
    observacao: string | null;
    lancado_em: string | null;
    created_at: string;
    updated_at: string;
    colaborador?: Colaborador;
    unidade?: Unidade;
    autor?: {
        id: number;
        name: string;
        email: string;
    };
}

interface PayrollSummary {
    competencia_mes: number;
    competencia_ano: number;
    total_lancamentos: number;
    total_colaboradores: number;
    total_valor: number;
    por_unidade: Array<{
        unidade_id: number;
        unidade_nome: string | null;
        total_lancamentos: number;
        total_valor: number;
    }>;
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

interface PagamentoFormData {
    colaborador_id: string;
    competencia_mes: string;
    competencia_ano: string;
    valor: string;
    observacao: string;
    lancado_em: string;
}

const currentDate = new Date();
const defaultMonth = String(currentDate.getMonth() + 1);
const defaultYear = String(currentDate.getFullYear());

const emptyForm: PagamentoFormData = {
    colaborador_id: '',
    competencia_mes: defaultMonth,
    competencia_ano: defaultYear,
    valor: '',
    observacao: '',
    lancado_em: new Date().toISOString().slice(0, 10),
};

function normalizeOptional(value: string): string | null {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

export default function TransportPayrollPage() {
    const [summary, setSummary] = useState<PayrollSummary | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(true);
    const [listLoading, setListLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [items, setItems] = useState<Pagamento[]>([]);
    const [unidades, setUnidades] = useState<Unidade[]>([]);
    const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);

    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const [viewerRole, setViewerRole] = useState<
        'master_admin' | 'admin' | 'usuario'
    >('admin');

    const [monthFilter, setMonthFilter] = useState(defaultMonth);
    const [yearFilter, setYearFilter] = useState(defaultYear);
    const [unidadeFilter, setUnidadeFilter] = useState('all');
    const [nameFilter, setNameFilter] = useState('');
    const [authorFilter, setAuthorFilter] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [formOpen, setFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Pagamento | null>(null);
    const [deleteCandidate, setDeleteCandidate] = useState<Pagamento | null>(
        null,
    );
    const [formData, setFormData] = useState<PagamentoFormData>(emptyForm);

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

    const yearOptions = useMemo(() => {
        const year = currentDate.getFullYear();
        return [String(year - 1), String(year), String(year + 1)];
    }, []);

    async function loadOptions(): Promise<void> {
        try {
            const [unidadesResponse, colaboradoresResponse] = await Promise.all(
                [
                    apiGet<WrappedResponse<Unidade[]>>('/registry/unidades'),
                    apiGet<PaginatedResponse<Colaborador>>(
                        '/registry/colaboradores?active=1&per_page=100',
                    ),
                ],
            );

            setUnidades(unidadesResponse.data);
            setColaboradores(colaboradoresResponse.data);
        } catch {
            setNotification({
                message: 'Não foi possível carregar unidades e colaboradores.',
                variant: 'error',
            });
        }
    }

    function buildListQuery(page: number): string {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('per_page', '10');
        params.set('competencia_mes', monthFilter);
        params.set('competencia_ano', yearFilter);

        if (unidadeFilter !== 'all') params.set('unidade_id', unidadeFilter);
        if (nameFilter.trim()) params.set('name', nameFilter.trim());
        if (authorFilter.trim() && viewerRole === 'master_admin') {
            params.set('autor_id', authorFilter.trim());
        }

        return params.toString();
    }

    async function loadSummary(): Promise<void> {
        setSummaryLoading(true);

        try {
            const response = await apiGet<PayrollSummary>(
                `/payroll/summary?competencia_mes=${monthFilter}&competencia_ano=${yearFilter}`,
            );
            setSummary(response);
        } catch {
            setNotification({
                message: 'Não foi possível carregar o resumo de pagamentos.',
                variant: 'error',
            });
        } finally {
            setSummaryLoading(false);
        }
    }

    async function loadPagamentos(page = 1): Promise<void> {
        setListLoading(true);

        try {
            const response = await apiGet<PaginatedResponse<Pagamento>>(
                `/payroll/pagamentos?${buildListQuery(page)}`,
            );
            setItems(response.data);
            setCurrentPage(response.current_page);
            setLastPage(response.last_page);
            setTotal(response.total);
        } catch {
            setNotification({
                message: 'Não foi possível carregar os lançamentos.',
                variant: 'error',
            });
        } finally {
            setListLoading(false);
        }
    }

    useEffect(() => {
        const stored = getStoredUser();

        if (stored) {
            setViewerRole(stored.role);
        }

        fetchCurrentUser(false)
            .then((user) => {
                setViewerRole(user.role);
            })
            .catch(() => undefined);

        loadOptions();
        loadSummary();
        loadPagamentos(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function applyFilters(): void {
        void loadSummary();
        void loadPagamentos(1);
    }

    function openCreateDialog(): void {
        setEditingItem(null);
        setFormData({
            ...emptyForm,
            competencia_mes: monthFilter,
            competencia_ano: yearFilter,
        });
        setFormOpen(true);
    }

    function openEditDialog(item: Pagamento): void {
        setEditingItem(item);
        setFormData({
            colaborador_id: String(item.colaborador_id),
            competencia_mes: String(item.competencia_mes),
            competencia_ano: String(item.competencia_ano),
            valor: String(item.valor),
            observacao: item.observacao ?? '',
            lancado_em: item.lancado_em ? item.lancado_em.slice(0, 10) : '',
        });
        setFormOpen(true);
    }

    async function handleSubmit(
        event: React.FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();
        setSaving(true);
        setNotification(null);

        const payload = {
            colaborador_id: Number(formData.colaborador_id),
            competencia_mes: Number(formData.competencia_mes),
            competencia_ano: Number(formData.competencia_ano),
            valor: formData.valor,
            observacao: normalizeOptional(formData.observacao),
            lancado_em: normalizeOptional(formData.lancado_em),
        };

        try {
            if (editingItem) {
                await apiPut(`/payroll/pagamentos/${editingItem.id}`, payload);
            } else {
                await apiPost('/payroll/pagamentos', payload);
            }

            setFormOpen(false);
            setEditingItem(null);
            setFormData(emptyForm);
            setNotification({
                message: editingItem
                    ? 'Lançamento atualizado com sucesso.'
                    : 'Lançamento criado com sucesso.',
                variant: 'success',
            });
            await loadSummary();
            await loadPagamentos(currentPage);
        } catch (error) {
            if (error instanceof ApiError) {
                const firstError = error.errors
                    ? Object.values(error.errors)[0]?.[0]
                    : null;
                setNotification({
                    message: firstError ?? error.message,
                    variant: 'error',
                });
            } else {
                setNotification({
                    message: 'Não foi possível salvar o lançamento.',
                    variant: 'error',
                });
            }
        } finally {
            setSaving(false);
        }
    }

    async function confirmDelete(): Promise<void> {
        if (!deleteCandidate) return;

        setDeleting(true);
        setNotification(null);

        try {
            await apiDelete(`/payroll/pagamentos/${deleteCandidate.id}`);
            setNotification({
                message: 'Lançamento removido com sucesso.',
                variant: 'success',
            });
            setDeleteCandidate(null);
            await loadSummary();
            await loadPagamentos(currentPage);
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({
                    message: error.message,
                    variant: 'error',
                });
            } else {
                setNotification({
                    message: 'Não foi possível remover o lançamento.',
                    variant: 'error',
                });
            }
        } finally {
            setDeleting(false);
        }
    }

    return (
        <AdminLayout
            title="Pagamentos"
            active="payroll-dashboard"
            module="payroll"
        >
            <div className="transport-dashboard-page">
                <div className="transport-dashboard-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="transport-dashboard-eyebrow">Pagamentos</p>
                        <h2 className="transport-dashboard-title">
                            Módulo Pagamentos
                        </h2>
                        <p className="transport-dashboard-subtitle">
                            Controle de lançamentos salariais por competência.
                        </p>
                    </div>
                    <Button type="button" onClick={openCreateDialog}>
                        <PlusSquare className="size-4" />
                        Novo Lançamento
                    </Button>
                </div>

                {notification ? (
                    <Notification
                        message={notification.message}
                        variant={notification.variant}
                    />
                ) : null}

                <Card className="transport-insight-card">
                    <CardHeader>
                        <CardTitle className="transport-dashboard-section-title">Filtros</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-5">
                            <div className="space-y-2">
                                <Label>Mês</Label>
                                <Select
                                    value={monthFilter}
                                    onValueChange={setMonthFilter}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {monthOptions.map((month) => (
                                            <SelectItem
                                                key={month.value}
                                                value={month.value}
                                            >
                                                {month.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Ano</Label>
                                <Select
                                    value={yearFilter}
                                    onValueChange={setYearFilter}
                                >
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
                                <Select
                                    value={unidadeFilter}
                                    onValueChange={setUnidadeFilter}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            Todas
                                        </SelectItem>
                                        {unidades.map((unidade) => (
                                            <SelectItem
                                                key={unidade.id}
                                                value={String(unidade.id)}
                                            >
                                                {unidade.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="filter-name">Colaborador</Label>
                                <Input
                                    id="filter-name"
                                    placeholder="Nome"
                                    value={nameFilter}
                                    onChange={(event) =>
                                        setNameFilter(event.target.value)
                                    }
                                />
                            </div>

                            {viewerRole === 'master_admin' ? (
                                <div className="space-y-2">
                                    <Label htmlFor="filter-author">
                                        Autor ID
                                    </Label>
                                    <Input
                                        id="filter-author"
                                        placeholder="ID do autor"
                                        value={authorFilter}
                                        onChange={(event) =>
                                            setAuthorFilter(event.target.value)
                                        }
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2" />
                            )}
                        </div>

                        <div className="mt-4 flex justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={applyFilters}
                            >
                                Aplicar filtros
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="transport-metric-card transport-tone-info">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="transport-metric-label">
                                Total de lançamentos
                            </CardTitle>
                            <Wallet className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            {summaryLoading ? (
                                <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                                <p className="transport-metric-value">
                                    {summary?.total_lancamentos ?? 0}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="transport-metric-card transport-tone-success">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="transport-metric-label">
                                Colaboradores pagos
                            </CardTitle>
                            <Wallet className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            {summaryLoading ? (
                                <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                                <p className="transport-metric-value">
                                    {summary?.total_colaboradores ?? 0}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="transport-metric-card transport-tone-info">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="transport-metric-label">
                                Valor total
                            </CardTitle>
                            <Wallet className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            {summaryLoading ? (
                                <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                                <p className="transport-metric-value">
                                    {formatCurrencyBR(summary?.total_valor ?? 0)}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card className="transport-insight-card">
                    <CardHeader>
                        <CardTitle className="transport-dashboard-section-title">Lançamentos ({total})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {listLoading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando lançamentos...
                            </div>
                        ) : items.length === 0 ? (
                            <div className="transport-empty-state">
                                <strong>Nenhum lançamento encontrado</strong>
                                Ajuste os filtros ou cadastre um novo lançamento para esta competência.
                            </div>
                        ) : (
                            <div className="transport-table-scroll">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-2 pr-3 font-medium">
                                                Colaborador
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                Unidade
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                Competência
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                Valor
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                Autor
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                Lançado em
                                            </th>
                                            <th className="py-2 text-right font-medium">
                                                Ações
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item) => (
                                            <tr
                                                key={item.id}
                                                className="border-b last:border-b-0"
                                            >
                                                <td className="py-2 pr-3 font-medium">
                                                    {item.colaborador?.nome ??
                                                        '-'}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {item.unidade?.nome ?? '-'}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {String(
                                                        item.competencia_mes,
                                                    ).padStart(2, '0')}
                                                    /{item.competencia_ano}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {formatCurrencyBR(item.valor)}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {item.autor?.name ?? '-'}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {formatDateBR(
                                                        item.lancado_em,
                                                    )}
                                                </td>
                                                <td className="py-2">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                openEditDialog(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            <PencilLine className="size-4" />
                                                            Editar
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                setDeleteCandidate(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            <Trash2 className="size-4" />
                                                            Excluir
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="mt-4 flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                Página {currentPage} de {lastPage}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={currentPage <= 1 || listLoading}
                                    onClick={() =>
                                        void loadPagamentos(currentPage - 1)
                                    }
                                >
                                    Anterior
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={
                                        currentPage >= lastPage || listLoading
                                    }
                                    onClick={() =>
                                        void loadPagamentos(currentPage + 1)
                                    }
                                >
                                    Próxima
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Resumo por unidade</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {summaryLoading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando resumo por unidade...
                            </div>
                        ) : !summary || summary.por_unidade.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Sem dados para a competência selecionada.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {summary.por_unidade.map((item) => (
                                    <div
                                        key={item.unidade_id}
                                        className="flex items-center justify-between rounded-md border p-3 text-sm"
                                    >
                                        <div>
                                            <p className="font-medium">
                                                {item.unidade_nome ??
                                                    'Sem unidade'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {item.total_lancamentos}{' '}
                                                lançamentos
                                            </p>
                                        </div>
                                        <p className="font-semibold">
                                            {formatCurrencyBR(item.total_valor)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog
                open={Boolean(deleteCandidate)}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteCandidate(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir lançamento</DialogTitle>
                        <DialogDescription>
                            Deseja realmente excluir o lançamento{' '}
                            <strong>#{deleteCandidate?.id}</strong>?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeleteCandidate(null)}
                            disabled={deleting}
                        >
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
                open={formOpen}
                onOpenChange={(open) => {
                    setFormOpen(open);
                    if (!open) {
                        setEditingItem(null);
                        setFormData(emptyForm);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingItem
                                ? 'Editar lançamento'
                                : 'Novo lançamento'}
                        </DialogTitle>
                        <DialogDescription>
                            Preencha os dados do pagamento para a competência
                            selecionada.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="space-y-2">
                            <Label>Colaborador *</Label>
                            <Select
                                value={formData.colaborador_id}
                                onValueChange={(value) =>
                                    setFormData((previous) => ({
                                        ...previous,
                                        colaborador_id: value,
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {colaboradores.map((colaborador) => (
                                        <SelectItem
                                            key={colaborador.id}
                                            value={String(colaborador.id)}
                                        >
                                            {colaborador.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Mês *</Label>
                                <Select
                                    value={formData.competencia_mes}
                                    onValueChange={(value) =>
                                        setFormData((previous) => ({
                                            ...previous,
                                            competencia_mes: value,
                                        }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {monthOptions.map((month) => (
                                            <SelectItem
                                                key={month.value}
                                                value={month.value}
                                            >
                                                {month.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Ano *</Label>
                                <Select
                                    value={formData.competencia_ano}
                                    onValueChange={(value) =>
                                        setFormData((previous) => ({
                                            ...previous,
                                            competencia_ano: value,
                                        }))
                                    }
                                >
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
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="valor">Valor *</Label>
                            <Input
                                id="valor"
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.valor}
                                onChange={(event) =>
                                    setFormData((previous) => ({
                                        ...previous,
                                        valor: event.target.value,
                                    }))
                                }
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="lancado-em">
                                Data de lançamento
                            </Label>
                            <Input
                                id="lancado-em"
                                type="date"
                                value={formData.lancado_em}
                                onChange={(event) =>
                                    setFormData((previous) => ({
                                        ...previous,
                                        lancado_em: event.target.value,
                                    }))
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="observacao">Observação</Label>
                            <Input
                                id="observacao"
                                value={formData.observacao}
                                onChange={(event) =>
                                    setFormData((previous) => ({
                                        ...previous,
                                        observacao: event.target.value,
                                    }))
                                }
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setFormOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    saving ||
                                    !formData.colaborador_id ||
                                    !formData.competencia_mes ||
                                    !formData.competencia_ano ||
                                    !formData.valor
                                }
                            >
                                {saving ? (
                                    <>
                                        <LoaderCircle className="size-4 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    'Salvar'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
