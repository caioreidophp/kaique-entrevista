import { router } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
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
import { ApiError, apiDelete, apiGet } from '@/lib/api-client';
import { formatCurrencyBR, formatDateBR, formatIntegerBR } from '@/lib/transport-format';

interface WrappedResponse<T> {
    data: T;
}

interface FreightEntry {
    id: number;
    data: string;
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

interface FreightUnit {
    id: number;
    nome: string;
    slug: string;
}

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

    useEffect(() => {
        loadData();
    }, []);

    async function loadData(): Promise<void> {
        try {
            setLoading(true);

            const [unitsResponse, freightResponse] = await Promise.all([
                apiGet<WrappedResponse<FreightUnit[]>>('/registry/unidades'),
                apiGet<FreightEntryPaginatedResponse>('/freight/entries?per_page=100'),
            ]);

            setUnits(unitsResponse.data);
            setItems(freightResponse.data);
        } catch (error) {
            let message = 'Erro ao carregar dados';

            if (error instanceof ApiError) {
                message = error.message;
            }

            setNotification({ message, variant: 'error' });
        } finally {
            setLoading(false);
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

    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            const unitMatch = filterUnit === 'all' || item.unidade_id === Number(filterUnit);
            const dateMatch = !filterDate || item.data.startsWith(filterDate);
            return unitMatch && dateMatch;
        });
    }, [items, filterUnit, filterDate]);

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
                    <h1 className="text-3xl font-bold">Lista de Fretes</h1>
                    <p className="mt-2 text-muted-foreground">
                        Visualize e edite os lançamentos de fretes
                    </p>
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
                            Lançamentos ({filteredItems.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="py-8 text-center text-muted-foreground">
                                Carregando...
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground">
                                Nenhum lançamento encontrado
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-4 py-3 text-left font-semibold">
                                                Data
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
                                        {filteredItems.map((item) => (
                                            <tr
                                                key={item.id}
                                                className="border-b hover:bg-muted/40"
                                            >
                                                <td className="px-4 py-3">
                                                    {formatDateBR(item.data)}
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
                                                            <Pencil className="size-4" />
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
        </AdminLayout>
    );
}
