import { LoaderCircle, PencilLine, PlusSquare, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
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

interface TipoPagamento {
    id: number;
    nome: string;
    gera_encargos: boolean;
    categoria: 'salario' | 'beneficios' | 'extras';
    forma_pagamento: 'deposito' | 'cartao_vr' | 'cartao_va' | 'dinheiro';
}

interface WrappedResponse<T> {
    data: T;
}

interface FormData {
    nome: string;
    gera_encargos: boolean;
    categoria: 'salario' | 'beneficios' | 'extras';
    forma_pagamento: 'deposito' | 'cartao_vr' | 'cartao_va' | 'dinheiro';
}

const emptyForm: FormData = {
    nome: '',
    gera_encargos: false,
    categoria: 'salario',
    forma_pagamento: 'deposito',
};

function categoriaLabel(value: TipoPagamento['categoria']): string {
    if (value === 'salario') return 'Salário';
    if (value === 'beneficios') return 'Benefícios';
    return 'Extras';
}

function formaLabel(value: TipoPagamento['forma_pagamento']): string {
    if (value === 'deposito') return 'Depósito';
    if (value === 'cartao_vr') return 'Cartão VR';
    if (value === 'cartao_va') return 'Cartão VA';
    return 'Dinheiro';
}

export default function TransportRegistryPaymentTypesPage() {
    const [items, setItems] = useState<TipoPagamento[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<TipoPagamento | null>(null);
    const [deleteCandidate, setDeleteCandidate] =
        useState<TipoPagamento | null>(null);
    const [formData, setFormData] = useState<FormData>(emptyForm);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    async function load(): Promise<void> {
        setLoading(true);
        setNotification(null);

        try {
            const response = await apiGet<WrappedResponse<TipoPagamento[]>>(
                '/registry/tipos-pagamento',
            );
            setItems(response.data);
        } catch {
            setNotification({
                message: 'Não foi possível carregar os tipos de pagamento.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    function openCreateDialog(): void {
        setEditingItem(null);
        setFormData(emptyForm);
        setFormOpen(true);
    }

    function openEditDialog(item: TipoPagamento): void {
        setEditingItem(item);
        setFormData({
            nome: item.nome,
            gera_encargos: item.gera_encargos,
            categoria: item.categoria,
            forma_pagamento: item.forma_pagamento,
        });
        setFormOpen(true);
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setSaving(true);
        setNotification(null);

        try {
            const payload = {
                nome: formData.nome.trim(),
                gera_encargos: formData.gera_encargos,
                categoria: formData.categoria,
                forma_pagamento: formData.forma_pagamento,
            };

            if (editingItem) {
                await apiPut(`/registry/tipos-pagamento/${editingItem.id}`, payload);
            } else {
                await apiPost('/registry/tipos-pagamento', payload);
            }

            setNotification({
                message: editingItem
                    ? 'Tipo de pagamento atualizado com sucesso.'
                    : 'Tipo de pagamento cadastrado com sucesso.',
                variant: 'success',
            });
            setFormOpen(false);
            setEditingItem(null);
            setFormData(emptyForm);
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
                    message: 'Não foi possível salvar o tipo de pagamento.',
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
        setNotification(null);

        try {
            await apiDelete(`/registry/tipos-pagamento/${deleteCandidate.id}`);
            setNotification({
                message: 'Tipo de pagamento removido com sucesso.',
                variant: 'success',
            });
            setDeleteCandidate(null);
            await load();
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({
                    message: error.message,
                    variant: 'error',
                });
            } else {
                setNotification({
                    message: 'Não foi possível excluir o tipo de pagamento.',
                    variant: 'error',
                });
            }
        } finally {
            setDeleting(false);
        }
    }

    return (
        <AdminLayout
            title="Cadastro - Tipo de Pagamentos"
            active="registry-payment-types"
            module="registry"
        >
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold">
                            Cadastro de Tipo de Pagamentos
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Defina os tipos usados nos lançamentos de pagamentos.
                        </p>
                    </div>
                    <Button type="button" onClick={openCreateDialog}>
                        <PlusSquare className="size-4" />
                        Cadastrar Tipo
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
                        <CardTitle>Tipos ({items.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando tipos de pagamento...
                            </div>
                        ) : items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Nenhum tipo de pagamento cadastrado.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-2 pr-3 font-medium">Nome</th>
                                            <th className="py-2 pr-3 font-medium">Gera encargos</th>
                                            <th className="py-2 pr-3 font-medium">Categoria</th>
                                            <th className="py-2 pr-3 font-medium">Forma pagamento</th>
                                            <th className="py-2 text-right font-medium">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item) => (
                                            <tr
                                                key={item.id}
                                                className="border-b last:border-b-0"
                                            >
                                                <td className="py-2 pr-3 font-medium">{item.nome}</td>
                                                <td className="py-2 pr-3">
                                                    {item.gera_encargos ? 'Sim' : 'Não'}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {categoriaLabel(item.categoria)}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {formaLabel(item.forma_pagamento)}
                                                </td>
                                                <td className="py-2">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openEditDialog(item)}
                                                        >
                                                            <PencilLine className="size-4" />
                                                            Editar
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setDeleteCandidate(item)}
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
                    </CardContent>
                </Card>
            </div>

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
                                ? 'Editar tipo de pagamento'
                                : 'Cadastrar tipo de pagamento'}
                        </DialogTitle>
                        <DialogDescription>
                            Configure nome, encargos, categoria e forma de pagamento.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="space-y-2">
                            <Label htmlFor="nome">Nome *</Label>
                            <Input
                                id="nome"
                                value={formData.nome}
                                onChange={(event) =>
                                    setFormData((previous) => ({
                                        ...previous,
                                        nome: event.target.value,
                                    }))
                                }
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Gera encargos *</Label>
                            <Select
                                value={formData.gera_encargos ? '1' : '0'}
                                onValueChange={(value) =>
                                    setFormData((previous) => ({
                                        ...previous,
                                        gera_encargos: value === '1',
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

                        <div className="space-y-2">
                            <Label>Categoria *</Label>
                            <Select
                                value={formData.categoria}
                                onValueChange={(value: FormData['categoria']) =>
                                    setFormData((previous) => ({
                                        ...previous,
                                        categoria: value,
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="salario">Salário</SelectItem>
                                    <SelectItem value="beneficios">Benefícios</SelectItem>
                                    <SelectItem value="extras">Extras</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Forma pagamento *</Label>
                            <Select
                                value={formData.forma_pagamento}
                                onValueChange={(
                                    value: FormData['forma_pagamento'],
                                ) =>
                                    setFormData((previous) => ({
                                        ...previous,
                                        forma_pagamento: value,
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="deposito">Depósito</SelectItem>
                                    <SelectItem value="cartao_vr">Cartão VR</SelectItem>
                                    <SelectItem value="cartao_va">Cartão VA</SelectItem>
                                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                </SelectContent>
                            </Select>
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
                                disabled={saving || !formData.nome.trim()}
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

            <Dialog
                open={Boolean(deleteCandidate)}
                onOpenChange={(open) => {
                    if (!open) setDeleteCandidate(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir tipo de pagamento?</DialogTitle>
                        <DialogDescription>
                            Esta ação remove o tipo da listagem.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-md border bg-muted/20 p-3 text-sm">
                        <p className="font-medium">{deleteCandidate?.nome ?? '-'}</p>
                    </div>

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
        </AdminLayout>
    );
}
