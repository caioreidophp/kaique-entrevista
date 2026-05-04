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
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';

interface UnidadeOption {
    id: number;
    nome: string;
}

interface FleetSizeItem {
    id: number;
    unidade_id: number;
    unidade_nome: string | null;
    reference_month: string | null;
    fleet_size: number;
}

interface FleetSizeResponse {
    competencia_mes: number;
    competencia_ano: number;
    data: FleetSizeItem[];
}

interface WrappedResponse<T> {
    data: T;
}

function monthValue(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, '0')}`;
}

function monthLabel(referenceMonth: string | null): string {
    if (!referenceMonth || !/^\d{4}-\d{2}$/.test(referenceMonth)) {
        return '-';
    }

    const [year, month] = referenceMonth.split('-').map((value) => Number(value));
    const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthIndex = Math.max(1, Math.min(12, month)) - 1;

    return `${labels[monthIndex] ?? 'Mes'}/${year}`;
}

export default function TransportFreightFleetSizeConfigPage() {
    const now = new Date();
    const [month, setMonth] = useState(String(now.getMonth() + 1));
    const [year, setYear] = useState(String(now.getFullYear()));
    const [unidades, setUnidades] = useState<UnidadeOption[]>([]);
    const [rows, setRows] = useState<FleetSizeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const [formOpen, setFormOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<FleetSizeItem | null>(null);
    const [formUnitId, setFormUnitId] = useState('none');
    const [formReferenceMonth, setFormReferenceMonth] = useState(monthValue(now.getFullYear(), now.getMonth() + 1));
    const [formFleetSize, setFormFleetSize] = useState('');

    const [deleteTarget, setDeleteTarget] = useState<FleetSizeItem | null>(null);

    const yearOptions = useMemo(() => {
        const current = now.getFullYear();
        return [String(current - 1), String(current), String(current + 1)];
    }, [now]);

    async function loadUnits(): Promise<void> {
        const response = await apiGet<WrappedResponse<UnidadeOption[]>>('/registry/unidades?active=1');
        setUnidades(response.data ?? []);
    }

    async function loadFleet(): Promise<void> {
        setLoading(true);
        setNotification(null);

        try {
            const params = new URLSearchParams({
                competencia_mes: month,
                competencia_ano: year,
            });
            const response = await apiGet<FleetSizeResponse>(`/freight/fleet-sizes?${params.toString()}`);
            setRows(response.data ?? []);
        } catch {
            setNotification({
                message: 'Nao foi possivel carregar a frota mensal.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadUnits();
    }, []);

    useEffect(() => {
        void loadFleet();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month, year]);

    function openCreate(): void {
        setEditTarget(null);
        setFormUnitId('none');
        setFormReferenceMonth(monthValue(Number(year), Number(month)));
        setFormFleetSize('');
        setFormOpen(true);
    }

    function openEdit(row: FleetSizeItem): void {
        setEditTarget(row);
        setFormUnitId(String(row.unidade_id));
        setFormReferenceMonth(row.reference_month ?? monthValue(Number(year), Number(month)));
        setFormFleetSize(String(row.fleet_size));
        setFormOpen(true);
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setSaving(true);
        setNotification(null);

        try {
            const payload = {
                unidade_id: Number(formUnitId),
                reference_month: formReferenceMonth,
                fleet_size: Number(formFleetSize),
            };

            if (!payload.unidade_id || Number.isNaN(payload.unidade_id)) {
                setNotification({
                    message: 'Selecione uma unidade.',
                    variant: 'error',
                });
                return;
            }

            if (!payload.reference_month || !/^\d{4}-\d{2}$/.test(payload.reference_month)) {
                setNotification({
                    message: 'Informe o mes de referencia no formato YYYY-MM.',
                    variant: 'error',
                });
                return;
            }

            if (!payload.fleet_size || payload.fleet_size <= 0 || Number.isNaN(payload.fleet_size)) {
                setNotification({
                    message: 'Informe uma quantidade valida de caminhoes.',
                    variant: 'error',
                });
                return;
            }

            if (editTarget) {
                await apiPut(`/freight/fleet-sizes/${editTarget.id}`, {
                    fleet_size: payload.fleet_size,
                });
            } else {
                await apiPost('/freight/fleet-sizes', payload);
            }

            setNotification({
                message: editTarget
                    ? 'Frota mensal atualizada com sucesso.'
                    : 'Frota mensal cadastrada com sucesso.',
                variant: 'success',
            });
            setFormOpen(false);
            setEditTarget(null);
            await loadFleet();
        } catch (error) {
            if (error instanceof ApiError) {
                const firstError = error.errors ? Object.values(error.errors)[0]?.[0] : null;
                setNotification({
                    message: firstError ?? error.message,
                    variant: 'error',
                });
            } else {
                setNotification({
                    message: 'Nao foi possivel salvar a frota mensal.',
                    variant: 'error',
                });
            }
        } finally {
            setSaving(false);
        }
    }

    async function confirmDelete(): Promise<void> {
        if (!deleteTarget) return;

        setDeleting(true);
        setNotification(null);

        try {
            await apiDelete(`/freight/fleet-sizes/${deleteTarget.id}`);
            setNotification({
                message: 'Frota mensal removida com sucesso.',
                variant: 'success',
            });
            setDeleteTarget(null);
            await loadFleet();
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({
                    message: error.message,
                    variant: 'error',
                });
            } else {
                setNotification({
                    message: 'Nao foi possivel remover o registro.',
                    variant: 'error',
                });
            }
        } finally {
            setDeleting(false);
        }
    }

    return (
        <AdminLayout
            title="Fretes - Frota Mensal"
            active="freight-fleet-size-config"
            module="freight"
        >
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold">Frota mensal por unidade</h2>
                        <p className="text-sm text-muted-foreground">
                            Configure a frota total do mes para calcular "Frete medio por caminhao da frota".
                        </p>
                    </div>
                    <Button type="button" onClick={openCreate}>
                        <PlusSquare className="size-4" />
                        Cadastrar frota
                    </Button>
                </div>

                {notification ? (
                    <Notification message={notification.message} variant={notification.variant} />
                ) : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Filtro de competencia</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Mes</Label>
                            <Select value={month} onValueChange={setMonth}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 12 }, (_, index) => {
                                        const value = String(index + 1);
                                        return (
                                            <SelectItem key={value} value={value}>
                                                {String(index + 1).padStart(2, '0')}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Ano</Label>
                            <Select value={year} onValueChange={setYear}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {yearOptions.map((item) => (
                                        <SelectItem key={item} value={item}>
                                            {item}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Registros de frota ({rows.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando registros...
                            </div>
                        ) : rows.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Nenhum cadastro para a competencia selecionada.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-2 pr-3 font-medium">Unidade</th>
                                            <th className="py-2 pr-3 font-medium">Referencia</th>
                                            <th className="py-2 pr-3 font-medium">Frota total</th>
                                            <th className="py-2 text-right font-medium">Acoes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <tr key={row.id} className="border-b last:border-b-0">
                                                <td className="py-2 pr-3 font-medium">{row.unidade_nome ?? '-'}</td>
                                                <td className="py-2 pr-3">{monthLabel(row.reference_month)}</td>
                                                <td className="py-2 pr-3">{row.fleet_size}</td>
                                                <td className="py-2">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openEdit(row)}
                                                        >
                                                            <PencilLine className="size-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => setDeleteTarget(row)}
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
                open={formOpen}
                onOpenChange={(open) => {
                    setFormOpen(open);
                    if (!open) {
                        setEditTarget(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editTarget ? 'Editar frota mensal' : 'Cadastrar frota mensal'}</DialogTitle>
                        <DialogDescription>
                            Informe unidade, mes de referencia e quantidade total de caminhoes da frota.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
                        <div className="space-y-2">
                            <Label>Unidade</Label>
                            <Select
                                value={formUnitId}
                                onValueChange={setFormUnitId}
                                disabled={Boolean(editTarget)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Selecione</SelectItem>
                                    {unidades.map((unit) => (
                                        <SelectItem key={unit.id} value={String(unit.id)}>
                                            {unit.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="fleet-reference-month">Referencia (YYYY-MM)</Label>
                            <Input
                                id="fleet-reference-month"
                                value={formReferenceMonth}
                                onChange={(event) => setFormReferenceMonth(event.target.value)}
                                placeholder="2026-05"
                                disabled={Boolean(editTarget)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="fleet-size">Quantidade da frota</Label>
                            <Input
                                id="fleet-size"
                                type="number"
                                min={1}
                                value={formFleetSize}
                                onChange={(event) => setFormFleetSize(event.target.value)}
                                placeholder="Ex.: 30"
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={saving}>
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

            <Dialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteTarget(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir registro de frota?</DialogTitle>
                        <DialogDescription>
                            Esta acao remove o cadastro de frota de{' '}
                            <strong>{deleteTarget?.unidade_nome}</strong> em{' '}
                            <strong>{monthLabel(deleteTarget?.reference_month ?? null)}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeleteTarget(null)}
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
        </AdminLayout>
    );
}
