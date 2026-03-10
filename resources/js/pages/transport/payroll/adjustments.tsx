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

interface Colaborador {
    id: number;
    nome: string;
}

interface Desconto {
    id: number;
    colaborador_id: number;
    descricao: string;
    tipo_saida: 'extras' | 'salario' | 'beneficios' | 'direto';
    forma_pagamento: 'dinheiro' | 'pix' | 'desconto_folha';
    valor: string;
    parcelado: boolean;
    total_parcelas: number | null;
    parcela_atual: number | null;
    data_referencia: string | null;
    colaborador?: { nome: string };
}

interface Emprestimo {
    id: number;
    colaborador_id: number;
    descricao: string;
    valor_total: string;
    valor_parcela: string;
    total_parcelas: number;
    parcelas_pagas: number;
    data_inicio: string;
    ativo: boolean;
    colaborador?: { nome: string };
}

interface WrappedResponse<T> {
    data: T;
}

interface PaginatedResponse<T> {
    data: T[];
}

interface DescontoForm {
    colaborador_id: string;
    descricao: string;
    tipo_saida: 'extras' | 'salario' | 'beneficios' | 'direto';
    forma_pagamento: 'dinheiro' | 'pix' | 'desconto_folha';
    valor: string;
    parcelado: boolean;
    total_parcelas: string;
    parcela_atual: string;
    data_referencia: string;
}

interface EmprestimoForm {
    colaborador_id: string;
    descricao: string;
    valor_total: string;
    valor_parcela: string;
    total_parcelas: string;
    parcelas_pagas: string;
    data_inicio: string;
    ativo: boolean;
}

const emptyDesconto: DescontoForm = {
    colaborador_id: '',
    descricao: '',
    tipo_saida: 'extras' as const,
    forma_pagamento: 'desconto_folha' as const,
    valor: '',
    parcelado: false,
    total_parcelas: '2',
    parcela_atual: '1',
    data_referencia: new Date().toISOString().slice(0, 10),
};

const emptyEmprestimo: EmprestimoForm = {
    colaborador_id: '',
    descricao: '',
    valor_total: '',
    valor_parcela: '',
    total_parcelas: '1',
    parcelas_pagas: '0',
    data_inicio: new Date().toISOString().slice(0, 10),
    ativo: true,
};

function formatCurrency(value: string | number): string {
    const numeric = typeof value === 'string' ? Number(value) : value;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(Number.isFinite(numeric) ? numeric : 0);
}

export default function TransportPayrollAdjustmentsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
    const [descontos, setDescontos] = useState<Desconto[]>([]);
    const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([]);

    const [descontoOpen, setDescontoOpen] = useState(false);
    const [emprestimoOpen, setEmprestimoOpen] = useState(false);

    const [editingDesconto, setEditingDesconto] = useState<Desconto | null>(null);
    const [editingEmprestimo, setEditingEmprestimo] = useState<Emprestimo | null>(null);

    const [descontoForm, setDescontoForm] = useState<DescontoForm>(emptyDesconto);
    const [emprestimoForm, setEmprestimoForm] = useState<EmprestimoForm>(emptyEmprestimo);

    const collaboratorMap = useMemo(() => {
        return new Map(colaboradores.map((item) => [String(item.id), item.nome]));
    }, [colaboradores]);

    async function load(): Promise<void> {
        setLoading(true);
        setNotification(null);

        try {
            const [c, d, e] = await Promise.all([
                apiGet<PaginatedResponse<Colaborador>>('/registry/colaboradores?active=1&per_page=400'),
                apiGet<WrappedResponse<Desconto[]>>('/payroll/descontos'),
                apiGet<WrappedResponse<Emprestimo[]>>('/payroll/emprestimos'),
            ]);

            setColaboradores(c.data);
            setDescontos(d.data);
            setEmprestimos(e.data);
        } catch {
            setNotification({
                message: 'Não foi possível carregar descontos e empréstimos.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    function openNewDesconto(): void {
        setEditingDesconto(null);
        setDescontoForm(emptyDesconto);
        setDescontoOpen(true);
    }

    function openEditDesconto(item: Desconto): void {
        setEditingDesconto(item);
        setDescontoForm({
            colaborador_id: String(item.colaborador_id),
            descricao: item.descricao,
            tipo_saida: item.tipo_saida,
            forma_pagamento: item.forma_pagamento,
            valor: String(item.valor),
            parcelado: item.parcelado,
            total_parcelas: String(item.total_parcelas ?? 2),
            parcela_atual: String(item.parcela_atual ?? 1),
            data_referencia: item.data_referencia?.slice(0, 10) ?? '',
        });
        setDescontoOpen(true);
    }

    function openNewEmprestimo(): void {
        setEditingEmprestimo(null);
        setEmprestimoForm(emptyEmprestimo);
        setEmprestimoOpen(true);
    }

    function openEditEmprestimo(item: Emprestimo): void {
        setEditingEmprestimo(item);
        setEmprestimoForm({
            colaborador_id: String(item.colaborador_id),
            descricao: item.descricao,
            valor_total: String(item.valor_total),
            valor_parcela: String(item.valor_parcela),
            total_parcelas: String(item.total_parcelas),
            parcelas_pagas: String(item.parcelas_pagas),
            data_inicio: item.data_inicio.slice(0, 10),
            ativo: item.ativo,
        });
        setEmprestimoOpen(true);
    }

    async function saveDesconto(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setSaving(true);
        setNotification(null);

        const payload = {
            colaborador_id: Number(descontoForm.colaborador_id),
            descricao: descontoForm.descricao.trim(),
            tipo_saida: descontoForm.tipo_saida,
            forma_pagamento: descontoForm.forma_pagamento,
            valor: descontoForm.valor,
            parcelado: descontoForm.parcelado,
            total_parcelas: descontoForm.parcelado ? Number(descontoForm.total_parcelas) : null,
            parcela_atual: descontoForm.parcelado ? Number(descontoForm.parcela_atual) : null,
            data_referencia: descontoForm.data_referencia || null,
        };

        try {
            if (editingDesconto) {
                await apiPut(`/payroll/descontos/${editingDesconto.id}`, payload);
            } else {
                await apiPost('/payroll/descontos', payload);
            }

            setDescontoOpen(false);
            setEditingDesconto(null);
            setDescontoForm(emptyDesconto);
            setNotification({
                message: editingDesconto
                    ? 'Desconto atualizado com sucesso.'
                    : 'Desconto cadastrado com sucesso.',
                variant: 'success',
            });
            await load();
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
                    message: 'Não foi possível salvar o desconto.',
                    variant: 'error',
                });
            }
        } finally {
            setSaving(false);
        }
    }

    async function saveEmprestimo(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setSaving(true);
        setNotification(null);

        const payload = {
            colaborador_id: Number(emprestimoForm.colaborador_id),
            descricao: emprestimoForm.descricao.trim(),
            valor_total: emprestimoForm.valor_total,
            valor_parcela: emprestimoForm.valor_parcela,
            total_parcelas: Number(emprestimoForm.total_parcelas),
            parcelas_pagas: Number(emprestimoForm.parcelas_pagas),
            data_inicio: emprestimoForm.data_inicio,
            ativo: emprestimoForm.ativo,
        };

        try {
            if (editingEmprestimo) {
                await apiPut(`/payroll/emprestimos/${editingEmprestimo.id}`, payload);
            } else {
                await apiPost('/payroll/emprestimos', payload);
            }

            setEmprestimoOpen(false);
            setEditingEmprestimo(null);
            setEmprestimoForm(emptyEmprestimo);
            setNotification({
                message: editingEmprestimo
                    ? 'Empréstimo atualizado com sucesso.'
                    : 'Empréstimo cadastrado com sucesso.',
                variant: 'success',
            });
            await load();
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
                    message: 'Não foi possível salvar o empréstimo.',
                    variant: 'error',
                });
            }
        } finally {
            setSaving(false);
        }
    }

    async function removeDesconto(id: number): Promise<void> {
        setDeletingId(id);
        try {
            await apiDelete(`/payroll/descontos/${id}`);
            setNotification({ message: 'Desconto excluído com sucesso.', variant: 'success' });
            await load();
        } catch {
            setNotification({ message: 'Não foi possível excluir o desconto.', variant: 'error' });
        } finally {
            setDeletingId(null);
        }
    }

    async function removeEmprestimo(id: number): Promise<void> {
        setDeletingId(id);
        try {
            await apiDelete(`/payroll/emprestimos/${id}`);
            setNotification({ message: 'Empréstimo excluído com sucesso.', variant: 'success' });
            await load();
        } catch {
            setNotification({ message: 'Não foi possível excluir o empréstimo.', variant: 'error' });
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <AdminLayout
            title="Pagamentos - Descontos e Empréstimos"
            active="payroll-adjustments"
            module="payroll"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Descontos e Empréstimos</h2>
                    <p className="text-sm text-muted-foreground">
                        Cadastre saídas e empréstimos para refletir corretamente no ganho do colaborador.
                    </p>
                </div>

                {notification ? (
                    <Notification message={notification.message} variant={notification.variant} />
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Descontos ({descontos.length})</CardTitle>
                            <Button type="button" size="sm" onClick={openNewDesconto}>
                                <PlusSquare className="size-4" />
                                Novo desconto
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Carregando...
                                </div>
                            ) : descontos.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Nenhum desconto cadastrado.</p>
                            ) : (
                                <div className="space-y-2">
                                    {descontos.map((item) => (
                                        <div key={item.id} className="rounded-md border p-3 text-sm">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="font-medium">{item.descricao}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.colaborador?.nome ?? collaboratorMap.get(String(item.colaborador_id)) ?? '-'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.tipo_saida} | {formatCurrency(item.valor)}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => openEditDesconto(item)}>
                                                        <PencilLine className="size-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        disabled={deletingId === item.id}
                                                        onClick={() => void removeDesconto(item.id)}
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Empréstimos ({emprestimos.length})</CardTitle>
                            <Button type="button" size="sm" onClick={openNewEmprestimo}>
                                <PlusSquare className="size-4" />
                                Novo empréstimo
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Carregando...
                                </div>
                            ) : emprestimos.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Nenhum empréstimo cadastrado.</p>
                            ) : (
                                <div className="space-y-2">
                                    {emprestimos.map((item) => (
                                        <div key={item.id} className="rounded-md border p-3 text-sm">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="font-medium">{item.descricao}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.colaborador?.nome ?? collaboratorMap.get(String(item.colaborador_id)) ?? '-'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatCurrency(item.valor_total)} total | {formatCurrency(item.valor_parcela)} parcela
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => openEditEmprestimo(item)}>
                                                        <PencilLine className="size-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        disabled={deletingId === item.id}
                                                        onClick={() => void removeEmprestimo(item.id)}
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={descontoOpen} onOpenChange={setDescontoOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingDesconto ? 'Editar desconto' : 'Novo desconto'}
                        </DialogTitle>
                        <DialogDescription>
                            Registre saídas de extras, salário, benefícios ou direto.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-3" onSubmit={saveDesconto}>
                        <div className="space-y-2">
                            <Label>Colaborador *</Label>
                            <Select
                                value={descontoForm.colaborador_id}
                                onValueChange={(value) =>
                                    setDescontoForm((previous) => ({ ...previous, colaborador_id: value }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {colaboradores.map((item) => (
                                        <SelectItem key={item.id} value={String(item.id)}>
                                            {item.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="desc-desconto">Descrição *</Label>
                            <Input
                                id="desc-desconto"
                                value={descontoForm.descricao}
                                onChange={(event) =>
                                    setDescontoForm((previous) => ({
                                        ...previous,
                                        descricao: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Tipo da saída *</Label>
                                <Select
                                    value={descontoForm.tipo_saida}
                                    onValueChange={(value: typeof descontoForm.tipo_saida) =>
                                        setDescontoForm((previous) => ({ ...previous, tipo_saida: value }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="extras">Extras</SelectItem>
                                        <SelectItem value="salario">Salário</SelectItem>
                                        <SelectItem value="beneficios">Benefícios</SelectItem>
                                        <SelectItem value="direto">Direto</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Forma de pagamento *</Label>
                                <Select
                                    value={descontoForm.forma_pagamento}
                                    onValueChange={(value: typeof descontoForm.forma_pagamento) =>
                                        setDescontoForm((previous) => ({ ...previous, forma_pagamento: value }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="desconto_folha">Desconto em folha</SelectItem>
                                        <SelectItem value="pix">PIX</SelectItem>
                                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="valor-desconto">Valor *</Label>
                                <Input
                                    id="valor-desconto"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={descontoForm.valor}
                                    onChange={(event) =>
                                        setDescontoForm((previous) => ({
                                            ...previous,
                                            valor: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="data-desconto">Data de referência</Label>
                                <Input
                                    id="data-desconto"
                                    type="date"
                                    value={descontoForm.data_referencia}
                                    onChange={(event) =>
                                        setDescontoForm((previous) => ({
                                            ...previous,
                                            data_referencia: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label>Parcelado</Label>
                                <Select
                                    value={descontoForm.parcelado ? '1' : '0'}
                                    onValueChange={(value) =>
                                        setDescontoForm((previous) => ({
                                            ...previous,
                                            parcelado: value === '1',
                                        }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">Não</SelectItem>
                                        <SelectItem value="1">Sim</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="parcelas-desconto">Qtd parcelas</Label>
                                <Input
                                    id="parcelas-desconto"
                                    type="number"
                                    min="1"
                                    value={descontoForm.total_parcelas}
                                    onChange={(event) =>
                                        setDescontoForm((previous) => ({
                                            ...previous,
                                            total_parcelas: event.target.value,
                                        }))
                                    }
                                    disabled={!descontoForm.parcelado}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="parcela-atual-desconto">Parcela atual</Label>
                                <Input
                                    id="parcela-atual-desconto"
                                    type="number"
                                    min="1"
                                    value={descontoForm.parcela_atual}
                                    onChange={(event) =>
                                        setDescontoForm((previous) => ({
                                            ...previous,
                                            parcela_atual: event.target.value,
                                        }))
                                    }
                                    disabled={!descontoForm.parcelado}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDescontoOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={saving || !descontoForm.colaborador_id || !descontoForm.descricao.trim()}
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

            <Dialog open={emprestimoOpen} onOpenChange={setEmprestimoOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingEmprestimo ? 'Editar empréstimo' : 'Novo empréstimo'}
                        </DialogTitle>
                        <DialogDescription>
                            Informe valor da parcela para refletir no ganho mensal do colaborador.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-3" onSubmit={saveEmprestimo}>
                        <div className="space-y-2">
                            <Label>Colaborador *</Label>
                            <Select
                                value={emprestimoForm.colaborador_id}
                                onValueChange={(value) =>
                                    setEmprestimoForm((previous) => ({ ...previous, colaborador_id: value }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {colaboradores.map((item) => (
                                        <SelectItem key={item.id} value={String(item.id)}>
                                            {item.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="desc-emprestimo">Descrição *</Label>
                            <Input
                                id="desc-emprestimo"
                                value={emprestimoForm.descricao}
                                onChange={(event) =>
                                    setEmprestimoForm((previous) => ({
                                        ...previous,
                                        descricao: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="valor-total">Valor total *</Label>
                                <Input
                                    id="valor-total"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={emprestimoForm.valor_total}
                                    onChange={(event) =>
                                        setEmprestimoForm((previous) => ({
                                            ...previous,
                                            valor_total: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="valor-parcela">Valor parcela *</Label>
                                <Input
                                    id="valor-parcela"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={emprestimoForm.valor_parcela}
                                    onChange={(event) =>
                                        setEmprestimoForm((previous) => ({
                                            ...previous,
                                            valor_parcela: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="total-parcelas">Total de parcelas *</Label>
                                <Input
                                    id="total-parcelas"
                                    type="number"
                                    min="1"
                                    value={emprestimoForm.total_parcelas}
                                    onChange={(event) =>
                                        setEmprestimoForm((previous) => ({
                                            ...previous,
                                            total_parcelas: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="parcelas-pagas">Parcelas pagas</Label>
                                <Input
                                    id="parcelas-pagas"
                                    type="number"
                                    min="0"
                                    value={emprestimoForm.parcelas_pagas}
                                    onChange={(event) =>
                                        setEmprestimoForm((previous) => ({
                                            ...previous,
                                            parcelas_pagas: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="data-inicio">Data início *</Label>
                                <Input
                                    id="data-inicio"
                                    type="date"
                                    value={emprestimoForm.data_inicio}
                                    onChange={(event) =>
                                        setEmprestimoForm((previous) => ({
                                            ...previous,
                                            data_inicio: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Ativo</Label>
                            <Select
                                value={emprestimoForm.ativo ? '1' : '0'}
                                onValueChange={(value) =>
                                    setEmprestimoForm((previous) => ({
                                        ...previous,
                                        ativo: value === '1',
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Sim</SelectItem>
                                    <SelectItem value="0">Não</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEmprestimoOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={saving || !emprestimoForm.colaborador_id || !emprestimoForm.descricao.trim()}
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
