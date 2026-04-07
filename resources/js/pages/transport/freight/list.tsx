import { router } from '@inertiajs/react';
import { FileSpreadsheet, Pencil, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { ApiError, apiDelete, apiDownload, apiGet } from '@/lib/api-client';
import { formatCurrencyBR, formatDateBR, formatIntegerBR } from '@/lib/transport-format';
import type { FreightSpotEntry } from '@/types/freight';

interface WrappedResponse<T> {
    data: T;
}

interface FreightEntry {
    id: number;
    data: string;
    dia_semana?: string;
    unidade_id: number;
    frete_total: string;
    cargas: string;
    aves: string;
    veiculos: string;
    km_rodado: string;
    observacoes: string | null;
    created_at: string;
    updated_at: string;
}

interface FreightEntryPaginatedResponse {
    data: FreightEntry[];
    current_page: number;
    last_page: number;
    total: number;
}

interface FreightSpotPaginatedResponse {
    data: FreightSpotEntry[];
    current_page: number;
    last_page: number;
    total: number;
}

interface FreightUnit {
    id: number;
    nome: string;
    slug: string;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

const PAGE_SIZE = 120;
const ROW_HEIGHT = 52;
const ROW_OVERSCAN = 8;
const TABLE_VIEWPORT_HEIGHT = 560;

export default function FreightList() {
    const [items, setItems] = useState<FreightEntry[]>([]);
    const [units, setUnits] = useState<FreightUnit[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error';
    } | null>(null);
    const [editingItem, setEditingItem] = useState<FreightEntry | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [filterUnit, setFilterUnit] = useState<string>('all');
    const [filterDate, setFilterDate] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);
    const [tableScrollTop, setTableScrollTop] = useState(0);
    const [spotItems, setSpotItems] = useState<FreightSpotEntry[]>([]);
    const [spotLoading, setSpotLoading] = useState(false);
    const [deletingSpotId, setDeletingSpotId] = useState<number | null>(null);
    const [spotDeleteConfirmOpen, setSpotDeleteConfirmOpen] = useState(false);
    const [spotDeleteCandidate, setSpotDeleteCandidate] = useState<FreightSpotEntry | null>(null);
    const latestLoadSeqRef = useRef(0);

    useEffect(() => {
        void loadUnits();
    }, []);

    useEffect(() => {
        void loadData({ reset: true });
    }, [filterUnit, filterDate]);

    useEffect(() => {
        void loadSpotData();
    }, [filterUnit, filterDate]);

    async function loadUnits(): Promise<void> {
        try {
            const unitsResponse = await apiGet<WrappedResponse<FreightUnit[]>>('/registry/unidades');
            setUnits(unitsResponse.data);
        } catch {
            setNotification({ message: 'Erro ao carregar unidades', variant: 'error' });
        }
    }

    async function loadData(options?: { expectedMissingId?: number; reset?: boolean }): Promise<void> {
        const seq = Date.now();
        latestLoadSeqRef.current = seq;
        const pageToLoad = options?.reset ? 1 : currentPage + 1;

        try {
            if (options?.reset) {
                setLoading(true);
                setTableScrollTop(0);
            } else {
                setLoadingMore(true);
            }

            const queryTs = Date.now();
            const params = new URLSearchParams({
                per_page: String(PAGE_SIZE),
                page: String(pageToLoad),
                _ts: String(queryTs),
            });

            if (filterUnit !== 'all') {
                params.set('unidade_id', filterUnit);
            }

            if (filterDate) {
                params.set('start_date', filterDate);
                params.set('end_date', filterDate);
            }

            const freightResponse = await apiGet<FreightEntryPaginatedResponse>(`/freight/entries?${params.toString()}`);

            if (latestLoadSeqRef.current !== seq) {
                return;
            }

            let loadedItems = freightResponse.data;

            if (options?.expectedMissingId) {
                for (let attempt = 0; attempt < 3; attempt += 1) {
                    const stillPresent = loadedItems.some((item) => item.id === options.expectedMissingId);

                    if (!stillPresent) {
                        break;
                    }

                    await sleep(220);
                    const retryParams = new URLSearchParams(params);
                    retryParams.set('_ts', String(Date.now()));
                    retryParams.set('retry', String(attempt + 1));
                    const fresh = await apiGet<FreightEntryPaginatedResponse>(
                        `/freight/entries?${retryParams.toString()}`,
                    );
                    loadedItems = fresh.data;
                }
            }

            setCurrentPage(freightResponse.current_page);
            setLastPage(freightResponse.last_page);
            setTotalItems(freightResponse.total);

            if (options?.reset) {
                setItems(loadedItems);
            } else {
                setItems((previous) => [...previous, ...loadedItems]);
            }
        } catch (error) {
            let message = 'Erro ao carregar dados';

            if (error instanceof ApiError) {
                message = error.message;
            }

            setNotification({ message, variant: 'error' });
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }

    async function loadSpotData(): Promise<void> {
        setSpotLoading(true);

        try {
            const params = new URLSearchParams({
                per_page: String(PAGE_SIZE),
                page: '1',
            });

            if (filterUnit !== 'all') {
                params.set('unidade_origem_id', filterUnit);
            }

            if (filterDate) {
                params.set('start_date', filterDate);
                params.set('end_date', filterDate);
            }

            const response = await apiGet<FreightSpotPaginatedResponse>(`/freight/spot-entries?${params.toString()}`);
            setSpotItems(response.data);
        } catch (error) {
            let message = 'Erro ao carregar fretes spot';

            if (error instanceof ApiError) {
                message = error.message;
            }

            setNotification({ message, variant: 'error' });
        } finally {
            setSpotLoading(false);
        }
    }

    async function handleDelete(item: FreightEntry): Promise<void> {
        if (!item.id) return;

        setDeleting(true);

        try {
            await apiDelete(`/freight/entries/${item.id}`);

            setItems((prev) => prev.filter((i) => i.id !== item.id));
            setDeleteConfirmOpen(false);
            setEditingItem(null);
            await loadData({ expectedMissingId: item.id, reset: true });

            setNotification({
                message: 'Lançamento de frete deletado com sucesso.',
                variant: 'success',
            });
        } catch (error) {
            let message = 'Não foi possível deletar o lançamento.';

            if (error instanceof ApiError) {
                message = error.message;
            }

            setNotification({ message, variant: 'error' });
        } finally {
            setDeleting(false);
        }
    }

    function handleEdit(item: FreightEntry): void {
        setEditingItem(item);
        // Redirect to launch page with edit mode
        router.get(`/transport/freight/launch?edit=${item.id}`);
    }

    function handleSpotEdit(item: FreightSpotEntry): void {
        router.get(`/transport/freight/spot?edit=${item.id}`);
    }

    async function handleSpotDelete(item: FreightSpotEntry): Promise<void> {
        setDeletingSpotId(item.id);

        try {
            await apiDelete(`/freight/spot-entries/${item.id}`);
            setSpotItems((previous) => previous.filter((entry) => entry.id !== item.id));
            setSpotDeleteConfirmOpen(false);
            setSpotDeleteCandidate(null);
            setNotification({ message: 'Frete spot excluído com sucesso.', variant: 'success' });
        } catch (error) {
            let message = 'Não foi possível excluir o frete spot.';

            if (error instanceof ApiError) {
                message = error.message;
            }

            setNotification({ message, variant: 'error' });
        } finally {
            setDeletingSpotId(null);
        }
    }

    async function handleExportXlsx(): Promise<void> {
        const params = new URLSearchParams();

        if (filterUnit !== 'all') {
            params.set('unidade_id', filterUnit);
        }

        if (filterDate) {
            params.set('start_date', filterDate);
            params.set('end_date', filterDate);
        }

        try {
            await apiDownload(
                `/freight/entries/export-xlsx?${params.toString()}`,
                `fretes_${new Date().toISOString().slice(0, 10)}.xlsx`,
            );
        } catch (error) {
            let message = 'Não foi possível exportar os fretes em XLSX.';

            if (error instanceof ApiError) {
                message = error.message;
            }

            setNotification({ message, variant: 'error' });
        }
    }

    const virtualization = useMemo(() => {
        const total = items.length;
        if (total === 0) {
            return {
                startIndex: 0,
                endIndex: 0,
                topPadding: 0,
                bottomPadding: 0,
                visibleItems: [] as FreightEntry[],
            };
        }

        const visibleCount = Math.ceil(TABLE_VIEWPORT_HEIGHT / ROW_HEIGHT);
        const startIndex = Math.max(0, Math.floor(tableScrollTop / ROW_HEIGHT) - ROW_OVERSCAN);
        const endIndex = Math.min(total, startIndex + visibleCount + ROW_OVERSCAN * 2);

        return {
            startIndex,
            endIndex,
            topPadding: startIndex * ROW_HEIGHT,
            bottomPadding: Math.max(0, (total - endIndex) * ROW_HEIGHT),
            visibleItems: items.slice(startIndex, endIndex),
        };
    }, [items, tableScrollTop]);

    const unitMap = useMemo(() => {
        const map: Record<number, string> = {};
        units.forEach((unit) => {
            map[unit.id] = unit.nome;
        });
        return map;
    }, [units]);

    return (
        <AdminLayout
            title="Gestão de Fretes - Lista"
            active="freight-list"
            module="freight"
        >
            {notification ? (
                <Notification
                    message={notification.message}
                    variant={notification.variant}
                />
            ) : null}

            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Lista de Fretes</h2>
                    <p className="mt-2 text-muted-foreground">
                        Visualize e edite os lançamentos de fretes
                    </p>
                </div>

                <div className="flex gap-2">
                    <Button type="button" size="sm" variant="default" onClick={() => router.get('/transport/freight/list')}>
                        Integração
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => router.get('/transport/freight/spot')}>
                        Spot
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <Label htmlFor="filter-unit">Unidade</Label>
                                <Select
                                    value={filterUnit}
                                    onValueChange={setFilterUnit}
                                >
                                    <SelectTrigger id="filter-unit">
                                        <SelectValue placeholder="Todas as unidades" />
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
                            </div>

                            <div>
                                <Label htmlFor="filter-date">Data</Label>
                                <Input
                                    id="filter-date"
                                    type="date"
                                    value={filterDate}
                                    onChange={(event) =>
                                        setFilterDate(event.target.value)
                                    }
                                />
                            </div>
                        </div>

                        <div className="flex justify-between">
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setFilterUnit('all');
                                        setFilterDate('');
                                    }}
                                >
                                    Limpar filtros
                                </Button>
                                <Button type="button" variant="outline" onClick={() => void handleExportXlsx()} title="Exportar XLSX">
                                    <FileSpreadsheet className="size-4 text-green-600" />
                                </Button>
                            </div>

                            <Button
                                type="button"
                                onClick={() =>
                                    router.get('/transport/freight/launch')
                                }
                            >
                                <Plus className="mr-2 size-4" />
                                Novo lançamento
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            Lançamentos ({formatIntegerBR(totalItems)})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="py-8 text-center text-muted-foreground">
                                Carregando...
                            </div>
                        ) : items.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground">
                                Nenhum lançamento encontrado
                            </div>
                        ) : (
                            <div
                                className="overflow-auto rounded-md border"
                                style={{ maxHeight: TABLE_VIEWPORT_HEIGHT }}
                                onScroll={(event) => setTableScrollTop(event.currentTarget.scrollTop)}
                            >
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-4 py-3 text-left font-semibold">
                                                Data
                                            </th>
                                            <th className="px-4 py-3 text-left font-semibold">
                                                Dia
                                            </th>
                                            <th className="px-4 py-3 text-left font-semibold">
                                                Unidade
                                            </th>
                                            <th className="px-4 py-3 text-right font-semibold">
                                                Frete (R$)
                                            </th>
                                            <th className="px-4 py-3 text-right font-semibold">
                                                Cargas
                                            </th>
                                            <th className="px-4 py-3 text-right font-semibold">
                                                Aves
                                            </th>
                                            <th className="px-4 py-3 text-right font-semibold">
                                                Veículos
                                            </th>
                                            <th className="px-4 py-3 text-right font-semibold">
                                                KM
                                            </th>
                                            <th className="px-4 py-3 text-center font-semibold">
                                                Ações
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {virtualization.topPadding > 0 ? (
                                            <tr>
                                                <td colSpan={9} style={{ height: virtualization.topPadding }} />
                                            </tr>
                                        ) : null}

                                        {virtualization.visibleItems.map((item) => (
                                            <tr
                                                key={item.id}
                                                className="border-b hover:bg-muted/40"
                                            >
                                                <td className="px-4 py-3">
                                                    {formatDateBR(item.data)}
                                                </td>
                                                <td className="px-4 py-3 capitalize">
                                                        {item.dia_semana ?? '-'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {unitMap[item.unidade_id] ||
                                                        'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {formatCurrencyBR(item.frete_total)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {formatIntegerBR(item.cargas)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {formatIntegerBR(item.aves)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {formatIntegerBR(item.veiculos)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {formatIntegerBR(item.km_rodado)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                handleEdit(item)
                                                            }
                                                            title="Editar"
                                                        >
                                                            <Pencil className="size-4 text-green-600" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => {
                                                                setEditingItem(
                                                                    item,
                                                                );
                                                                setDeleteConfirmOpen(
                                                                    true,
                                                                );
                                                            }}
                                                            title="Deletar"
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}

                                        {virtualization.bottomPadding > 0 ? (
                                            <tr>
                                                <td colSpan={9} style={{ height: virtualization.bottomPadding }} />
                                            </tr>
                                        ) : null}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {currentPage < lastPage ? (
                            <div className="mt-4 flex justify-center">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => void loadData()}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? 'Carregando...' : 'Carregar mais'}
                                </Button>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Fretes Spot ({formatIntegerBR(spotItems.length)})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {spotLoading ? (
                            <div className="py-8 text-center text-muted-foreground">Carregando fretes spot...</div>
                        ) : spotItems.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground">Nenhum frete spot encontrado</div>
                        ) : (
                            <div className="overflow-auto rounded-md border">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-4 py-3 text-left font-semibold">Data</th>
                                            <th className="px-4 py-3 text-left font-semibold">Frota origem</th>
                                            <th className="px-4 py-3 text-right font-semibold">Frete Spot (R$)</th>
                                            <th className="px-4 py-3 text-right font-semibold">Cargas</th>
                                            <th className="px-4 py-3 text-right font-semibold">Aves</th>
                                            <th className="px-4 py-3 text-right font-semibold">KM</th>
                                            <th className="px-4 py-3 text-center font-semibold">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {spotItems.map((item) => (
                                            <tr key={`spot-${item.id}`} className="border-b hover:bg-muted/40">
                                                <td className="px-4 py-3">{formatDateBR(item.data)}</td>
                                                <td className="px-4 py-3">{item.unidade_origem?.nome ?? 'N/A'}</td>
                                                <td className="px-4 py-3 text-right">{formatCurrencyBR(item.frete_spot)}</td>
                                                <td className="px-4 py-3 text-right">{formatIntegerBR(item.cargas)}</td>
                                                <td className="px-4 py-3 text-right">{formatIntegerBR(item.aves)}</td>
                                                <td className="px-4 py-3 text-right">{formatIntegerBR(item.km_rodado)}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-center gap-2">
                                                        <Button size="sm" variant="ghost" onClick={() => handleSpotEdit(item)} title="Editar spot">
                                                            <Pencil className="size-4 text-green-600" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => {
                                                                setSpotDeleteCandidate(item);
                                                                setSpotDeleteConfirmOpen(true);
                                                            }}
                                                            title="Excluir spot"
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar exclusão</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja deletar o lançamento de{' '}
                            {editingItem
                                ? formatDateBR(editingItem.data)
                                : 'frete'}
                            ? Esta ação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeleteConfirmOpen(false)}
                            disabled={deleting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                                if (editingItem) {
                                    void handleDelete(editingItem);
                                }
                            }}
                            disabled={deleting}
                        >
                            {deleting ? 'Deletando...' : 'Deletar'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={spotDeleteConfirmOpen}
                onOpenChange={setSpotDeleteConfirmOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar exclusão (Spot)</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja deletar o frete spot de{' '}
                            {spotDeleteCandidate
                                ? formatDateBR(spotDeleteCandidate.data)
                                : 'spot'}
                            ? Esta ação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setSpotDeleteConfirmOpen(false)}
                            disabled={deletingSpotId !== null}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                                if (spotDeleteCandidate) {
                                    void handleSpotDelete(spotDeleteCandidate);
                                }
                            }}
                            disabled={deletingSpotId !== null}
                        >
                            {deletingSpotId !== null ? 'Deletando...' : 'Deletar'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
