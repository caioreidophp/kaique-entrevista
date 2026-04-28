import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';
import {
    formatEditableMoneyBR,
    formatCurrencyBR,
    formatDateBR,
    moneyMaskBR,
    toNumberSafe,
} from '@/lib/transport-format';

interface Unidade {
    id: number;
    nome: string;
}

interface BillingBatch {
    id: number;
    descricao: string;
    data_pagamento: string;
    numero_nota_fiscal: string;
}

interface FreightCanceledLoad {
    id: number;
    data: string;
    unidade_id: number;
    unidade?: Unidade;
    placa: string;
    aviario: string | null;
    valor: string | number;
    n_viagem: string | null;
    obs: string | null;
    status: 'a_receber' | 'recebida';
    data_pagamento: string | null;
    batch_id?: number | null;
    batch?: BillingBatch | null;
}

interface ReceivedGroup {
    key: string;
    batchId: number | null;
    descricao: string;
    dataPagamento: string | null;
    numeroNotaFiscal: string | null;
    unidadeNome: string;
    items: FreightCanceledLoad[];
    total: number;
}

interface WrappedResponse<T> {
    data: T;
}

interface ConfirmDialogState {
    kind: 'delete-a' | 'delete-b' | 'delete-i';
    id: number;
    title: string;
    description: string;
}

interface EditCanceledLoadDraft {
    id: number;
    data: string;
    placa: string;
    aviario: string;
    valor: string;
    n_viagem: string;
    obs: string;
}

const current = new Date();

function monthOptions(): Array<{ value: string; label: string }> {
    const options: Array<{ value: string; label: string }> = [{ value: 'all', label: 'Todos os meses' }];

    for (let i = 0; i < 24; i += 1) {
        const date = new Date(current.getFullYear(), current.getMonth() - i, 1);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const value = `${date.getFullYear()}-${month}`;
        const label = date.toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric',
        });

        options.push({ value, label: `${label.charAt(0).toUpperCase()}${label.slice(1)}` });
    }

    return options;
}

export default function TransportFreightCanceledLoadsPage() {
    const [unidades, setUnidades] = useState<Unidade[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingLists, setLoadingLists] = useState(false);
    const [aReceber, setAReceber] = useState<FreightCanceledLoad[]>([]);
    const [recebidas, setRecebidas] = useState<FreightCanceledLoad[]>([]);

    const [placaFilter, setPlacaFilter] = useState('');
    const debouncedPlacaFilter = useDebouncedValue(placaFilter, 450);
    const [mesFilter, setMesFilter] = useState('all');
    const [unidadeFilter, setUnidadeFilter] = useState('all');

    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const [billingDialogOpen, setBillingDialogOpen] = useState(false);
    const [billingDate, setBillingDate] = useState(new Date().toISOString().slice(0, 10));
    const [billingDescription, setBillingDescription] = useState('');
    const [billingInvoiceNumber, setBillingInvoiceNumber] = useState('');
    const [billingMode, setBillingMode] = useState(false);
    const [billingSelection, setBillingSelection] = useState<Record<number, boolean>>({});
    const [savingBilling, setSavingBilling] = useState(false);

    const [editingTripId, setEditingTripId] = useState<number | null>(null);
    const [tripDraft, setTripDraft] = useState('');
    const [savingTripId, setSavingTripId] = useState<number | null>(null);
    const skipTripBlurSaveRef = useRef(false);

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
    const [editLoadDraft, setEditLoadDraft] =
        useState<EditCanceledLoadDraft | null>(null);
    const [savingEditedLoad, setSavingEditedLoad] = useState(false);

    const aReceberRef = useRef<FreightCanceledLoad[]>([]);

    const months = useMemo(() => monthOptions(), []);

    const aReceberIndexById = useMemo(() => {
        const map = new Map<number, number>();

        aReceber.forEach((item, index) => {
            map.set(item.id, index);
        });

        return map;
    }, [aReceber]);

    const selectedIds = useMemo(
        () =>
            Object.entries(billingSelection)
                .filter(([, checked]) => checked)
                .map(([id]) => Number(id)),
        [billingSelection],
    );

    const selectedTotal = useMemo(
        () =>
            aReceber
                .filter((item) => selectedIds.includes(item.id))
                .reduce((acc, item) => acc + Number(item.valor ?? 0), 0),
        [aReceber, selectedIds],
    );

    const aReceberTotal = useMemo(
        () => aReceber.reduce((acc, item) => acc + Number(item.valor ?? 0), 0),
        [aReceber],
    );

    const allBillingRowsSelected =
        aReceber.length > 0 && selectedIds.length === aReceber.length;
    const someBillingRowsSelected =
        selectedIds.length > 0 && !allBillingRowsSelected;

    const receivedGroups = useMemo<ReceivedGroup[]>(() => {
        const map = new Map<string, ReceivedGroup>();

        recebidas.forEach((item) => {
            const key = item.batch_id ? `batch:${item.batch_id}` : `single:${item.id}`;
            const existing = map.get(key);

            if (existing) {
                existing.items.push(item);
                existing.total += Number(item.valor ?? 0);
                return;
            }

            map.set(key, {
                key,
                batchId: item.batch_id ?? null,
                descricao: item.batch?.descricao ?? `Recebimento ${item.id}`,
                dataPagamento: item.batch?.data_pagamento ?? item.data_pagamento,
                numeroNotaFiscal: item.batch?.numero_nota_fiscal ?? '-',
                unidadeNome: item.unidade?.nome ?? '-',
                items: [item],
                total: Number(item.valor ?? 0),
            });
        });

        return Array.from(map.values()).sort((a, b) => {
            const dateA = a.dataPagamento ?? '';
            const dateB = b.dataPagamento ?? '';
            return dateB.localeCompare(dateA);
        });
    }, [recebidas]);

    function buildQuery(status: 'a_receber' | 'recebida'): string {
        const params = new URLSearchParams();
        params.set('status', status);

        if (debouncedPlacaFilter.trim()) {
            params.set('placa', debouncedPlacaFilter.trim());
        }

        if (mesFilter !== 'all') {
            params.set('mes', mesFilter);
        }

        if (unidadeFilter !== 'all') {
            params.set('unidade_id', unidadeFilter);
        }

        return params.toString();
    }

    async function loadAll(): Promise<void> {
        setLoadingLists(true);

        try {
            const [receberRes, recebidasRes] = await Promise.all([
                apiGet<WrappedResponse<FreightCanceledLoad[]>>(`/freight/canceled-loads?${buildQuery('a_receber')}`),
                apiGet<WrappedResponse<FreightCanceledLoad[]>>(`/freight/canceled-loads?${buildQuery('recebida')}`),
            ]);

            setAReceber(receberRes.data);
            setRecebidas(recebidasRes.data);
        } catch {
            setNotification({ message: 'Não foi possível carregar as cargas canceladas.', variant: 'error' });
        } finally {
            setLoadingLists(false);
        }
    }

    useEffect(() => {
        apiGet<WrappedResponse<Unidade[]>>('/registry/unidades')
            .then((response) => setUnidades(response.data))
            .catch(() => {
                setNotification({ message: 'Não foi possível carregar unidades.', variant: 'error' });
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        void loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedPlacaFilter, mesFilter, unidadeFilter]);

    useEffect(() => {
        aReceberRef.current = aReceber;
    }, [aReceber]);

    function startTripEdit(item: FreightCanceledLoad): void {
        setEditingTripId(item.id);
        setTripDraft(item.n_viagem ?? '');
    }

    function startLoadEdit(item: FreightCanceledLoad): void {
        setEditLoadDraft({
            id: item.id,
            data: item.data?.slice(0, 10) ?? '',
            placa: item.placa ?? '',
            aviario: item.aviario ?? '',
            valor: formatEditableMoneyBR(item.valor),
            n_viagem: item.n_viagem ?? '',
            obs: item.obs ?? '',
        });
    }

    function toggleAllBillingSelection(nextChecked: boolean): void {
        if (!nextChecked) {
            setBillingSelection({});
            return;
        }

        const next: Record<number, boolean> = {};

        aReceber.forEach((item) => {
            next[item.id] = true;
        });

        setBillingSelection(next);
    }

    async function saveEditedLoad(): Promise<void> {
        if (!editLoadDraft) {
            return;
        }

        if (!editLoadDraft.data || !editLoadDraft.placa.trim()) {
            setNotification({
                message: 'Data e placa são obrigatórias para editar a carga.',
                variant: 'info',
            });
            return;
        }

        setSavingEditedLoad(true);

        try {
            await apiPut(`/freight/canceled-loads/${editLoadDraft.id}`, {
                data: editLoadDraft.data,
                placa: editLoadDraft.placa.trim().toUpperCase(),
                aviario: editLoadDraft.aviario.trim() || null,
                valor: toNumberSafe(editLoadDraft.valor),
                n_viagem: editLoadDraft.n_viagem.trim() || null,
                obs: editLoadDraft.obs.trim() || null,
            });

            setEditLoadDraft(null);
            setNotification({
                message: 'Carga cancelada atualizada com sucesso.',
                variant: 'success',
            });
            await loadAll();
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({ message: error.message, variant: 'error' });
            } else {
                setNotification({
                    message: 'Não foi possível atualizar a carga cancelada.',
                    variant: 'error',
                });
            }
        } finally {
            setSavingEditedLoad(false);
        }
    }

    function toggleGroup(groupKey: string): void {
        setExpandedGroups((previous) => ({
            ...previous,
            [groupKey]: !previous[groupKey],
        }));
    }

    async function saveTripNumber(id: number, nextEditId: number | null = null): Promise<void> {
        setSavingTripId(id);
        try {
            await apiPut(`/freight/canceled-loads/${id}/trip-number`, {
                n_viagem: tripDraft.trim() || null,
            });

            setAReceber((previous) =>
                previous.map((item) =>
                    item.id === id
                        ? {
                              ...item,
                              n_viagem: tripDraft.trim() || null,
                          }
                        : item,
                ),
            );

            if (nextEditId !== null) {
                const nextItem = aReceber.find((item) => item.id === nextEditId);
                setEditingTripId(nextEditId);
                setTripDraft(nextItem?.n_viagem ?? '');
                return;
            }
        } catch {
            setNotification({ message: 'Não foi possível atualizar o número da viagem.', variant: 'error' });
            setEditingTripId(id);
        } finally {
            setSavingTripId(null);
            if (nextEditId === null) {
                setEditingTripId(null);
                setTripDraft('');
            }
        }
    }

    async function removeAReceberLoad(id: number): Promise<void> {
        setProcessingId(`delete-a:${id}`);

        try {
            await apiDelete(`/freight/canceled-loads/${id}`);
            setNotification({ message: 'Carga cancelada excluída.', variant: 'success' });
            await loadAll();
        } catch {
            setNotification({ message: 'Não foi possível excluir a carga cancelada.', variant: 'error' });
        } finally {
            setProcessingId(null);
        }
    }

    async function unbillBatch(batchId: number): Promise<void> {
        setProcessingId(`unbill-b:${batchId}`);

        try {
            await apiPost(`/freight/canceled-load-batches/${batchId}/unbill`, {});
            setNotification({ message: 'Pagamento desfaturado com sucesso.', variant: 'success' });
            await loadAll();
        } catch {
            setNotification({ message: 'Não foi possível desfaturar o pagamento.', variant: 'error' });
        } finally {
            setProcessingId(null);
        }
    }

    async function unbillOne(id: number): Promise<void> {
        setProcessingId(`unbill-i:${id}`);

        try {
            await apiPost(`/freight/canceled-loads/${id}/unbill`, {});
            setNotification({ message: 'Carga desfaturada e movida para A Receber.', variant: 'success' });
            await loadAll();
        } catch {
            setNotification({ message: 'Não foi possível desfaturar a carga.', variant: 'error' });
        } finally {
            setProcessingId(null);
        }
    }

    async function removeReceivedBatch(batchId: number): Promise<void> {
        setProcessingId(`delete-b:${batchId}`);

        try {
            await apiDelete(`/freight/canceled-load-batches/${batchId}`);
            setNotification({ message: 'Pagamento excluído com sucesso.', variant: 'success' });
            await loadAll();
        } catch {
            setNotification({ message: 'Não foi possível excluir o pagamento.', variant: 'error' });
        } finally {
            setProcessingId(null);
        }
    }

    async function removeReceivedLoad(id: number): Promise<void> {
        setProcessingId(`delete-i:${id}`);

        try {
            await apiDelete(`/freight/canceled-loads/${id}`);
            setNotification({ message: 'Carga excluída com sucesso.', variant: 'success' });
            await loadAll();
        } catch {
            setNotification({ message: 'Não foi possível excluir a carga.', variant: 'error' });
        } finally {
            setProcessingId(null);
        }
    }

    function beginBillingSelection(): void {
        if (!billingDate || !billingDescription.trim() || !billingInvoiceNumber.trim()) {
            setNotification({ message: 'Preencha descrição, data e número da nota fiscal.', variant: 'info' });
            return;
        }

        setBillingMode(true);
        setBillingSelection({});
        setBillingDialogOpen(false);
        setNotification({ message: 'Selecione as linhas faturadas e finalize.', variant: 'info' });
    }

    async function finalizeBilling(): Promise<void> {
        if (selectedIds.length === 0) {
            setNotification({ message: 'Selecione ao menos uma carga para faturar.', variant: 'info' });
            return;
        }

        setSavingBilling(true);

        try {
            await apiPost('/freight/canceled-loads/bill', {
                ids: selectedIds,
                descricao: billingDescription.trim(),
                data_pagamento: billingDate,
                numero_nota_fiscal: billingInvoiceNumber.trim(),
            });

            setBillingMode(false);
            setBillingSelection({});
            setBillingDescription('');
            setBillingInvoiceNumber('');
            setNotification({ message: 'Cargas faturadas com sucesso.', variant: 'success' });
            await loadAll();
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({ message: error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível faturar as cargas selecionadas.', variant: 'error' });
            }
        } finally {
            setSavingBilling(false);
        }
    }

    async function executeConfirmedAction(): Promise<void> {
        if (!confirmDialog) return;

        if (confirmDialog.kind === 'delete-a') {
            await removeAReceberLoad(confirmDialog.id);
        }

        if (confirmDialog.kind === 'delete-b') {
            await removeReceivedBatch(confirmDialog.id);
        }

        if (confirmDialog.kind === 'delete-i') {
            await removeReceivedLoad(confirmDialog.id);
        }

        setConfirmDialog(null);
    }

    return (
        <AdminLayout title="Gestão de Fretes - Cargas Canceladas" active="freight-canceled-loads" module="freight">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Cargas Canceladas</h2>
                    <p className="text-sm text-muted-foreground">
                        Controle de cargas canceladas escaladas em duas frentes: A receber e Recebidas.
                    </p>
                </div>

                {notification ? <Notification message={notification.message} variant={notification.variant} /> : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label htmlFor="filter-placa">Placa</Label>
                            <Input
                                id="filter-placa"
                                value={placaFilter}
                                onChange={(event) => setPlacaFilter(event.target.value.toUpperCase())}
                                placeholder="ABC1D23"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Mês</Label>
                            <Select value={mesFilter} onValueChange={setMesFilter}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {months.map((month) => (
                                        <SelectItem key={month.value} value={month.value}>
                                            {month.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Unidade</Label>
                            <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as unidades</SelectItem>
                                    {unidades.map((item) => (
                                        <SelectItem key={item.id} value={String(item.id)}>
                                            {item.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>A Receber ({aReceber.length})</CardTitle>
                        <div className="flex gap-2">
                            {billingMode ? (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setBillingMode(false);
                                            setBillingSelection({});
                                        }}
                                    >
                                        Cancelar seleção
                                    </Button>
                                    <Button type="button" onClick={() => void finalizeBilling()} disabled={savingBilling}>
                                        {savingBilling ? 'Faturando...' : `Finalizar faturamento (${selectedIds.length})`}
                                    </Button>
                                </>
                            ) : (
                                <Button type="button" onClick={() => setBillingDialogOpen(true)}>
                                    Faturar
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading || loadingLists ? (
                            <div className="space-y-2">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <div key={`a-receber-skeleton-${index}`} className="rounded-md border p-3">
                                        <Skeleton className="mb-2 h-4 w-48" />
                                        <Skeleton className="mb-2 h-3 w-full" />
                                        <Skeleton className="h-3 w-2/3" />
                                    </div>
                                ))}
                            </div>
                        ) : aReceber.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhuma carga a receber.</p>
                        ) : (
                            <div className="space-y-3">
                                {billingMode ? (
                                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                checked={
                                                    allBillingRowsSelected
                                                        ? true
                                                        : someBillingRowsSelected
                                                          ? 'indeterminate'
                                                          : false
                                                }
                                                onCheckedChange={(checked) =>
                                                    toggleAllBillingSelection(
                                                        Boolean(checked),
                                                    )
                                                }
                                            />
                                            <span className="text-sm font-medium">
                                                Selecionar todas as cargas
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {selectedIds.length}/{aReceber.length} selecionadas
                                        </span>
                                    </div>
                                ) : null}
                                <div className="space-y-2 md:hidden">
                                    {aReceber.map((item) => (
                                        <div key={`mobile-a-${item.id}`} className="space-y-2 rounded-md border p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-semibold">{item.placa}</p>
                                                    <p className="text-xs text-muted-foreground">{formatDateBR(item.data, item.data)}</p>
                                                </div>
                                                <p className="text-sm font-semibold">{formatCurrencyBR(item.valor)}</p>
                                            </div>
                                            <p className="text-xs text-muted-foreground">Aviário: <span className="text-foreground">{item.aviario ?? '-'}</span></p>
                                            <p className="text-xs text-muted-foreground">Unidade: <span className="text-foreground">{item.unidade?.nome ?? '-'}</span></p>
                                            <p className="text-xs text-muted-foreground">Obs.: <span className="text-foreground">{item.obs ?? '-'}</span></p>
                                            <div className="space-y-1">
                                                <Label className="text-xs">nº Viagem</Label>
                                                {editingTripId === item.id ? (
                                                    <Input
                                                        autoFocus
                                                        value={tripDraft}
                                                        disabled={savingTripId === item.id}
                                                        onChange={(event) => setTripDraft(event.target.value)}
                                                        onBlur={() => {
                                                            if (skipTripBlurSaveRef.current) {
                                                                skipTripBlurSaveRef.current = false;
                                                                return;
                                                            }

                                                            void saveTripNumber(item.id);
                                                        }}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter') {
                                                                event.preventDefault();
                                                                void saveTripNumber(item.id);
                                                            }
                                                            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                                                event.preventDefault();

                                                                const currentIndex = aReceberIndexById.get(item.id) ?? -1;

                                                                if (currentIndex < 0) return;

                                                                const targetIndex = event.key === 'ArrowDown'
                                                                    ? Math.min(aReceber.length - 1, currentIndex + 1)
                                                                    : Math.max(0, currentIndex - 1);

                                                                if (targetIndex === currentIndex) return;

                                                                const target = aReceberRef.current[targetIndex];

                                                                if (!target) return;

                                                                skipTripBlurSaveRef.current = true;
                                                                void saveTripNumber(item.id, target.id);
                                                            }
                                                            if (event.key === 'Escape') {
                                                                setEditingTripId(null);
                                                                setTripDraft('');
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    <Button type="button" variant="outline" size="sm" onClick={() => startTripEdit(item)}>
                                                        {item.n_viagem ?? 'Definir nº viagem'}
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                {billingMode ? (
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox
                                                            checked={Boolean(billingSelection[item.id])}
                                                            onCheckedChange={(checked) =>
                                                                setBillingSelection((previous) => ({
                                                                    ...previous,
                                                                    [item.id]: Boolean(checked),
                                                                }))
                                                            }
                                                        />
                                                        <span className="text-xs text-muted-foreground">Selecionar</span>
                                                    </div>
                                                ) : <span />}
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            startLoadEdit(item)
                                                        }
                                                    >
                                                        Editar
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() =>
                                                            setConfirmDialog({
                                                                kind: 'delete-a',
                                                                id: item.id,
                                                                title: 'Excluir carga cancelada',
                                                                description: `Deseja excluir a carga de placa ${item.placa}? Esta ação não pode ser desfeita.`,
                                                            })
                                                        }
                                                        disabled={processingId === `delete-a:${item.id}`}
                                                    >
                                                        Excluir
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="hidden overflow-x-auto md:block">
                                <table className="w-full min-w-[1060px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            {billingMode ? <th className="py-2 pr-3 font-medium">Sel.</th> : null}
                                            <th className="py-2 pr-3 font-medium">Data</th>
                                            <th className="py-2 pr-3 font-medium">Placa</th>
                                            <th className="py-2 pr-3 font-medium">Aviário</th>
                                            <th className="py-2 pr-3 font-medium">
                                                <div className="flex flex-col leading-tight">
                                                    <span>Frete</span>
                                                    <span className="text-[10px] normal-case tracking-normal text-muted-foreground">
                                                        Σ {formatCurrencyBR(aReceberTotal)}
                                                    </span>
                                                </div>
                                            </th>
                                            <th className="py-2 pr-3 font-medium">nº Viagem</th>
                                            <th className="py-2 pr-3 font-medium">Obs.</th>
                                            <th className="py-2 pr-3 font-medium">Unidade</th>
                                            <th className="py-2 pr-3 text-right font-medium">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {aReceber.map((item) => (
                                            <tr key={item.id} className="border-b hover:bg-muted/30 last:border-b-0">
                                                {billingMode ? (
                                                    <td className="py-2 pr-3">
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/40 bg-primary/10">
                                                            <Checkbox
                                                                checked={Boolean(billingSelection[item.id])}
                                                                onCheckedChange={(checked) =>
                                                                    setBillingSelection((previous) => ({
                                                                        ...previous,
                                                                        [item.id]: Boolean(checked),
                                                                    }))
                                                                }
                                                            />
                                                        </div>
                                                    </td>
                                                ) : null}
                                                <td className="py-2 pr-3">{formatDateBR(item.data, item.data)}</td>
                                                <td className="py-2 pr-3 font-medium">{item.placa}</td>
                                                <td className="py-2 pr-3">{item.aviario ?? '-'}</td>
                                                <td className="py-2 pr-3">{formatCurrencyBR(item.valor)}</td>
                                                <td
                                                    className="py-2 pr-3"
                                                    onDoubleClick={() => startTripEdit(item)}
                                                    title="Duplo clique para editar"
                                                >
                                                    {editingTripId === item.id ? (
                                                        <Input
                                                            autoFocus
                                                            value={tripDraft}
                                                            disabled={savingTripId === item.id}
                                                            onChange={(event) => setTripDraft(event.target.value)}
                                                            onBlur={() => {
                                                                if (skipTripBlurSaveRef.current) {
                                                                    skipTripBlurSaveRef.current = false;
                                                                    return;
                                                                }

                                                                void saveTripNumber(item.id);
                                                            }}
                                                            onKeyDown={(event) => {
                                                                if (event.key === 'Enter') {
                                                                    event.preventDefault();
                                                                    void saveTripNumber(item.id);
                                                                }
                                                                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                                                    event.preventDefault();

                                                                    const currentIndex = aReceberIndexById.get(item.id) ?? -1;

                                                                    if (currentIndex < 0) return;

                                                                    const targetIndex = event.key === 'ArrowDown'
                                                                        ? Math.min(aReceber.length - 1, currentIndex + 1)
                                                                        : Math.max(0, currentIndex - 1);

                                                                    if (targetIndex === currentIndex) return;

                                                                    const target = aReceberRef.current[targetIndex];

                                                                    if (!target) return;

                                                                    skipTripBlurSaveRef.current = true;
                                                                    void saveTripNumber(item.id, target.id);
                                                                }
                                                                if (event.key === 'Escape') {
                                                                    setEditingTripId(null);
                                                                    setTripDraft('');
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        item.n_viagem ?? '-'
                                                    )}
                                                </td>
                                                <td className="py-2 pr-3">{item.obs ?? '-'}</td>
                                                <td className="py-2 pr-3">{item.unidade?.nome ?? '-'}</td>
                                                <td className="py-2 pr-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() =>
                                                                startLoadEdit(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            Editar
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() =>
                                                                setConfirmDialog({
                                                                    kind: 'delete-a',
                                                                    id: item.id,
                                                                    title: 'Excluir carga cancelada',
                                                                    description: `Deseja excluir a carga de placa ${item.placa}? Esta ação não pode ser desfeita.`,
                                                                })
                                                            }
                                                            disabled={processingId === `delete-a:${item.id}`}
                                                        >
                                                            Excluir
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>

                                {billingMode ? (
                                    <div className="rounded-md border bg-muted/20 px-3 py-2 text-right text-base font-bold">
                                        Soma selecionada: {formatCurrencyBR(selectedTotal)}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recebidas ({recebidas.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading || loadingLists ? (
                            <div className="space-y-2">
                                {Array.from({ length: 3 }).map((_, index) => (
                                    <div key={`recebidas-skeleton-${index}`} className="rounded-md border p-3">
                                        <Skeleton className="mb-2 h-4 w-56" />
                                        <Skeleton className="mb-2 h-3 w-full" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                ))}
                            </div>
                        ) : receivedGroups.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum pagamento recebido.</p>
                        ) : (
                            <div className="space-y-3">
                            <div className="space-y-3 md:hidden">
                                {receivedGroups.map((group) => (
                                    <div key={`mobile-r-${group.key}`} className="space-y-2 rounded-md border p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold">{group.descricao}</p>
                                                <p className="text-xs text-muted-foreground">{formatDateBR(group.dataPagamento, group.dataPagamento ?? '-')}</p>
                                            </div>
                                            <p className="text-sm font-semibold">{formatCurrencyBR(group.total)}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground">NF: <span className="text-foreground">{group.numeroNotaFiscal ?? '-'}</span></p>
                                        <p className="text-xs text-muted-foreground">Unidade: <span className="text-foreground">{group.unidadeNome}</span></p>
                                        <p className="text-xs text-muted-foreground">Qtd cargas: <span className="text-foreground">{group.items.length}</span></p>
                                        <div className="flex justify-end gap-2">
                                            {group.batchId ? (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => void unbillBatch(group.batchId as number)}
                                                        disabled={processingId === `unbill-b:${group.batchId}`}
                                                    >
                                                        Desfaturar
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() =>
                                                            setConfirmDialog({
                                                                kind: 'delete-b',
                                                                id: group.batchId as number,
                                                                title: 'Excluir pagamento',
                                                                description: `Deseja excluir o pagamento "${group.descricao}"? Todas as cargas do lote serão removidas.`,
                                                            })
                                                        }
                                                        disabled={processingId === `delete-b:${group.batchId}`}
                                                    >
                                                        Excluir
                                                    </Button>
                                                </>
                                            ) : null}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full min-w-[1040px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-2 pr-3 font-medium">Descrição</th>
                                            <th className="py-2 pr-3 font-medium">Data faturamento</th>
                                            <th className="py-2 pr-3 font-medium">NF</th>
                                            <th className="py-2 pr-3 font-medium">Qtd cargas</th>
                                            <th className="py-2 pr-3 font-medium">Total</th>
                                            <th className="py-2 pr-3 font-medium">Unidade</th>
                                            <th className="py-2 pr-3 text-right font-medium">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {receivedGroups.map((group) => {
                                            const expanded = Boolean(expandedGroups[group.key]);

                                            return (
                                                <Fragment key={group.key}>
                                                    <tr key={group.key} className="border-b hover:bg-muted/30">
                                                        <td className="py-2 pr-3 font-medium">{group.descricao}</td>
                                                        <td className="py-2 pr-3">{formatDateBR(group.dataPagamento, group.dataPagamento ?? '-')}</td>
                                                        <td className="py-2 pr-3">{group.numeroNotaFiscal ?? '-'}</td>
                                                        <td className="py-2 pr-3">{group.items.length}</td>
                                                        <td className="py-2 pr-3 font-semibold">{formatCurrencyBR(group.total)}</td>
                                                        <td className="py-2 pr-3">{group.unidadeNome}</td>
                                                        <td className="py-2 pr-3">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => toggleGroup(group.key)}
                                                                >
                                                                    {expanded ? 'Ocultar' : 'Expandir'}
                                                                </Button>

                                                                {group.batchId ? (
                                                                    <>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            onClick={() => void unbillBatch(group.batchId as number)}
                                                                            disabled={processingId === `unbill-b:${group.batchId}`}
                                                                        >
                                                                            Desfaturar
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="destructive"
                                                                            onClick={() =>
                                                                                setConfirmDialog({
                                                                                    kind: 'delete-b',
                                                                                    id: group.batchId as number,
                                                                                    title: 'Excluir pagamento',
                                                                                    description: `Deseja excluir o pagamento "${group.descricao}"? Todas as cargas do lote serão removidas.`,
                                                                                })
                                                                            }
                                                                            disabled={processingId === `delete-b:${group.batchId}`}
                                                                        >
                                                                            Excluir
                                                                        </Button>
                                                                    </>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {expanded ? (
                                                        <tr className="border-b bg-muted/20">
                                                            <td colSpan={7} className="p-3">
                                                                <table className="w-full text-sm">
                                                                    <thead>
                                                                        <tr className="border-b text-left text-muted-foreground">
                                                                            <th className="py-2 pr-3 font-medium">Data</th>
                                                                            <th className="py-2 pr-3 font-medium">Placa</th>
                                                                            <th className="py-2 pr-3 font-medium">Aviário</th>
                                                                            <th className="py-2 pr-3 font-medium">Frete</th>
                                                                            <th className="py-2 pr-3 font-medium">nº Viagem</th>
                                                                            <th className="py-2 pr-3 font-medium">Obs.</th>
                                                                            <th className="py-2 pr-3 text-right font-medium">Ações</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {group.items.map((item) => (
                                                                            <tr key={item.id} className="border-b hover:bg-muted/20 last:border-b-0">
                                                                                <td className="py-2 pr-3">{formatDateBR(item.data, item.data)}</td>
                                                                                <td className="py-2 pr-3 font-medium">{item.placa}</td>
                                                                                <td className="py-2 pr-3">{item.aviario ?? '-'}</td>
                                                                                <td className="py-2 pr-3">{formatCurrencyBR(item.valor)}</td>
                                                                                <td className="py-2 pr-3">{item.n_viagem ?? '-'}</td>
                                                                                <td className="py-2 pr-3">{item.obs ?? '-'}</td>
                                                                                <td className="py-2 pr-3">
                                                                                    <div className="flex justify-end gap-2">
                                                                                        <Button
                                                                                            size="sm"
                                                                                            variant="outline"
                                                                                            onClick={() =>
                                                                                                startLoadEdit(item)
                                                                                            }
                                                                                        >
                                                                                            Editar
                                                                                        </Button>
                                                                                        <Button
                                                                                            size="sm"
                                                                                            variant="outline"
                                                                                            onClick={() => void unbillOne(item.id)}
                                                                                            disabled={processingId === `unbill-i:${item.id}`}
                                                                                        >
                                                                                            Desfaturar
                                                                                        </Button>
                                                                                        <Button
                                                                                            size="sm"
                                                                                            variant="destructive"
                                                                                            onClick={() =>
                                                                                                setConfirmDialog({
                                                                                                    kind: 'delete-i',
                                                                                                    id: item.id,
                                                                                                    title: 'Excluir carga recebida',
                                                                                                    description: `Deseja excluir a carga de placa ${item.placa}?`,
                                                                                                })
                                                                                            }
                                                                                            disabled={processingId === `delete-i:${item.id}`}
                                                                                        >
                                                                                            Excluir
                                                                                        </Button>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    ) : null}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog
                open={Boolean(confirmDialog)}
                onOpenChange={(open) => {
                    if (!open) {
                        setConfirmDialog(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{confirmDialog?.title ?? 'Confirmar ação'}</DialogTitle>
                        <DialogDescription>{confirmDialog?.description ?? ''}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setConfirmDialog(null)}>
                            Cancelar
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => void executeConfirmedAction()}>
                            Confirmar exclusão
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(editLoadDraft)}
                onOpenChange={(open) => {
                    if (!open && !savingEditedLoad) {
                        setEditLoadDraft(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar carga cancelada</DialogTitle>
                        <DialogDescription>
                            Atualize os dados da carga selecionada.
                        </DialogDescription>
                    </DialogHeader>

                    {editLoadDraft ? (
                        <div className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-canceled-data">Data</Label>
                                    <Input
                                        id="edit-canceled-data"
                                        type="date"
                                        value={editLoadDraft.data}
                                        onChange={(event) =>
                                            setEditLoadDraft((previous) =>
                                                previous
                                                    ? {
                                                          ...previous,
                                                          data: event.target.value,
                                                      }
                                                    : previous,
                                            )
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-canceled-placa">Placa</Label>
                                    <Input
                                        id="edit-canceled-placa"
                                        value={editLoadDraft.placa}
                                        onChange={(event) =>
                                            setEditLoadDraft((previous) =>
                                                previous
                                                    ? {
                                                          ...previous,
                                                          placa: event.target.value.toUpperCase(),
                                                      }
                                                    : previous,
                                            )
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-canceled-aviario">Aviário</Label>
                                    <Input
                                        id="edit-canceled-aviario"
                                        value={editLoadDraft.aviario}
                                        onChange={(event) =>
                                            setEditLoadDraft((previous) =>
                                                previous
                                                    ? {
                                                          ...previous,
                                                          aviario: event.target.value,
                                                      }
                                                    : previous,
                                            )
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-canceled-valor">Frete</Label>
                                    <Input
                                        id="edit-canceled-valor"
                                        value={editLoadDraft.valor}
                                        onChange={(event) =>
                                            setEditLoadDraft((previous) =>
                                                previous
                                                    ? {
                                                          ...previous,
                                                          valor: moneyMaskBR(event.target.value),
                                                      }
                                                    : previous,
                                            )
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-canceled-viagem">nº Viagem</Label>
                                    <Input
                                        id="edit-canceled-viagem"
                                        value={editLoadDraft.n_viagem}
                                        onChange={(event) =>
                                            setEditLoadDraft((previous) =>
                                                previous
                                                    ? {
                                                          ...previous,
                                                          n_viagem: event.target.value,
                                                      }
                                                    : previous,
                                            )
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-canceled-obs">Obs.</Label>
                                    <Input
                                        id="edit-canceled-obs"
                                        value={editLoadDraft.obs}
                                        onChange={(event) =>
                                            setEditLoadDraft((previous) =>
                                                previous
                                                    ? {
                                                          ...previous,
                                                          obs: event.target.value,
                                                      }
                                                    : previous,
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setEditLoadDraft(null)}
                            disabled={savingEditedLoad}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void saveEditedLoad()}
                            disabled={savingEditedLoad}
                        >
                            {savingEditedLoad ? 'Salvando...' : 'Salvar alterações'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={billingDialogOpen} onOpenChange={setBillingDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Iniciar faturamento</DialogTitle>
                        <DialogDescription>
                            Informe descrição, data de pagamento e número da nota fiscal para o novo pagamento agrupado.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="billing-description">Descrição</Label>
                            <Input
                                id="billing-description"
                                value={billingDescription}
                                onChange={(event) => setBillingDescription(event.target.value)}
                                placeholder="Ex.: Pagamento abatedouro semana 1"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="billing-date">Data de pagamento</Label>
                            <Input
                                id="billing-date"
                                type="date"
                                value={billingDate}
                                onChange={(event) => setBillingDate(event.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="billing-invoice">Número da nota fiscal</Label>
                            <Input
                                id="billing-invoice"
                                value={billingInvoiceNumber}
                                onChange={(event) => setBillingInvoiceNumber(event.target.value)}
                                placeholder="NF-12345"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setBillingDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="button" onClick={beginBillingSelection}>
                            Iniciar seleção
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
