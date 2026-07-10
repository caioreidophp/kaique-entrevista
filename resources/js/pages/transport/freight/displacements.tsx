import { LoaderCircle, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
    FreightDisplacement,
    FreightDisplacementStatus,
    FreightUnit,
} from '@/types/freight';
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
import {
    decimalThousandsMaskBR,
    formatCurrencyBR,
    formatDateBR,
    formatEditableDecimalBR,
    formatEditableIntegerBR,
    formatEditableMoneyBR,
    moneyMaskBR,
    toNumberSafe,
} from '@/lib/transport-format';

interface WrappedResponse<T> {
    data: T;
}

interface PaginatedResponse<T> {
    data: T[];
}

interface DisplacementFormData {
    data: string;
    descricao: string;
    unidade_veiculos_id: string;
    quantidade_caminhoes: string;
    placas: string;
    origem: string;
    destino: string;
    km_aproximado: string;
    valor_aproximado: string;
    unidade_pagadora_id: string;
    status: FreightDisplacementStatus;
}

const emptyForm: DisplacementFormData = {
    data: new Date().toISOString().slice(0, 10),
    descricao: '',
    unidade_veiculos_id: '',
    quantidade_caminhoes: '',
    placas: '',
    origem: '',
    destino: '',
    km_aproximado: '',
    valor_aproximado: '',
    unidade_pagadora_id: '',
    status: 'pendente',
};

const statusOptions: Array<{
    value: FreightDisplacementStatus;
    label: string;
}> = [
    { value: 'pendente', label: 'Pendente' },
    { value: 'calculado', label: 'Calculado' },
    { value: 'aguardando_pagamento', label: 'Aguardando Pagamento' },
    { value: 'pago', label: 'Pago' },
];

const statusLabels = statusOptions.reduce(
    (acc, option) => ({ ...acc, [option.value]: option.label }),
    {} as Record<FreightDisplacementStatus, string>,
);

function toFormData(item: FreightDisplacement): DisplacementFormData {
    return {
        data: item.data.slice(0, 10),
        descricao: item.descricao,
        unidade_veiculos_id: String(item.unidade_veiculos_id),
        quantidade_caminhoes: formatEditableIntegerBR(
            item.quantidade_caminhoes,
        ),
        placas: item.placas ?? '',
        origem: item.origem,
        destino: item.destino,
        km_aproximado: formatEditableDecimalBR(item.km_aproximado),
        valor_aproximado: formatEditableMoneyBR(item.valor_aproximado),
        unidade_pagadora_id: String(item.unidade_pagadora_id),
        status: item.status,
    };
}

export default function TransportFreightDisplacementsPage() {
    const [units, setUnits] = useState<FreightUnit[]>([]);
    const [rows, setRows] = useState<FreightDisplacement[]>([]);
    const [form, setForm] = useState<DisplacementFormData>(emptyForm);
    const [activeTab, setActiveTab] = useState<'pending' | 'paid'>('pending');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [dateFilter, setDateFilter] = useState('');
    const [payerUnitFilter, setPayerUnitFilter] = useState('all');
    const [vehicleUnitFilter, setVehicleUnitFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [loadingRows, setLoadingRows] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [deleteCandidate, setDeleteCandidate] =
        useState<FreightDisplacement | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const totalValue = useMemo(
        () =>
            rows.reduce(
                (acc, item) => acc + Number(item.valor_aproximado ?? 0),
                0,
            ),
        [rows],
    );

    async function loadUnits(): Promise<void> {
        setLoading(true);

        try {
            const response =
                await apiGet<WrappedResponse<FreightUnit[]>>(
                    '/registry/unidades',
                );
            setUnits(response.data);
            setForm((previous) => ({
                ...previous,
                unidade_veiculos_id:
                    previous.unidade_veiculos_id ||
                    String(response.data[0]?.id ?? ''),
                unidade_pagadora_id:
                    previous.unidade_pagadora_id ||
                    String(response.data[0]?.id ?? ''),
            }));
        } catch {
            setNotification({
                message: 'Não foi possível carregar as unidades.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    const loadRows = useCallback(async (): Promise<void> => {
        setLoadingRows(true);

        const params = new URLSearchParams();
        params.set('tab', activeTab);
        params.set('per_page', '200');

        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (dateFilter) params.set('data', dateFilter);
        if (payerUnitFilter !== 'all') {
            params.set('unidade_pagadora_id', payerUnitFilter);
        }
        if (vehicleUnitFilter !== 'all') {
            params.set('unidade_veiculos_id', vehicleUnitFilter);
        }

        try {
            const response = await apiGet<
                PaginatedResponse<FreightDisplacement>
            >(`/freight/displacements?${params.toString()}`);
            setRows(response.data);
        } catch {
            setNotification({
                message: 'Não foi possível carregar os deslocamentos.',
                variant: 'error',
            });
        } finally {
            setLoadingRows(false);
        }
    }, [
        activeTab,
        statusFilter,
        dateFilter,
        payerUnitFilter,
        vehicleUnitFilter,
    ]);

    useEffect(() => {
        void loadUnits();
    }, []);

    useEffect(() => {
        void loadRows();
    }, [loadRows]);

    function validateForm(): boolean {
        if (
            !form.data ||
            !form.descricao.trim() ||
            !form.unidade_veiculos_id ||
            !form.origem.trim() ||
            !form.destino.trim() ||
            !form.unidade_pagadora_id
        ) {
            setNotification({
                message:
                    'Preencha data, descrição, unidades, origem e destino.',
                variant: 'info',
            });
            return false;
        }

        return true;
    }

    async function handleSubmit(): Promise<void> {
        if (!validateForm()) return;

        setSaving(true);
        setNotification(null);

        const payload = {
            data: form.data,
            descricao: form.descricao.trim(),
            unidade_veiculos_id: Number(form.unidade_veiculos_id),
            quantidade_caminhoes: Math.round(
                toNumberSafe(form.quantidade_caminhoes),
            ),
            placas: form.placas.trim() || null,
            origem: form.origem.trim(),
            destino: form.destino.trim(),
            km_aproximado: toNumberSafe(form.km_aproximado),
            valor_aproximado: toNumberSafe(form.valor_aproximado),
            unidade_pagadora_id: Number(form.unidade_pagadora_id),
            status: form.status,
        };

        try {
            if (editingId) {
                await apiPut(`/freight/displacements/${editingId}`, payload);
            } else {
                await apiPost('/freight/displacements', payload);
            }

            setNotification({
                message: editingId
                    ? 'Deslocamento atualizado com sucesso.'
                    : 'Deslocamento cadastrado com sucesso.',
                variant: 'success',
            });
            setForm((previous) => ({
                ...emptyForm,
                unidade_veiculos_id: previous.unidade_veiculos_id,
                unidade_pagadora_id: previous.unidade_pagadora_id,
            }));
            setEditingId(null);
            await loadRows();
        } catch (error) {
            setNotification({
                message:
                    error instanceof ApiError
                        ? error.message
                        : 'Não foi possível salvar o deslocamento.',
                variant: 'error',
            });
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(): Promise<void> {
        if (!deleteCandidate) return;

        setDeleting(true);

        try {
            await apiDelete(`/freight/displacements/${deleteCandidate.id}`);
            setNotification({
                message: 'Deslocamento removido com sucesso.',
                variant: 'success',
            });
            setDeleteCandidate(null);
            await loadRows();
        } catch (error) {
            setNotification({
                message:
                    error instanceof ApiError
                        ? error.message
                        : 'Não foi possível remover o deslocamento.',
                variant: 'error',
            });
        } finally {
            setDeleting(false);
        }
    }

    return (
        <AdminLayout
            title="Deslocamentos e Pendências"
            active="freight-displacements"
            module="freight"
        >
            {notification ? (
                <Notification
                    message={notification.message}
                    variant={notification.variant}
                    onClose={() => setNotification(null)}
                />
            ) : null}

            <div className="space-y-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">
                            Deslocamentos e Outras Pendências
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Controle deslocamentos, pendências e valores que,
                            quando pagos, entram no frete SPOT da data.
                        </p>
                    </div>
                    <div className="rounded-md border px-3 py-2 text-sm">
                        <span className="text-muted-foreground">
                            Total filtrado:{' '}
                        </span>
                        <strong>{formatCurrencyBR(totalValue)}</strong>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {editingId
                                ? 'Editar deslocamento'
                                : 'Cadastrar deslocamento'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2">
                            <Label>Data</Label>
                            <Input
                                type="date"
                                value={form.data}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        data: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="space-y-2 xl:col-span-2">
                            <Label>Descrição</Label>
                            <Input
                                value={form.descricao}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        descricao: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={form.status}
                                onValueChange={(value) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        status: value as FreightDisplacementStatus,
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {statusOptions.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Veículos de que unidade</Label>
                            <Select
                                value={form.unidade_veiculos_id}
                                onValueChange={(value) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        unidade_veiculos_id: value,
                                    }))
                                }
                                disabled={loading}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
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
                        <div className="space-y-2">
                            <Label>Quantidade de caminhões</Label>
                            <Input
                                value={form.quantidade_caminhoes}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        quantidade_caminhoes:
                                            event.target.value.replace(
                                                /\D/g,
                                                '',
                                            ),
                                    }))
                                }
                            />
                        </div>
                        <div className="space-y-2 xl:col-span-2">
                            <Label>Placas</Label>
                            <Input
                                value={form.placas}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        placas: event.target.value.toUpperCase(),
                                    }))
                                }
                                placeholder="ABC1D23, DEF4G56"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Origem</Label>
                            <Input
                                value={form.origem}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        origem: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Destino</Label>
                            <Input
                                value={form.destino}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        destino: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>KM Aproximado</Label>
                            <Input
                                value={form.km_aproximado}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        km_aproximado: decimalThousandsMaskBR(
                                            event.target.value,
                                        ),
                                    }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Valor Aproximado</Label>
                            <Input
                                value={form.valor_aproximado}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        valor_aproximado: moneyMaskBR(
                                            event.target.value,
                                        ),
                                    }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Unidade Pagadora</Label>
                            <Select
                                value={form.unidade_pagadora_id}
                                onValueChange={(value) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        unidade_pagadora_id: value,
                                    }))
                                }
                                disabled={loading}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
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
                        <div className="flex items-end gap-2 xl:col-span-4">
                            <Button
                                type="button"
                                onClick={() => void handleSubmit()}
                                disabled={saving}
                            >
                                {saving ? (
                                    <LoaderCircle className="mr-2 size-4 animate-spin" />
                                ) : null}
                                {editingId ? 'Salvar alterações' : 'Cadastrar'}
                            </Button>
                            {editingId ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setEditingId(null);
                                        setForm(emptyForm);
                                    }}
                                >
                                    Cancelar edição
                                </Button>
                            ) : null}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-4">
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={
                                        activeTab === 'pending'
                                            ? 'default'
                                            : 'outline'
                                    }
                                    onClick={() => setActiveTab('pending')}
                                >
                                    Pendentes
                                </Button>
                                <Button
                                    type="button"
                                    variant={
                                        activeTab === 'paid'
                                            ? 'default'
                                            : 'outline'
                                    }
                                    onClick={() => setActiveTab('paid')}
                                >
                                    Pagos
                                </Button>
                            </div>
                            <div className="grid gap-3 md:grid-cols-4">
                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <Select
                                        value={statusFilter}
                                        onValueChange={setStatusFilter}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">
                                                Todos
                                            </SelectItem>
                                            {statusOptions.map((option) => (
                                                <SelectItem
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Data</Label>
                                    <Input
                                        type="date"
                                        value={dateFilter}
                                        onChange={(event) =>
                                            setDateFilter(event.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Unidade pagadora</Label>
                                    <Select
                                        value={payerUnitFilter}
                                        onValueChange={setPayerUnitFilter}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">
                                                Todas
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
                                <div className="space-y-2">
                                    <Label>Unidade dos veículos</Label>
                                    <Select
                                        value={vehicleUnitFilter}
                                        onValueChange={setVehicleUnitFilter}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">
                                                Todas
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
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="min-w-full text-sm">
                                <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                                    <tr>
                                        <th className="px-3 py-3 text-left">
                                            Data
                                        </th>
                                        <th className="px-3 py-3 text-left">
                                            Descrição
                                        </th>
                                        <th className="px-3 py-3 text-left">
                                            Veículos
                                        </th>
                                        <th className="px-3 py-3 text-left">
                                            Origem/Destino
                                        </th>
                                        <th className="px-3 py-3 text-right">
                                            KM
                                        </th>
                                        <th className="px-3 py-3 text-right">
                                            Valor
                                        </th>
                                        <th className="px-3 py-3 text-left">
                                            Pagadora
                                        </th>
                                        <th className="px-3 py-3 text-left">
                                            Status
                                        </th>
                                        <th className="px-3 py-3 text-right">
                                            Ações
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingRows ? (
                                        <tr>
                                            <td
                                                colSpan={9}
                                                className="px-3 py-8 text-center text-muted-foreground"
                                            >
                                                Carregando deslocamentos...
                                            </td>
                                        </tr>
                                    ) : null}
                                    {!loadingRows && rows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={9}
                                                className="px-3 py-8 text-center text-muted-foreground"
                                            >
                                                Nenhum deslocamento encontrado.
                                            </td>
                                        </tr>
                                    ) : null}
                                    {!loadingRows
                                        ? rows.map((item) => (
                                              <tr
                                                  key={item.id}
                                                  className="border-t"
                                              >
                                                  <td className="px-3 py-3">
                                                      {formatDateBR(item.data)}
                                                  </td>
                                                  <td className="max-w-[320px] px-3 py-3">
                                                      <div className="font-medium">
                                                          {item.descricao}
                                                      </div>
                                                      {item.placas ? (
                                                          <div className="text-xs text-muted-foreground">
                                                              {item.placas}
                                                          </div>
                                                      ) : null}
                                                  </td>
                                                  <td className="px-3 py-3">
                                                      <div>
                                                          {item.unidade_veiculos
                                                              ?.nome ?? '-'}
                                                      </div>
                                                      <div className="text-xs text-muted-foreground">
                                                          {
                                                              item.quantidade_caminhoes
                                                          }{' '}
                                                          caminhão(ões)
                                                      </div>
                                                  </td>
                                                  <td className="px-3 py-3">
                                                      {item.origem} →{' '}
                                                      {item.destino}
                                                  </td>
                                                  <td className="px-3 py-3 text-right">
                                                      {formatEditableDecimalBR(
                                                          item.km_aproximado,
                                                      )}
                                                  </td>
                                                  <td className="px-3 py-3 text-right font-medium">
                                                      {formatCurrencyBR(
                                                          item.valor_aproximado,
                                                      )}
                                                  </td>
                                                  <td className="px-3 py-3">
                                                      {item.unidade_pagadora
                                                          ?.nome ?? '-'}
                                                  </td>
                                                  <td className="px-3 py-3">
                                                      <div className="inline-flex rounded-full border px-2 py-1 text-xs font-medium">
                                                          {
                                                              statusLabels[
                                                                  item.status
                                                              ]
                                                          }
                                                      </div>
                                                      {item.freight_spot_entry_id ? (
                                                          <div className="mt-1 text-xs text-emerald-700">
                                                              SPOT vinculado #
                                                              {
                                                                  item.freight_spot_entry_id
                                                              }
                                                          </div>
                                                      ) : null}
                                                  </td>
                                                  <td className="px-3 py-3 text-right">
                                                      <div className="flex justify-end gap-2">
                                                          <Button
                                                              type="button"
                                                              size="icon"
                                                              variant="outline"
                                                              onClick={() => {
                                                                  setEditingId(
                                                                      item.id,
                                                                  );
                                                                  setForm(
                                                                      toFormData(
                                                                          item,
                                                                      ),
                                                                  );
                                                                  window.scrollTo(
                                                                      {
                                                                          top: 0,
                                                                          behavior:
                                                                              'smooth',
                                                                      },
                                                                  );
                                                              }}
                                                          >
                                                              <Pencil className="size-4" />
                                                          </Button>
                                                          <Button
                                                              type="button"
                                                              size="icon"
                                                              variant="destructive"
                                                              onClick={() =>
                                                                  setDeleteCandidate(
                                                                      item,
                                                                  )
                                                              }
                                                          >
                                                              <Trash2 className="size-4" />
                                                          </Button>
                                                      </div>
                                                  </td>
                                              </tr>
                                          ))
                                        : null}
                                </tbody>
                            </table>
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
                        <DialogTitle>Remover deslocamento</DialogTitle>
                        <DialogDescription>
                            Se este item estiver pago, o frete SPOT vinculado
                            também será removido.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeleteCandidate(null)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={deleting}
                            onClick={() => void handleDelete()}
                        >
                            {deleting ? (
                                <LoaderCircle className="mr-2 size-4 animate-spin" />
                            ) : null}
                            Remover
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
