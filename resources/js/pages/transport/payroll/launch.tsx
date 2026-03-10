import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ApiError, apiGet, apiPost } from '@/lib/api-client';

interface Unidade {
    id: number;
    nome: string;
}

interface LaunchCandidate {
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
}

interface LaunchResponse {
    data_pagamento: string;
    data: LaunchCandidate[];
}

interface WrappedResponse<T> {
    data: T;
}

interface TipoPagamento {
    id: number;
    nome: string;
    gera_encargos: boolean;
    categoria: 'salario' | 'beneficios' | 'extras';
    forma_pagamento: 'deposito' | 'cartao_vr' | 'cartao_va' | 'dinheiro';
}

function formatCurrency(value: number | string): string {
    const numeric = typeof value === 'string' ? Number(value) : value;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(Number.isFinite(numeric) ? numeric : 0);
}

export default function TransportPayrollLaunchPage() {
    const [descricao, setDescricao] = useState('');
    const [dataPagamento, setDataPagamento] = useState(
        new Date().toISOString().slice(0, 10),
    );
    const [unidadeId, setUnidadeId] = useState('');

    const [unidades, setUnidades] = useState<Unidade[]>([]);
    const [tiposPagamento, setTiposPagamento] = useState<TipoPagamento[]>([]);
    const [selectedTipoIds, setSelectedTipoIds] = useState<number[]>([]);
    const [candidates, setCandidates] = useState<LaunchCandidate[]>([]);
    const [selectedCollaborators, setSelectedCollaborators] = useState<
        Record<number, boolean>
    >({});
    const [values, setValues] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [loadingCandidates, setLoadingCandidates] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const selectedTipos = useMemo(
        () =>
            tiposPagamento.filter((tipo) => selectedTipoIds.includes(tipo.id)),
        [selectedTipoIds, tiposPagamento],
    );

    const allChecked =
        candidates.length > 0 &&
        candidates.every((candidate) => selectedCollaborators[candidate.id]);

    async function loadUnidades(): Promise<void> {
        setLoading(true);
        try {
            const [unidadesResponse, tiposResponse] = await Promise.all([
                apiGet<WrappedResponse<Unidade[]>>('/registry/unidades'),
                apiGet<WrappedResponse<TipoPagamento[]>>('/registry/tipos-pagamento'),
            ]);

            const response = unidadesResponse;
            setUnidades(response.data);
            setTiposPagamento(tiposResponse.data);
            if (!unidadeId && response.data.length > 0) {
                setUnidadeId(String(response.data[0].id));
            }
        } catch {
            setNotification({
                message: 'Não foi possível carregar as unidades.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    async function loadCandidates(): Promise<void> {
        if (!unidadeId || selectedTipoIds.length === 0 || !dataPagamento) {
            setCandidates([]);
            setSelectedCollaborators({});
            setValues({});
            return;
        }

        setLoadingCandidates(true);
        setNotification(null);

        try {
            const params = new URLSearchParams();
            params.set('unidade_id', unidadeId);
            params.set('descricao', descricao.trim());
            params.set('data_pagamento', dataPagamento);
            selectedTipoIds.forEach((id) => {
                params.append('tipo_pagamento_ids[]', String(id));
            });

            const response = await apiGet<LaunchResponse>(
                `/payroll/launch-candidates?${params.toString()}`,
            );
            setCandidates(response.data);
            setSelectedCollaborators({});
            setValues({});
        } catch {
            setNotification({
                message:
                    'Não foi possível carregar os colaboradores da unidade.',
                variant: 'error',
            });
        } finally {
            setLoadingCandidates(false);
        }
    }

    useEffect(() => {
        loadUnidades();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (unidadeId && selectedTipoIds.length > 0 && dataPagamento) {
            void loadCandidates();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unidadeId, dataPagamento]);

    function toggleTipo(tipoId: number, checked: boolean): void {
        setSelectedTipoIds((previous) => {
            if (checked) {
                if (previous.includes(tipoId)) return previous;
                return [...previous, tipoId];
            }

            return previous.filter((id) => id !== tipoId);
        });
    }

    function setAllCollaborators(checked: boolean): void {
        const next: Record<number, boolean> = {};
        candidates.forEach((candidate) => {
            next[candidate.id] = checked;
        });
        setSelectedCollaborators(next);
    }

    function setCollaboratorSelected(id: number, checked: boolean): void {
        setSelectedCollaborators((previous) => ({
            ...previous,
            [id]: checked,
        }));
    }

    function valueKey(colaboradorId: number, tipoId: number): string {
        return `${colaboradorId}:${tipoId}`;
    }

    function setValue(colaboradorId: number, tipoId: number, value: string): void {
        setValues((previous) => ({
            ...previous,
            [valueKey(colaboradorId, tipoId)]: value,
        }));
    }

    async function handleLaunch(): Promise<void> {
        const pagamentos = candidates.map((item) => {
            const valoresPorTipo: Record<string, string> = {};

            selectedTipoIds.forEach((tipoId) => {
                valoresPorTipo[String(tipoId)] =
                    values[valueKey(item.id, tipoId)] ?? '0';
            });

            return {
                colaborador_id: item.id,
                selected: Boolean(selectedCollaborators[item.id]),
                valores_por_tipo: valoresPorTipo,
            };
        });

        const selectedWithPositive = pagamentos.filter((item) => {
            if (!item.selected) return false;

            return Object.values(item.valores_por_tipo).some(
                (value) => Number(value) > 0,
            );
        });

        if (selectedWithPositive.length === 0) {
            setNotification({
                message: 'Selecione colaboradores e informe ao menos um valor por tipo.',
                variant: 'info',
            });
            return;
        }

        setSaving(true);
        setNotification(null);

        try {
            const response = await apiPost<{ created_count: number }>(
                '/payroll/launch-batch',
                {
                    unidade_id: Number(unidadeId),
                    descricao: descricao.trim(),
                    data_pagamento: dataPagamento,
                    tipo_pagamento_ids: selectedTipoIds,
                    pagamentos,
                },
            );

            setNotification({
                message: `${response.created_count} pagamento(s) lançado(s) com sucesso.`,
                variant: 'success',
            });
            await loadCandidates();
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
                    message: 'Não foi possível lançar os pagamentos.',
                    variant: 'error',
                });
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminLayout
            title="Pagamentos - Lançar Pagamentos"
            active="payroll-launch"
            module="payroll"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">
                        Lançar Pagamentos
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Informe descrição, unidade, tipos e data para lançar pagamentos em lote.
                    </p>
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
                        <div className="grid gap-3 md:grid-cols-4">
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="descricao">Descrição</Label>
                                <Input
                                    id="descricao"
                                    value={descricao}
                                    onChange={(event) =>
                                        setDescricao(event.target.value)
                                    }
                                    placeholder="Ex.: Pagamento quinzenal"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Unidade</Label>
                                <Select
                                    value={unidadeId}
                                    onValueChange={setUnidadeId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
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
                                <Label htmlFor="data-pagamento">
                                    Data do pagamento
                                </Label>
                                <Input
                                    id="data-pagamento"
                                    type="date"
                                    value={dataPagamento}
                                    onChange={(event) =>
                                        setDataPagamento(event.target.value)
                                    }
                                />
                            </div>
                        </div>

                        <div className="mt-4 space-y-2">
                            <Label>Tipo de pagamento (pode escolher mais de um)</Label>
                            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                                {tiposPagamento.map((tipo) => (
                                    <label
                                        key={tipo.id}
                                        className="flex items-center gap-2 rounded-md border px-3 py-2"
                                    >
                                        <Checkbox
                                            checked={selectedTipoIds.includes(tipo.id)}
                                            onCheckedChange={(checked) =>
                                                toggleTipo(tipo.id, Boolean(checked))
                                            }
                                        />
                                        <span className="text-sm">{tipo.nome}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void loadCandidates()}
                                disabled={!unidadeId || selectedTipoIds.length === 0 || !dataPagamento}
                            >
                                Carregar colaboradores
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Colaboradores Ativos da Unidade</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading || loadingCandidates ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando colaboradores...
                            </div>
                        ) : candidates.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Nenhum colaborador ativo encontrado para os filtros.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                <div className="overflow-x-auto rounded-md border">
                                    <table className="w-full min-w-[760px] text-sm">
                                        <thead className="bg-muted/40">
                                            <tr>
                                                <th className="w-[40px] px-2 py-2 text-left">
                                                    <Checkbox
                                                        checked={allChecked}
                                                        onCheckedChange={(checked) =>
                                                            setAllCollaborators(
                                                                Boolean(checked),
                                                            )
                                                        }
                                                    />
                                                </th>
                                                <th className="px-2 py-2 text-left font-medium">
                                                    Nome
                                                </th>
                                                <th className="px-2 py-2 text-left font-medium">
                                                    Unidade
                                                </th>
                                                {selectedTipos.map((tipo) => (
                                                    <th
                                                        key={tipo.id}
                                                        className="px-2 py-2 text-left font-medium"
                                                    >
                                                        {tipo.nome}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {candidates.map((item) => (
                                                <tr
                                                    key={item.id}
                                                    className="border-t"
                                                >
                                                    <td className="px-2 py-2">
                                                        <Checkbox
                                                            checked={Boolean(
                                                                selectedCollaborators[
                                                                    item.id
                                                                ],
                                                            )}
                                                            onCheckedChange={(
                                                                checked,
                                                            ) =>
                                                                setCollaboratorSelected(
                                                                    item.id,
                                                                    Boolean(
                                                                        checked,
                                                                    ),
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <p className="font-medium">
                                                            {item.nome}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            CPF: {item.cpf}
                                                        </p>
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        {item.unidade?.nome ?? '-'}
                                                    </td>
                                                    {selectedTipos.map((tipo) => {
                                                        const existing =
                                                            item
                                                                .pagamentos_existentes_por_tipo[
                                                                String(tipo.id)
                                                            ];
                                                        const key = valueKey(
                                                            item.id,
                                                            tipo.id,
                                                        );

                                                        return (
                                                            <td
                                                                key={`${item.id}-${tipo.id}`}
                                                                className="px-2 py-2"
                                                            >
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={
                                                                        values[
                                                                            key
                                                                        ] ??
                                                                        ''
                                                                    }
                                                                    onChange={(
                                                                        event,
                                                                    ) =>
                                                                        setValue(
                                                                            item.id,
                                                                            tipo.id,
                                                                            event
                                                                                .target
                                                                                .value,
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        !selectedCollaborators[
                                                                            item
                                                                                .id
                                                                        ] ||
                                                                        Boolean(
                                                                            existing,
                                                                        )
                                                                    }
                                                                    placeholder="0,00"
                                                                />
                                                                {existing ? (
                                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                                        Já lançado: {' '}
                                                                        {formatCurrency(
                                                                            existing.valor,
                                                                        )}
                                                                    </p>
                                                                ) : null}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        onClick={() => void handleLaunch()}
                                        disabled={saving || selectedTipoIds.length === 0}
                                    >
                                        {saving ? (
                                            <>
                                                <LoaderCircle className="size-4 animate-spin" />
                                                Efetuando pagamento...
                                            </>
                                        ) : (
                                            'Efetuar pagamento'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
