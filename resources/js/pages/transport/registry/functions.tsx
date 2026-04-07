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

interface RegistryFunction {
    id: number;
    nome: string;
    descricao: string | null;
    ativo: boolean;
}

interface WrappedResponse<T> {
    data: T;
}

interface FunctionFormData {
    nome: string;
    descricao: string;
    ativo: boolean;
}

const emptyForm: FunctionFormData = {
    nome: '',
    descricao: '',
    ativo: true,
};

export default function TransportRegistryFunctionsPage() {
    const [items, setItems] = useState<RegistryFunction[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<RegistryFunction | null>(
        null,
    );
    const [deleteCandidate, setDeleteCandidate] =
        useState<RegistryFunction | null>(null);
    const [formData, setFormData] = useState<FunctionFormData>(emptyForm);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    async function load(): Promise<void> {
        setLoading(true);
        setNotification(null);

        try {
            const response =
                await apiGet<WrappedResponse<RegistryFunction[]>>(
                    '/registry/funcoes',
                );
            setItems(response.data);
        } catch {
            setNotification({
                message: 'Não foi possível carregar as funções.',
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

    function openEditDialog(item: RegistryFunction): void {
        setEditingItem(item);
        setFormData({
            nome: item.nome,
            descricao: item.descricao ?? '',
            ativo: item.ativo,
        });
        setFormOpen(true);
    }

    async function handleSubmit(
        event: React.FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();
        setSaving(true);
        setNotification(null);

        try {
            if (editingItem) {
                await apiPut(`/registry/funcoes/${editingItem.id}`, {
                    nome: formData.nome.trim(),
                    descricao: formData.descricao.trim() || null,
                    ativo: formData.ativo,
                });
            } else {
                await apiPost('/registry/funcoes', {
                    nome: formData.nome.trim(),
                    descricao: formData.descricao.trim() || null,
                    ativo: formData.ativo,
                });
            }

            setNotification({
                message: editingItem
                    ? 'Função atualizada com sucesso.'
                    : 'Função cadastrada com sucesso.',
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
                    message: 'Não foi possível salvar a função.',
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
            await apiDelete(`/registry/funcoes/${deleteCandidate.id}`);
            setNotification({
                message: 'Função removida com sucesso.',
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
                    message: 'Não foi possível excluir a função.',
                    variant: 'error',
                });
            }
        } finally {
            setDeleting(false);
        }
    }

    return (
        <AdminLayout
            title="Cadastro - Funções"
            active="registry-functions"
            module="registry"
        >
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold">
                            Cadastro de Funções
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Mantenha as funções utilizadas nos cadastros de
                            colaboradores.
                        </p>
                    </div>
                    <Button type="button" onClick={openCreateDialog}>
                        <PlusSquare className="size-4" />
                        Cadastrar Função
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
                        <CardTitle>Funções ({items.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando funções...
                            </div>
                        ) : items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Nenhuma função encontrada.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-2 pr-3 font-medium">
                                                Nome
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                Descrição
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                Status
                                            </th>
                                            <th className="py-2 text-right font-medium">
                                                Ações
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item) => (
                                            <tr
                                                key={item.id}
                                                className="border-b last:border-b-0"
                                            >
                                                <td className="py-2 pr-3 font-medium">
                                                    {item.nome}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {item.descricao ?? '-'}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    <span
                                                        className={`transport-status-badge ${item.ativo ? 'transport-status-success' : 'transport-status-danger'}`}
                                                    >
                                                        {item.ativo
                                                            ? 'Ativa'
                                                            : 'Inativa'}
                                                    </span>
                                                </td>
                                                <td className="py-2">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            title="Editar"
                                                            aria-label="Editar"
                                                            onClick={() =>
                                                                openEditDialog(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            <PencilLine className="size-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive hover:text-destructive"
                                                            title="Excluir"
                                                            aria-label="Excluir"
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
                            {editingItem ? 'Editar função' : 'Cadastrar função'}
                        </DialogTitle>
                        <DialogDescription>
                            Defina as funções utilizadas no módulo de cadastro.
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
                            <Label htmlFor="descricao">Descrição</Label>
                            <Input
                                id="descricao"
                                value={formData.descricao}
                                onChange={(event) =>
                                    setFormData((previous) => ({
                                        ...previous,
                                        descricao: event.target.value,
                                    }))
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={formData.ativo ? '1' : '0'}
                                onValueChange={(value) =>
                                    setFormData((previous) => ({
                                        ...previous,
                                        ativo: value === '1',
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Ativa</SelectItem>
                                    <SelectItem value="0">Inativa</SelectItem>
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
                    if (!open) {
                        setDeleteCandidate(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir função</DialogTitle>
                        <DialogDescription>
                            Deseja realmente excluir a função{' '}
                            <strong>{deleteCandidate?.nome}</strong>?
                        </DialogDescription>
                    </DialogHeader>
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
