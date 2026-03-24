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
import { formatCurrencyBR } from '@/lib/transport-format';

interface Colaborador {
    id: number;
    nome: string;
}

interface Desconto {
    id: number;
    colaborador_id: number;
    descricao: string;
    tipo_saida: 'extras' | 'salario' | 'beneficios' | 'direto';
    tipo_saida_prioridades?: Array<'extras' | 'salario' | 'beneficios'>;
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

interface Pensao {
    id: number;
    colaborador_id: number;
    nome_beneficiaria: string;
    cpf_beneficiaria: string | null;
    nome_banco: string;
    numero_banco: string | null;
    numero_agencia: string;
    tipo_conta: string;
    numero_conta: string;
    tipo_chave_pix: string | null;
    chave_pix: string | null;
    observacao: string | null;
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
    prioridade_1: 'extras' | 'salario' | 'beneficios';
    prioridade_2: 'none' | 'extras' | 'salario' | 'beneficios';
    prioridade_3: 'none' | 'extras' | 'salario' | 'beneficios';
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

interface PensaoForm {
    colaborador_id: string;
    nome_beneficiaria: string;
    cpf_beneficiaria: string;
    nome_banco: string;
    numero_banco: string;
    numero_agencia: string;
    tipo_conta: string;
    numero_conta: string;
    tipo_chave_pix: string;
    chave_pix: string;
    observacao: string;
    ativo: boolean;
}

const emptyDesconto: DescontoForm = {
    colaborador_id: '',
    descricao: '',
    prioridade_1: 'extras' as const,
    prioridade_2: 'none',
    prioridade_3: 'none',
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

const emptyPensao: PensaoForm = {
    colaborador_id: '',
    nome_beneficiaria: '',
    cpf_beneficiaria: '',
    nome_banco: '',
    numero_banco: '',
    numero_agencia: '',
    tipo_conta: '',
    numero_conta: '',
    tipo_chave_pix: '',
    chave_pix: '',
    observacao: '',
    ativo: true,
};

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
    const [pensoes, setPensoes] = useState<Pensao[]>([]);

    const [descontoOpen, setDescontoOpen] = useState(false);
    const [emprestimoOpen, setEmprestimoOpen] = useState(false);
    const [pensaoOpen, setPensaoOpen] = useState(false);

    const [editingDesconto, setEditingDesconto] = useState<Desconto | null>(null);
    const [editingEmprestimo, setEditingEmprestimo] = useState<Emprestimo | null>(null);
    const [editingPensao, setEditingPensao] = useState<Pensao | null>(null);

    const [descontoForm, setDescontoForm] = useState<DescontoForm>(emptyDesconto);
    const [emprestimoForm, setEmprestimoForm] = useState<EmprestimoForm>(emptyEmprestimo);
    const [pensaoForm, setPensaoForm] = useState<PensaoForm>(emptyPensao);
    const [descontoCollaboratorSearch, setDescontoCollaboratorSearch] = useState('');
    const [emprestimoCollaboratorSearch, setEmprestimoCollaboratorSearch] = useState('');
    const [pensaoCollaboratorSearch, setPensaoCollaboratorSearch] = useState('');

    const collaboratorMap = useMemo(() => {
        return new Map(colaboradores.map((item) => [String(item.id), item.nome]));
    }, [colaboradores]);

    const sortedColaboradores = useMemo(() => {
        return [...colaboradores].sort((a, b) =>
            a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
        );
    }, [colaboradores]);

    const filteredPensaoCollaborators = useMemo(() => {
        const term = pensaoCollaboratorSearch.trim().toLowerCase();

        if (!term) return sortedColaboradores;

        return sortedColaboradores.filter((item) => item.nome.toLowerCase().includes(term));
    }, [pensaoCollaboratorSearch, sortedColaboradores]);

    const filteredDescontoCollaborators = useMemo(() => {
        const term = descontoCollaboratorSearch.trim().toLowerCase();

        if (!term) return sortedColaboradores;

        return sortedColaboradores.filter((item) => item.nome.toLowerCase().includes(term));
    }, [descontoCollaboratorSearch, sortedColaboradores]);

    const filteredEmprestimoCollaborators = useMemo(() => {
        const term = emprestimoCollaboratorSearch.trim().toLowerCase();

        if (!term) return sortedColaboradores;

        return sortedColaboradores.filter((item) => item.nome.toLowerCase().includes(term));
    }, [emprestimoCollaboratorSearch, sortedColaboradores]);

    async function load(): Promise<void> {
        setLoading(true);
        setNotification(null);

        try {
            const [c, d, e, p] = await Promise.all([
                apiGet<PaginatedResponse<Colaborador>>('/registry/colaboradores?active=1&per_page=400'),
                apiGet<WrappedResponse<Desconto[]>>('/payroll/descontos'),
                apiGet<WrappedResponse<Emprestimo[]>>('/payroll/emprestimos'),
                apiGet<WrappedResponse<Pensao[]>>('/payroll/pensoes?ativo=1'),
            ]);

            setColaboradores(c.data);
            setDescontos(d.data);
            setEmprestimos(e.data);
            setPensoes(p.data);
        } catch {
            setNotification({
                message: 'Não foi possível carregar descontos, empréstimos e pensões.',
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
        setDescontoCollaboratorSearch('');
        setDescontoOpen(true);
    }

    function openEditDesconto(item: Desconto): void {
        const fallbackPriorities = item.tipo_saida === 'direto'
            ? ['salario', 'beneficios', 'extras'] as const
            : [item.tipo_saida].filter((value): value is 'extras' | 'salario' | 'beneficios' =>
                value === 'extras' || value === 'salario' || value === 'beneficios',
            );

        const priorities = (item.tipo_saida_prioridades && item.tipo_saida_prioridades.length > 0
            ? item.tipo_saida_prioridades
            : fallbackPriorities) as Array<'extras' | 'salario' | 'beneficios'>;

        setEditingDesconto(item);
        setDescontoForm({
            colaborador_id: String(item.colaborador_id),
            descricao: item.descricao,
            prioridade_1: priorities[0] ?? 'extras',
            prioridade_2: priorities[1] ?? 'none',
            prioridade_3: priorities[2] ?? 'none',
            valor: String(item.valor),
            parcelado: item.parcelado,
            total_parcelas: String(item.total_parcelas ?? 2),
            parcela_atual: String(item.parcela_atual ?? 1),
            data_referencia: item.data_referencia?.slice(0, 10) ?? '',
        });
        setDescontoCollaboratorSearch(item.colaborador?.nome ?? collaboratorMap.get(String(item.colaborador_id)) ?? '');
        setDescontoOpen(true);
    }

    function openNewEmprestimo(): void {
        setEditingEmprestimo(null);
        setEmprestimoForm(emptyEmprestimo);
        setEmprestimoCollaboratorSearch('');
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
        setEmprestimoCollaboratorSearch(item.colaborador?.nome ?? collaboratorMap.get(String(item.colaborador_id)) ?? '');
        setEmprestimoOpen(true);
    }

    function openNewPensao(): void {
        setEditingPensao(null);
        setPensaoForm(emptyPensao);
        setPensaoCollaboratorSearch('');
        setPensaoOpen(true);
    }

    function openEditPensao(item: Pensao): void {
        setEditingPensao(item);
        setPensaoForm({
            colaborador_id: String(item.colaborador_id),
            nome_beneficiaria: item.nome_beneficiaria,
            cpf_beneficiaria: item.cpf_beneficiaria ?? '',
            nome_banco: item.nome_banco,
            numero_banco: item.numero_banco ?? '',
            numero_agencia: item.numero_agencia,
            tipo_conta: item.tipo_conta,
            numero_conta: item.numero_conta,
            tipo_chave_pix: item.tipo_chave_pix ?? '',
            chave_pix: item.chave_pix ?? '',
            observacao: item.observacao ?? '',
            ativo: item.ativo,
        });
        setPensaoCollaboratorSearch(item.colaborador?.nome ?? collaboratorMap.get(String(item.colaborador_id)) ?? '');
        setPensaoOpen(true);
    }

    async function saveDesconto(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setSaving(true);
        setNotification(null);

        const priorities = [
            descontoForm.prioridade_1,
            descontoForm.prioridade_2,
            descontoForm.prioridade_3,
        ].filter((value): value is 'extras' | 'salario' | 'beneficios' => value !== 'none');

        const uniquePriorities = Array.from(new Set(priorities));

        const payload = {
            colaborador_id: Number(descontoForm.colaborador_id),
            descricao: descontoForm.descricao.trim(),
            tipo_saida: uniquePriorities[0],
            tipo_saida_prioridades: uniquePriorities,
            forma_pagamento: 'desconto_folha',
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
                message: editingDesconto ? 'Desconto atualizado com sucesso.' : 'Desconto cadastrado com sucesso.',
                variant: 'success',
            });
            await load();
        } catch (error) {
            if (error instanceof ApiError) {
                const firstError = error.errors ? Object.values(error.errors)[0]?.[0] : null;
                setNotification({ message: firstError ?? error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível salvar o desconto.', variant: 'error' });
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
                message: editingEmprestimo ? 'Empréstimo atualizado com sucesso.' : 'Empréstimo cadastrado com sucesso.',
                variant: 'success',
            });
            await load();
        } catch (error) {
            if (error instanceof ApiError) {
                const firstError = error.errors ? Object.values(error.errors)[0]?.[0] : null;
                setNotification({ message: firstError ?? error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível salvar o empréstimo.', variant: 'error' });
            }
        } finally {
            setSaving(false);
        }
    }

    async function savePensao(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setSaving(true);
        setNotification(null);

        const payload = {
            colaborador_id: Number(pensaoForm.colaborador_id),
            nome_beneficiaria: pensaoForm.nome_beneficiaria.trim(),
            cpf_beneficiaria: pensaoForm.cpf_beneficiaria || null,
            nome_banco: pensaoForm.nome_banco.trim(),
            numero_banco: pensaoForm.numero_banco || null,
            numero_agencia: pensaoForm.numero_agencia.trim(),
            tipo_conta: pensaoForm.tipo_conta.trim(),
            numero_conta: pensaoForm.numero_conta.trim(),
            tipo_chave_pix: pensaoForm.tipo_chave_pix || null,
            chave_pix: pensaoForm.chave_pix || null,
            observacao: pensaoForm.observacao || null,
            ativo: pensaoForm.ativo,
        };

        try {
            if (editingPensao) {
                await apiPut(`/payroll/pensoes/${editingPensao.id}`, payload);
            } else {
                await apiPost('/payroll/pensoes', payload);
            }

            setPensaoOpen(false);
            setEditingPensao(null);
            setPensaoForm(emptyPensao);
            setNotification({
                message: editingPensao ? 'Pensão atualizada com sucesso.' : 'Pensão cadastrada com sucesso.',
                variant: 'success',
            });
            await load();
        } catch (error) {
            if (error instanceof ApiError) {
                const firstError = error.errors ? Object.values(error.errors)[0]?.[0] : null;
                setNotification({ message: firstError ?? error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível salvar a pensão.', variant: 'error' });
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

    async function removePensao(id: number): Promise<void> {
        setDeletingId(id);
        try {
            await apiDelete(`/payroll/pensoes/${id}`);
            setNotification({ message: 'Pensão excluída com sucesso.', variant: 'success' });
            await load();
        } catch {
            setNotification({ message: 'Não foi possível excluir a pensão.', variant: 'error' });
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <AdminLayout title="Pagamentos - Descontos" active="payroll-adjustments" module="payroll">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Descontos</h2>
                    <p className="text-sm text-muted-foreground">
                        Cadastre descontos, empréstimos e pensões para refletir corretamente no fechamento da folha.
                    </p>
                </div>

                {notification ? <Notification message={notification.message} variant={notification.variant} /> : null}

                <div className="grid gap-4 lg:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Descontos ({descontos.length})</CardTitle>
                            <Button type="button" size="sm" onClick={openNewDesconto}>
                                <PlusSquare className="size-4" />
                                Novo
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
                                                        {(item.tipo_saida_prioridades && item.tipo_saida_prioridades.length > 0
                                                            ? item.tipo_saida_prioridades.join(' → ')
                                                            : item.tipo_saida)} | {formatCurrencyBR(item.valor)}
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
                                Novo
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
                                                        {formatCurrencyBR(item.valor_total)} total | {formatCurrencyBR(item.valor_parcela)} parcela
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

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Pensões ({pensoes.length})</CardTitle>
                            <Button type="button" size="sm" onClick={openNewPensao}>
                                <PlusSquare className="size-4" />
                                Nova
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Carregando...
                                </div>
                            ) : pensoes.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Nenhuma pensão cadastrada.</p>
                            ) : (
                                <div className="space-y-2">
                                    {pensoes.map((item) => (
                                        <div key={item.id} className="rounded-md border p-3 text-sm">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="font-medium">{item.colaborador?.nome ?? collaboratorMap.get(String(item.colaborador_id)) ?? '-'}</p>
                                                    <p className="text-xs text-muted-foreground">Mãe: {item.nome_beneficiaria}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.nome_banco}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => openEditPensao(item)}>
                                                        <PencilLine className="size-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        disabled={deletingId === item.id}
                                                        onClick={() => void removePensao(item.id)}
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
                        <DialogTitle>{editingDesconto ? 'Editar desconto' : 'Novo desconto'}</DialogTitle>
                        <DialogDescription>Registre descontos por categoria para refletir no fechamento.</DialogDescription>
                    </DialogHeader>
                    <form className="space-y-3" onSubmit={saveDesconto}>
                        <div className="space-y-2">
                            <Label>Colaborador *</Label>
                            <Input
                                value={descontoCollaboratorSearch}
                                onChange={(event) => setDescontoCollaboratorSearch(event.target.value)}
                                placeholder="Digite para filtrar (ex.: Ada)"
                            />
                            <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/20 p-1">
                                {filteredDescontoCollaborators.length === 0 ? (
                                    <p className="px-2 py-1 text-xs text-muted-foreground">Nenhum colaborador encontrado.</p>
                                ) : (
                                    filteredDescontoCollaborators.map((item) => {
                                        const selected = descontoForm.colaborador_id === String(item.id);

                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className={`w-full rounded px-2 py-1 text-left text-sm ${selected ? 'bg-primary/15 font-medium' : 'hover:bg-muted'}`}
                                                onClick={() => {
                                                    setDescontoForm((previous) => ({ ...previous, colaborador_id: String(item.id) }));
                                                    setDescontoCollaboratorSearch(item.nome);
                                                }}
                                            >
                                                {item.nome}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="desc-desconto">Descrição *</Label>
                            <Input
                                id="desc-desconto"
                                value={descontoForm.descricao}
                                onChange={(event) => setDescontoForm((previous) => ({ ...previous, descricao: event.target.value }))}
                            />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Prioridade 1 *</Label>
                                <Select
                                    value={descontoForm.prioridade_1}
                                    onValueChange={(value: typeof descontoForm.prioridade_1) =>
                                        setDescontoForm((previous) => ({ ...previous, prioridade_1: value }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="extras">Extras</SelectItem>
                                        <SelectItem value="salario">Salário mensal</SelectItem>
                                        <SelectItem value="beneficios">Benefícios</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Prioridade 2 (opcional)</Label>
                                <Select
                                    value={descontoForm.prioridade_2}
                                    onValueChange={(value: typeof descontoForm.prioridade_2) =>
                                        setDescontoForm((previous) => ({ ...previous, prioridade_2: value }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Sem prioridade 2" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Sem prioridade 2</SelectItem>
                                        <SelectItem value="extras">Extras</SelectItem>
                                        <SelectItem value="salario">Salário mensal</SelectItem>
                                        <SelectItem value="beneficios">Benefícios</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Prioridade 3 (opcional)</Label>
                                <Select
                                    value={descontoForm.prioridade_3}
                                    onValueChange={(value: typeof descontoForm.prioridade_3) =>
                                        setDescontoForm((previous) => ({ ...previous, prioridade_3: value }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Sem prioridade 3" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Sem prioridade 3</SelectItem>
                                        <SelectItem value="extras">Extras</SelectItem>
                                        <SelectItem value="salario">Salário mensal</SelectItem>
                                        <SelectItem value="beneficios">Benefícios</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="valor-desconto">Valor *</Label>
                                <Input
                                    id="valor-desconto"
                                    type="text"
                                    inputMode="decimal"
                                    value={descontoForm.valor}
                                    onChange={(event) => setDescontoForm((previous) => ({ ...previous, valor: event.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label>Parcelado</Label>
                                <Select
                                    value={descontoForm.parcelado ? '1' : '0'}
                                    onValueChange={(value) => setDescontoForm((previous) => ({ ...previous, parcelado: value === '1' }))}
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
                                        setDescontoForm((previous) => ({ ...previous, total_parcelas: event.target.value }))
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
                                        setDescontoForm((previous) => ({ ...previous, parcela_atual: event.target.value }))
                                    }
                                    disabled={!descontoForm.parcelado}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="data-desconto">Data de referência</Label>
                            <Input
                                id="data-desconto"
                                type="date"
                                value={descontoForm.data_referencia}
                                onChange={(event) =>
                                    setDescontoForm((previous) => ({ ...previous, data_referencia: event.target.value }))
                                }
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDescontoOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={saving || !descontoForm.colaborador_id || !descontoForm.descricao.trim()}>
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
                        <DialogTitle>{editingEmprestimo ? 'Editar empréstimo' : 'Novo empréstimo'}</DialogTitle>
                        <DialogDescription>Informe valores para compor o ganho mensal com empréstimos.</DialogDescription>
                    </DialogHeader>
                    <form className="space-y-3" onSubmit={saveEmprestimo}>
                        <div className="space-y-2">
                            <Label>Colaborador *</Label>
                            <Input
                                value={emprestimoCollaboratorSearch}
                                onChange={(event) => setEmprestimoCollaboratorSearch(event.target.value)}
                                placeholder="Digite para filtrar (ex.: Ada)"
                            />
                            <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/20 p-1">
                                {filteredEmprestimoCollaborators.length === 0 ? (
                                    <p className="px-2 py-1 text-xs text-muted-foreground">Nenhum colaborador encontrado.</p>
                                ) : (
                                    filteredEmprestimoCollaborators.map((item) => {
                                        const selected = emprestimoForm.colaborador_id === String(item.id);

                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className={`w-full rounded px-2 py-1 text-left text-sm ${selected ? 'bg-primary/15 font-medium' : 'hover:bg-muted'}`}
                                                onClick={() => {
                                                    setEmprestimoForm((previous) => ({ ...previous, colaborador_id: String(item.id) }));
                                                    setEmprestimoCollaboratorSearch(item.nome);
                                                }}
                                            >
                                                {item.nome}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="desc-emprestimo">Descrição *</Label>
                            <Input
                                id="desc-emprestimo"
                                value={emprestimoForm.descricao}
                                onChange={(event) =>
                                    setEmprestimoForm((previous) => ({ ...previous, descricao: event.target.value }))
                                }
                            />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="valor-total">Valor total *</Label>
                                <Input
                                    id="valor-total"
                                    type="text"
                                    inputMode="decimal"
                                    value={emprestimoForm.valor_total}
                                    onChange={(event) =>
                                        setEmprestimoForm((previous) => ({ ...previous, valor_total: event.target.value }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="valor-parcela">Valor parcela *</Label>
                                <Input
                                    id="valor-parcela"
                                    type="text"
                                    inputMode="decimal"
                                    value={emprestimoForm.valor_parcela}
                                    onChange={(event) =>
                                        setEmprestimoForm((previous) => ({ ...previous, valor_parcela: event.target.value }))
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
                                        setEmprestimoForm((previous) => ({ ...previous, total_parcelas: event.target.value }))
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
                                        setEmprestimoForm((previous) => ({ ...previous, parcelas_pagas: event.target.value }))
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
                                        setEmprestimoForm((previous) => ({ ...previous, data_inicio: event.target.value }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Ativo</Label>
                            <Select
                                value={emprestimoForm.ativo ? '1' : '0'}
                                onValueChange={(value) =>
                                    setEmprestimoForm((previous) => ({ ...previous, ativo: value === '1' }))
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

            <Dialog open={pensaoOpen} onOpenChange={setPensaoOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingPensao ? 'Editar pensão' : 'Nova pensão'}</DialogTitle>
                        <DialogDescription>
                            Cadastre os dados da pensão (beneficiária/mãe). O valor será informado no lançamento de salário.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-3" onSubmit={savePensao}>
                        <div className="space-y-2">
                            <Label>Colaborador *</Label>
                            <Input
                                value={pensaoCollaboratorSearch}
                                onChange={(event) => setPensaoCollaboratorSearch(event.target.value)}
                                placeholder="Digite para filtrar (ex.: Ad)"
                            />
                            <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/20 p-1">
                                {filteredPensaoCollaborators.length === 0 ? (
                                    <p className="px-2 py-1 text-xs text-muted-foreground">Nenhum colaborador encontrado.</p>
                                ) : (
                                    filteredPensaoCollaborators.map((item) => {
                                        const selected = pensaoForm.colaborador_id === String(item.id);

                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className={`w-full rounded px-2 py-1 text-left text-sm ${selected ? 'bg-primary/15 font-medium' : 'hover:bg-muted'}`}
                                                onClick={() => {
                                                    setPensaoForm((previous) => ({ ...previous, colaborador_id: String(item.id) }));
                                                    setPensaoCollaboratorSearch(item.nome);
                                                }}
                                            >
                                                {item.nome}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="nome-beneficiaria">Nome da mãe/beneficiária *</Label>
                                <Input
                                    id="nome-beneficiaria"
                                    value={pensaoForm.nome_beneficiaria}
                                    onChange={(event) =>
                                        setPensaoForm((previous) => ({ ...previous, nome_beneficiaria: event.target.value }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cpf-beneficiaria">CPF da beneficiária</Label>
                                <Input
                                    id="cpf-beneficiaria"
                                    value={pensaoForm.cpf_beneficiaria}
                                    onChange={(event) =>
                                        setPensaoForm((previous) => ({ ...previous, cpf_beneficiaria: event.target.value }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="nome-banco-pensao">Nome do banco *</Label>
                                <Input
                                    id="nome-banco-pensao"
                                    value={pensaoForm.nome_banco}
                                    onChange={(event) =>
                                        setPensaoForm((previous) => ({ ...previous, nome_banco: event.target.value }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="numero-banco-pensao">Número do banco</Label>
                                <Input
                                    id="numero-banco-pensao"
                                    value={pensaoForm.numero_banco}
                                    onChange={(event) =>
                                        setPensaoForm((previous) => ({ ...previous, numero_banco: event.target.value }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="numero-agencia-pensao">Número da agência *</Label>
                                <Input
                                    id="numero-agencia-pensao"
                                    value={pensaoForm.numero_agencia}
                                    onChange={(event) =>
                                        setPensaoForm((previous) => ({ ...previous, numero_agencia: event.target.value }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="tipo-conta-pensao">Tipo de conta *</Label>
                                <Input
                                    id="tipo-conta-pensao"
                                    value={pensaoForm.tipo_conta}
                                    onChange={(event) =>
                                        setPensaoForm((previous) => ({ ...previous, tipo_conta: event.target.value }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="numero-conta-pensao">Número da conta *</Label>
                                <Input
                                    id="numero-conta-pensao"
                                    value={pensaoForm.numero_conta}
                                    onChange={(event) =>
                                        setPensaoForm((previous) => ({ ...previous, numero_conta: event.target.value }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="tipo-pix-pensao">Tipo da chave PIX</Label>
                                <Select
                                    value={pensaoForm.tipo_chave_pix || 'none'}
                                    onValueChange={(value) =>
                                        setPensaoForm((previous) => ({
                                            ...previous,
                                            tipo_chave_pix: value === 'none' ? '' : value,
                                        }))
                                    }
                                >
                                    <SelectTrigger id="tipo-pix-pensao">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Sem chave PIX</SelectItem>
                                        <SelectItem value="CPF">CPF</SelectItem>
                                        <SelectItem value="Celular">Celular</SelectItem>
                                        <SelectItem value="Email">Email</SelectItem>
                                        <SelectItem value="Aleatorio">Aleatorio</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="chave-pix-pensao">Chave PIX</Label>
                                <Input
                                    id="chave-pix-pensao"
                                    value={pensaoForm.chave_pix}
                                    onChange={(event) =>
                                        setPensaoForm((previous) => ({ ...previous, chave_pix: event.target.value }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="obs-pensao">Observação</Label>
                            <Input
                                id="obs-pensao"
                                value={pensaoForm.observacao}
                                onChange={(event) =>
                                    setPensaoForm((previous) => ({ ...previous, observacao: event.target.value }))
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Ativo</Label>
                            <Select
                                value={pensaoForm.ativo ? '1' : '0'}
                                onValueChange={(value) => setPensaoForm((previous) => ({ ...previous, ativo: value === '1' }))}
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
                            <Button type="button" variant="outline" onClick={() => setPensaoOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    saving ||
                                    !pensaoForm.colaborador_id ||
                                    !pensaoForm.nome_beneficiaria.trim() ||
                                    !pensaoForm.nome_banco.trim() ||
                                    !pensaoForm.numero_agencia.trim() ||
                                    !pensaoForm.tipo_conta.trim() ||
                                    !pensaoForm.numero_conta.trim()
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
