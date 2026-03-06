import { LoaderCircle, PencilLine, PlusSquare, Trash2 } from 'lucide-react';
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
import { usePersistedState } from '@/hooks/use-persisted-state';
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';
import { fetchCurrentUser, getStoredUser } from '@/lib/transport-session';

interface Unidade {
    id: number;
    nome: string;
}
interface Colaborador {
    id: number;
    nome: string;
    unidade_id: number;
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
    colaborador?: { nome: string };
    unidade?: { nome: string };
    autor?: { name: string };
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

interface FormDataType {
    colaborador_id: string;
    competencia_mes: string;
    competencia_ano: string;
    valor: string;
    observacao: string;
    lancado_em: string;
}

const now = new Date();
const defaultMonth = String(now.getMonth() + 1);
const defaultYear = String(now.getFullYear());

const emptyForm: FormDataType = {
    colaborador_id: '',
    competencia_mes: defaultMonth,
    competencia_ano: defaultYear,
    valor: '',
    observacao: '',
    lancado_em: new Date().toISOString().slice(0, 10),
};

function formatCurrency(value: number | string): string {
    const numeric = typeof value === 'string' ? Number(value) : value;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(Number.isFinite(numeric) ? numeric : 0);
}

function formatDate(value: string | null): string {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('pt-BR');
}

function normalizeOptional(value: string): string | null {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

export default function TransportPayrollListPage() {
    const [items, setItems] = useState<Pagamento[]>([]);
    const [unidades, setUnidades] = useState<Unidade[]>([]);
    const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [monthFilter, setMonthFilter, resetMonthFilter] = usePersistedState(
        'transport:payroll:list:monthFilter',
        defaultMonth,
    );
    const [yearFilter, setYearFilter, resetYearFilter] = usePersistedState(
        'transport:payroll:list:yearFilter',
        defaultYear,
    );
    const [unidadeFilter, setUnidadeFilter, resetUnidadeFilter] =
        usePersistedState('transport:payroll:list:unidadeFilter', 'all');
    const [colaboradorFilter, setColaboradorFilter, resetColaboradorFilter] =
        usePersistedState('transport:payroll:list:colaboradorFilter', 'all');
    const [authorFilter, setAuthorFilter, resetAuthorFilter] =
        usePersistedState('transport:payroll:list:authorFilter', '');

    const [viewerRole, setViewerRole] = useState<
        'admin' | 'master_admin' | 'usuario'
    >('admin');

    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Pagamento | null>(null);
    const [deleteCandidate, setDeleteCandidate] = useState<Pagamento | null>(
        null,
    );
    const [formData, setFormData] = useState<FormDataType>(emptyForm);

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

    async function loadOptions(): Promise<void> {
        try {
            const [unitsRes, collaboratorsRes] = await Promise.all([
                apiGet<WrappedResponse<Unidade[]>>('/registry/unidades'),
                apiGet<PaginatedResponse<Colaborador>>(
                    '/registry/colaboradores?active=1&per_page=100',
                ),
            ]);
            setUnidades(unitsRes.data);
            setColaboradores(collaboratorsRes.data);
        } catch {
            setNotification({
                message: 'Não foi possível carregar os filtros.',
                variant: 'error',
            });
        }
    }

    function buildQuery(page: number): string {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('per_page', '10');
        params.set('competencia_mes', monthFilter);
        params.set('competencia_ano', yearFilter);

        if (unidadeFilter !== 'all') params.set('unidade_id', unidadeFilter);
        if (colaboradorFilter !== 'all')
            params.set('colaborador_id', colaboradorFilter);
        if (viewerRole === 'master_admin' && authorFilter.trim())
            params.set('autor_id', authorFilter.trim());

        return params.toString();
    }

    async function load(page = 1): Promise<void> {
        setLoading(true);
        try {
            const response = await apiGet<PaginatedResponse<Pagamento>>(
                `/payroll/pagamentos?${buildQuery(page)}`,
            );
            setItems(response.data);
            setCurrentPage(response.current_page);
            setLastPage(response.last_page);
            setTotal(response.total);
        } catch {
            setNotification({
                message: 'Não foi possível carregar os pagamentos.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const stored = getStoredUser();
        if (stored) setViewerRole(stored.role);
        fetchCurrentUser(false)
            .then((user) => setViewerRole(user.role))
            .catch(() => undefined);

        loadOptions();
        load(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                    ? 'Pagamento atualizado com sucesso.'
                    : 'Pagamento criado com sucesso.',
                variant: 'success',
            });
            await load(currentPage);
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
                    message: 'Não foi possível salvar o pagamento.',
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

        try {
            await apiDelete(`/payroll/pagamentos/${deleteCandidate.id}`);
            setNotification({
                message: 'Pagamento removido com sucesso.',
                variant: 'success',
            });
            setDeleteCandidate(null);
            await load(currentPage);
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({ message: error.message, variant: 'error' });
            } else {
                setNotification({
                    message: 'Não foi possível excluir o pagamento.',
                    variant: 'error',
                });
            }
        } finally {
            setDeleting(false);
        }
    }

    function clearFilters(): void {
        resetMonthFilter();
        resetYearFilter();
        resetUnidadeFilter();
        resetColaboradorFilter();
        resetAuthorFilter();
        void load(1);
    }

    return (
        <AdminLayout
            title="Salários - Lista de Pagamentos"
            active="payroll-list"
            module="payroll"
        >
            <div className="space-y-6">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-semibold">
                            Lista de Pagamentos
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Consulte e gerencie pagamentos por competência.
                        </p>
                    </div>
                    <Button onClick={openCreateDialog}>
                        <PlusSquare className="size-4" />
                        Novo Pagamento
                    </Button>
                </div>

                {notification ? (
                    <Notification
                        message={notification.message}
                        variant={notification.variant}
                    />
                ) : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
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
                                        {yearOptions.map((y) => (
                                            <SelectItem key={y} value={y}>
                                                {y}
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
                                        {unidades.map((u) => (
                                            <SelectItem
                                                key={u.id}
                                                value={String(u.id)}
                                            >
                                                {u.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Colaborador</Label>
                                <Select
                                    value={colaboradorFilter}
                                    onValueChange={setColaboradorFilter}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            Todos
                                        </SelectItem>
                                        {colaboradores.map((c) => (
                                            <SelectItem
                                                key={c.id}
                                                value={String(c.id)}
                                            >
                                                {c.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {viewerRole === 'master_admin' ? (
                                <div className="space-y-2">
                                    <Label htmlFor="author-id">Autor ID</Label>
                                    <Input
                                        id="author-id"
                                        value={authorFilter}
                                        onChange={(event) =>
                                            setAuthorFilter(event.target.value)
                                        }
                                        placeholder="ID"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2" />
                            )}
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => void load(1)}
                            >
                                Aplicar filtros
                            </Button>
                            <Button variant="outline" onClick={clearFilters}>
                                Limpar
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Pagamentos ({total})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando pagamentos...
                            </div>
                        ) : items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Nenhum pagamento encontrado.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-2 pr-3 font-medium">
                                                Nome
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                Unidade
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                Valor
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                Mês
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                Autor
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                Data
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
                                                    {formatCurrency(item.valor)}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {String(
                                                        item.competencia_mes,
                                                    ).padStart(2, '0')}
                                                    /
                                                    {String(
                                                        item.competencia_ano,
                                                    ).slice(-2)}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {item.autor?.name ?? '-'}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {formatDate(
                                                        item.lancado_em,
                                                    )}
                                                </td>
                                                <td className="py-2">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
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
                                                            size="sm"
                                                            variant="outline"
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
                                    variant="outline"
                                    disabled={currentPage <= 1 || loading}
                                    onClick={() => void load(currentPage - 1)}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    disabled={
                                        currentPage >= lastPage || loading
                                    }
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
                open={Boolean(deleteCandidate)}
                onOpenChange={(open) => {
                    if (!open) setDeleteCandidate(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir pagamento</DialogTitle>
                        <DialogDescription>
                            Deseja realmente excluir o pagamento{' '}
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
                                ? 'Editar pagamento'
                                : 'Novo pagamento'}
                        </DialogTitle>
                        <DialogDescription>
                            Preencha os dados do lançamento.
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
                                    {colaboradores.map((c) => (
                                        <SelectItem
                                            key={c.id}
                                            value={String(c.id)}
                                        >
                                            {c.nome}
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
                                        {yearOptions.map((y) => (
                                            <SelectItem key={y} value={y}>
                                                {y}
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
