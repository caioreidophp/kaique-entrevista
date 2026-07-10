import { AlertTriangle, LoaderCircle, Pencil, Trash2 } from 'lucide-react';
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
} from 'react';
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

interface WrappedResponse<T> {
    data: T;
}

interface PaginatedResponse<T> {
    current_page: number;
    data: T[];
    last_page: number;
    total: number;
}

interface Unidade {
    id: number;
    nome: string;
}

interface TipoPagamento {
    id: number;
    nome: string;
    categoria?: string;
}

interface Colaborador {
    id: number;
    nome: string;
    unidade_id?: number | null;
}

type PendingExtraType =
    | 'sabado'
    | 'feriado'
    | 'manutencao'
    | 'transferencia'
    | 'spot';

type PendingExtraStatus = 'pendente' | 'finalizada';

interface LinkedPayment {
    id: number;
    valor: string | number;
    data_pagamento: string | null;
    descricao: string | null;
    colaborador?: { id: number; nome: string } | null;
    tipo_pagamento?: { id: number; nome: string } | null;
}

interface PendingExtra {
    id: number;
    data: string;
    unidade_id: number | null;
    unidade?: Unidade | null;
    descricao: string;
    tipo: PendingExtraType;
    status: PendingExtraStatus;
    pagamento_id: number | null;
    pagamento?: LinkedPayment | null;
    days_open: number;
    is_overdue: boolean;
}

interface PendingExtraResponse extends PaginatedResponse<PendingExtra> {
    summary: {
        pending: number;
        finished: number;
        overdue: number;
    };
}

interface FormData {
    data: string;
    unidade_id: string;
    descricao: string;
    tipo: PendingExtraType;
    status: PendingExtraStatus;
    pagamento_id: string;
}

interface PaymentFormData {
    colaborador_id: string;
    tipo_pagamento_id: string;
    valor: string;
    descricao: string;
    data_pagamento: string;
    observacao: string;
}

const today = new Date().toISOString().slice(0, 10);

const emptyForm: FormData = {
    data: today,
    unidade_id: '',
    descricao: '',
    tipo: 'sabado',
    status: 'pendente',
    pagamento_id: '',
};

const typeLabels: Record<PendingExtraType, string> = {
    sabado: 'Sábado',
    feriado: 'Feriado',
    manutencao: 'Manutenção',
    transferencia: 'Transferência',
    spot: 'SPOT',
};

const statusLabels: Record<PendingExtraStatus, string> = {
    pendente: 'Pendente',
    finalizada: 'Finalizada',
};

function parseCurrencyInput(value: string): number {
    const normalized = value
        .trim()
        .replace(/[^\d,.-]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');

    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : 0;
}

function statusClass(status: PendingExtraStatus, overdue: boolean): string {
    if (status === 'finalizada') {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }

    return overdue
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-slate-100 text-slate-700 border-slate-200';
}

export default function TransportPayrollPendingExtrasPage() {
    const [rows, setRows] = useState<PendingExtra[]>([]);
    const [units, setUnits] = useState<Unidade[]>([]);
    const [paymentTypes, setPaymentTypes] = useState<TipoPagamento[]>([]);
    const [collaborators, setCollaborators] = useState<Colaborador[]>([]);
    const [summary, setSummary] = useState({
        pending: 0,
        finished: 0,
        overdue: 0,
    });
    const [activeTab, setActiveTab] = useState<'pending' | 'finished' | 'all'>(
        'pending',
    );
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [unitFilter, setUnitFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('');
    const [search, setSearch] = useState('');
    const [form, setForm] = useState<FormData>(emptyForm);
    const [editingItem, setEditingItem] = useState<PendingExtra | null>(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [paymentDialogItem, setPaymentDialogItem] =
        useState<PendingExtra | null>(null);
    const [paymentForm, setPaymentForm] = useState<PaymentFormData>({
        colaborador_id: '',
        tipo_pagamento_id: '',
        valor: '',
        descricao: '',
        data_pagamento: today,
        observacao: '',
    });
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const sortedCollaborators = useMemo(
        () =>
            [...collaborators].sort((a, b) =>
                a.nome.localeCompare(b.nome, 'pt-BR'),
            ),
        [collaborators],
    );

    async function loadSupportData(): Promise<void> {
        try {
            const [unitResponse, typeResponse] = await Promise.all([
                apiGet<WrappedResponse<Unidade[]>>('/registry/unidades'),
                apiGet<WrappedResponse<TipoPagamento[]>>(
                    '/registry/tipos-pagamento',
                ),
            ]);

            setUnits(unitResponse.data);
            setPaymentTypes(typeResponse.data);
        } catch {
            setNotification({
                message: 'Não foi possível carregar unidades e tipos.',
                variant: 'error',
            });
        }
    }

    async function loadCollaborators(unitId?: string): Promise<void> {
        const params = new URLSearchParams({
            active: '1',
            per_page: '100',
            sort_by: 'nome',
            sort_direction: 'asc',
        });

        if (unitId) {
            params.set('unidade_id', unitId);
        }

        try {
            const response = await apiGet<PaginatedResponse<Colaborador>>(
                `/registry/colaboradores?${params.toString()}`,
            );
            setCollaborators(response.data);
        } catch {
            setCollaborators([]);
            setNotification({
                message:
                    'Não foi possível carregar colaboradores para vincular pagamento.',
                variant: 'error',
            });
        }
    }

    const loadRows = useCallback(async (): Promise<void> => {
        setLoading(true);

        const params = new URLSearchParams({ tab: activeTab });

        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (typeFilter !== 'all') params.set('tipo', typeFilter);
        if (unitFilter !== 'all') params.set('unidade_id', unitFilter);
        if (dateFilter) params.set('data', dateFilter);
        if (search.trim()) params.set('search', search.trim());

        try {
            const response = await apiGet<PendingExtraResponse>(
                `/payroll/pending-extras?${params.toString()}`,
            );
            setRows(response.data);
            setSummary(response.summary);
        } catch {
            setNotification({
                message: 'Não foi possível carregar diárias e extras.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }, [activeTab, dateFilter, search, statusFilter, typeFilter, unitFilter]);

    useEffect(() => {
        void loadSupportData();
    }, []);

    useEffect(() => {
        void loadRows();
    }, [loadRows]);

    function resetForm(): void {
        setForm(emptyForm);
        setEditingItem(null);
    }

    function startEdit(item: PendingExtra): void {
        setEditingItem(item);
        setForm({
            data: item.data,
            unidade_id: item.unidade_id ? String(item.unidade_id) : '',
            descricao: item.descricao,
            tipo: item.tipo,
            status: item.status,
            pagamento_id: item.pagamento_id ? String(item.pagamento_id) : '',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setNotification(null);

        const payload = {
            data: form.data,
            unidade_id: form.unidade_id ? Number(form.unidade_id) : null,
            descricao: form.descricao.trim(),
            tipo: form.tipo,
            status: form.status,
            pagamento_id: form.pagamento_id ? Number(form.pagamento_id) : null,
        };

        try {
            if (editingItem) {
                await apiPut(
                    `/payroll/pending-extras/${editingItem.id}`,
                    payload,
                );
                setNotification({
                    message: 'Pendência atualizada.',
                    variant: 'success',
                });
            } else {
                await apiPost('/payroll/pending-extras', payload);
                setNotification({
                    message: 'Pendência cadastrada.',
                    variant: 'success',
                });
            }

            resetForm();
            await loadRows();
        } catch (error) {
            let message = 'Não foi possível salvar a pendência.';

            if (error instanceof ApiError) {
                message = error.message;
            }

            setNotification({ message, variant: 'error' });
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(item: PendingExtra): Promise<void> {
        if (!window.confirm(`Excluir pendência "${item.descricao}"?`)) {
            return;
        }

        try {
            await apiDelete(`/payroll/pending-extras/${item.id}`);
            setNotification({
                message: 'Pendência excluída.',
                variant: 'success',
            });
            await loadRows();
        } catch {
            setNotification({
                message: 'Não foi possível excluir a pendência.',
                variant: 'error',
            });
        }
    }

    async function markFinished(item: PendingExtra): Promise<void> {
        try {
            await apiPut(`/payroll/pending-extras/${item.id}`, {
                status: 'finalizada',
            });
            setNotification({
                message: 'Pendência marcada como finalizada.',
                variant: 'success',
            });
            await loadRows();
        } catch {
            setNotification({
                message: 'Não foi possível finalizar a pendência.',
                variant: 'error',
            });
        }
    }

    async function openPaymentDialog(item: PendingExtra): Promise<void> {
        setPaymentDialogItem(item);
        setPaymentForm({
            colaborador_id: '',
            tipo_pagamento_id: '',
            valor: '',
            descricao: item.descricao,
            data_pagamento: item.data || today,
            observacao: `Vinculado à diária/extra #${item.id}: ${item.descricao}`,
        });
        await loadCollaborators(item.unidade_id ? String(item.unidade_id) : '');
    }

    async function handleCreatePayment(): Promise<void> {
        if (!paymentDialogItem) return;

        const value = parseCurrencyInput(paymentForm.valor);

        if (
            !paymentForm.colaborador_id ||
            !paymentForm.tipo_pagamento_id ||
            value <= 0
        ) {
            setNotification({
                message:
                    'Informe colaborador, tipo de pagamento e valor maior que zero.',
                variant: 'error',
            });
            return;
        }

        setSaving(true);

        try {
            const paymentResponse = await apiPost<
                WrappedResponse<LinkedPayment>
            >('/payroll/pagamentos', {
                colaborador_id: Number(paymentForm.colaborador_id),
                tipo_pagamento_id: paymentForm.tipo_pagamento_id
                    ? Number(paymentForm.tipo_pagamento_id)
                    : null,
                valor: value,
                descricao: paymentForm.descricao,
                data_pagamento: paymentForm.data_pagamento,
                observacao: paymentForm.observacao,
                lancado_em: new Date().toISOString(),
            });

            await apiPut(`/payroll/pending-extras/${paymentDialogItem.id}`, {
                status: 'finalizada',
                pagamento_id: paymentResponse.data.id,
            });

            setPaymentDialogItem(null);
            setNotification({
                message: 'Pagamento lançado e pendência finalizada.',
                variant: 'success',
            });
            await loadRows();
        } catch (error) {
            let message = 'Não foi possível lançar o pagamento.';

            if (error instanceof ApiError) {
                message = error.message;
            }

            setNotification({ message, variant: 'error' });
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminLayout
            title="Pagamentos - Diárias e Extras"
            active="payroll-pending-extras"
            module="payroll"
        >
            <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-semibold">
                            Diárias e Extras Pendentes
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Controle prévio para lembrar tratativas antes de
                            lançar ou vincular o pagamento.
                        </p>
                    </div>
                    {summary.overdue > 0 ? (
                        <div className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                            <AlertTriangle className="size-4" />
                            {summary.overdue} pendência(s) com 7+ dias
                        </div>
                    ) : null}
                </div>

                {notification ? (
                    <Notification
                        message={notification.message}
                        variant={notification.variant}
                    />
                ) : null}

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {editingItem
                                ? 'Editar pendência'
                                : 'Cadastrar pendência'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            className="grid gap-3 lg:grid-cols-6"
                            onSubmit={handleSubmit}
                        >
                            <div>
                                <Label htmlFor="pending-date">Data</Label>
                                <Input
                                    id="pending-date"
                                    type="date"
                                    value={form.data}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            data: event.target.value,
                                        }))
                                    }
                                    required
                                />
                            </div>
                            <div>
                                <Label>Unidade</Label>
                                <Select
                                    value={form.unidade_id || 'none'}
                                    onValueChange={(value) =>
                                        setForm((current) => ({
                                            ...current,
                                            unidade_id:
                                                value === 'none' ? '' : value,
                                        }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            Sem unidade
                                        </SelectItem>
                                        {units.map((unit) => (
                                            <SelectItem
                                                key={unit.id}
                                                value={String(unit.id)}
                                            >
                                                {unit.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Tipo</Label>
                                <Select
                                    value={form.tipo}
                                    onValueChange={(value) =>
                                        setForm((current) => ({
                                            ...current,
                                            tipo: value as PendingExtraType,
                                        }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(typeLabels).map(
                                            ([value, label]) => (
                                                <SelectItem
                                                    key={value}
                                                    value={value}
                                                >
                                                    {label}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Status</Label>
                                <Select
                                    value={form.status}
                                    onValueChange={(value) =>
                                        setForm((current) => ({
                                            ...current,
                                            status: value as PendingExtraStatus,
                                        }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pendente">
                                            Pendente
                                        </SelectItem>
                                        <SelectItem value="finalizada">
                                            Finalizada
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="payment-id">
                                    Pagamento vinculado
                                </Label>
                                <Input
                                    id="payment-id"
                                    inputMode="numeric"
                                    placeholder="ID opcional"
                                    value={form.pagamento_id}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            pagamento_id:
                                                event.target.value.replace(
                                                    /\D/g,
                                                    '',
                                                ),
                                        }))
                                    }
                                />
                            </div>
                            <div className="lg:col-span-6">
                                <Label htmlFor="pending-description">
                                    Descrição
                                </Label>
                                <Input
                                    id="pending-description"
                                    value={form.descricao}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            descricao: event.target.value,
                                        }))
                                    }
                                    placeholder="Ex.: diária de sábado, manutenção, transferência..."
                                    required
                                />
                            </div>
                            <div className="flex gap-2 lg:col-span-6">
                                <Button type="submit" disabled={saving}>
                                    {saving ? 'Salvando...' : 'Salvar'}
                                </Button>
                                {editingItem ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={resetForm}
                                    >
                                        Cancelar edição
                                    </Button>
                                ) : null}
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Lista de pendências</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant={
                                    activeTab === 'pending'
                                        ? 'default'
                                        : 'outline'
                                }
                                onClick={() => setActiveTab('pending')}
                            >
                                Pendentes ({summary.pending})
                            </Button>
                            <Button
                                type="button"
                                variant={
                                    activeTab === 'finished'
                                        ? 'default'
                                        : 'outline'
                                }
                                onClick={() => setActiveTab('finished')}
                            >
                                Finalizadas ({summary.finished})
                            </Button>
                            <Button
                                type="button"
                                variant={
                                    activeTab === 'all' ? 'default' : 'outline'
                                }
                                onClick={() => setActiveTab('all')}
                            >
                                Todas
                            </Button>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-5">
                            <Input
                                placeholder="Buscar descrição"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') void loadRows();
                                }}
                            />
                            <Select
                                value={statusFilter}
                                onValueChange={setStatusFilter}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        Todos os status
                                    </SelectItem>
                                    <SelectItem value="pendente">
                                        Pendente
                                    </SelectItem>
                                    <SelectItem value="finalizada">
                                        Finalizada
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <Select
                                value={typeFilter}
                                onValueChange={setTypeFilter}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        Todos os tipos
                                    </SelectItem>
                                    {Object.entries(typeLabels).map(
                                        ([value, label]) => (
                                            <SelectItem
                                                key={value}
                                                value={value}
                                            >
                                                {label}
                                            </SelectItem>
                                        ),
                                    )}
                                </SelectContent>
                            </Select>
                            <Select
                                value={unitFilter}
                                onValueChange={setUnitFilter}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        Todas as unidades
                                    </SelectItem>
                                    {units.map((unit) => (
                                        <SelectItem
                                            key={unit.id}
                                            value={String(unit.id)}
                                        >
                                            {unit.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                type="date"
                                value={dateFilter}
                                onChange={(event) =>
                                    setDateFilter(event.target.value)
                                }
                            />
                        </div>

                        <div className="overflow-x-auto rounded-md border">
                            <table className="w-full min-w-[980px] text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground uppercase">
                                        <th className="px-3 py-2">Data</th>
                                        <th className="px-3 py-2">Unidade</th>
                                        <th className="px-3 py-2">Descrição</th>
                                        <th className="px-3 py-2">Tipo</th>
                                        <th className="px-3 py-2">Status</th>
                                        <th className="px-3 py-2">Pagamento</th>
                                        <th className="px-3 py-2">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="px-3 py-8 text-center text-muted-foreground"
                                            >
                                                <LoaderCircle className="mx-auto mb-2 size-5 animate-spin" />
                                                Carregando...
                                            </td>
                                        </tr>
                                    ) : rows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="px-3 py-8 text-center text-muted-foreground"
                                            >
                                                Nenhuma pendência encontrada.
                                            </td>
                                        </tr>
                                    ) : (
                                        rows.map((item) => (
                                            <tr
                                                key={item.id}
                                                className="border-b last:border-b-0"
                                            >
                                                <td className="px-3 py-3">
                                                    <div className="font-medium">
                                                        {formatDateBR(
                                                            item.data,
                                                        )}
                                                    </div>
                                                    {item.is_overdue ? (
                                                        <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                                                            <AlertTriangle className="size-3" />
                                                            {item.days_open}{' '}
                                                            dias
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {item.unidade?.nome ?? '-'}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {item.descricao}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {typeLabels[item.tipo]}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span
                                                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusClass(
                                                            item.status,
                                                            item.is_overdue,
                                                        )}`}
                                                    >
                                                        {
                                                            statusLabels[
                                                                item.status
                                                            ]
                                                        }
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    {item.pagamento ? (
                                                        <div>
                                                            <div className="font-medium">
                                                                #
                                                                {
                                                                    item
                                                                        .pagamento
                                                                        .id
                                                                }{' '}
                                                                {formatCurrencyBR(
                                                                    Number(
                                                                        item
                                                                            .pagamento
                                                                            .valor ??
                                                                            0,
                                                                    ),
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {item.pagamento
                                                                    .colaborador
                                                                    ?.nome ??
                                                                    'Sem colaborador'}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex flex-wrap gap-2">
                                                        {item.status ===
                                                        'pendente' ? (
                                                            <>
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        void openPaymentDialog(
                                                                            item,
                                                                        )
                                                                    }
                                                                >
                                                                    Finalizar e
                                                                    pagar
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() =>
                                                                        void markFinished(
                                                                            item,
                                                                        )
                                                                    }
                                                                >
                                                                    Só finalizar
                                                                </Button>
                                                            </>
                                                        ) : null}
                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="outline"
                                                            onClick={() =>
                                                                startEdit(item)
                                                            }
                                                            title="Editar"
                                                        >
                                                            <Pencil className="size-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="destructive"
                                                            onClick={() =>
                                                                void handleDelete(
                                                                    item,
                                                                )
                                                            }
                                                            title="Excluir"
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog
                open={paymentDialogItem !== null}
                onOpenChange={(open) => {
                    if (!open) setPaymentDialogItem(null);
                }}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Lançar pagamento vinculado</DialogTitle>
                        <DialogDescription>
                            O pagamento será criado e a pendência será marcada
                            como finalizada.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <Label>Colaborador</Label>
                            <Select
                                value={paymentForm.colaborador_id}
                                onValueChange={(value) =>
                                    setPaymentForm((current) => ({
                                        ...current,
                                        colaborador_id: value,
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sortedCollaborators.map((collaborator) => (
                                        <SelectItem
                                            key={collaborator.id}
                                            value={String(collaborator.id)}
                                        >
                                            {collaborator.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Tipo de pagamento</Label>
                            <Select
                                value={paymentForm.tipo_pagamento_id}
                                onValueChange={(value) =>
                                    setPaymentForm((current) => ({
                                        ...current,
                                        tipo_pagamento_id: value,
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {paymentTypes.map((type) => (
                                        <SelectItem
                                            key={type.id}
                                            value={String(type.id)}
                                        >
                                            {type.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Valor</Label>
                            <Input
                                value={paymentForm.valor}
                                onChange={(event) =>
                                    setPaymentForm((current) => ({
                                        ...current,
                                        valor: event.target.value,
                                    }))
                                }
                                placeholder="0,00"
                            />
                        </div>
                        <div>
                            <Label>Data de pagamento</Label>
                            <Input
                                type="date"
                                value={paymentForm.data_pagamento}
                                onChange={(event) =>
                                    setPaymentForm((current) => ({
                                        ...current,
                                        data_pagamento: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="md:col-span-2">
                            <Label>Descrição</Label>
                            <Input
                                value={paymentForm.descricao}
                                onChange={(event) =>
                                    setPaymentForm((current) => ({
                                        ...current,
                                        descricao: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="md:col-span-2">
                            <Label>Observação</Label>
                            <Input
                                value={paymentForm.observacao}
                                onChange={(event) =>
                                    setPaymentForm((current) => ({
                                        ...current,
                                        observacao: event.target.value,
                                    }))
                                }
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPaymentDialogItem(null)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void handleCreatePayment()}
                            disabled={saving}
                        >
                            {saving ? 'Lançando...' : 'Lançar e finalizar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
