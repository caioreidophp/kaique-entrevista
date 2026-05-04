import { LoaderCircle, PencilLine, PlusSquare } from 'lucide-react';
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
import { ApiError, apiGet, apiPost, apiPut } from '@/lib/api-client';

interface RegistryUnit {
    id: number;
    nome: string;
    slug: string;
    ativo: boolean;
}

interface WrappedResponse<T> {
    data: T;
}

interface UnitFormData {
    nome: string;
    ativo: boolean;
}

const emptyForm: UnitFormData = {
    nome: '',
    ativo: true,
};

export default function TransportRegistryUnitsPage() {
    const [items, setItems] = useState<RegistryUnit[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<RegistryUnit | null>(null);
    const [formData, setFormData] = useState<UnitFormData>(emptyForm);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    async function load(): Promise<void> {
        setLoading(true);
        setNotification(null);

        try {
            const response = await apiGet<WrappedResponse<RegistryUnit[]>>(
                '/registry/unidades?include_inactive=1',
            );
            setItems(response.data);
        } catch {
            setNotification({
                message: 'Não foi possível carregar as unidades.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    function openCreateDialog(): void {
        setEditingItem(null);
        setFormData(emptyForm);
        setFormOpen(true);
    }

    function openEditDialog(item: RegistryUnit): void {
        setEditingItem(item);
        setFormData({
            nome: item.nome,
            ativo: item.ativo,
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
                ativo: formData.ativo,
            };

            if (editingItem) {
                await apiPut(`/registry/unidades/${editingItem.id}`, payload);
            } else {
                await apiPost('/registry/unidades', payload);
            }

            setNotification({
                message: editingItem
                    ? 'Unidade atualizada com sucesso.'
                    : 'Unidade cadastrada com sucesso.',
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
                    message: 'Não foi possível salvar a unidade.',
                    variant: 'error',
                });
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminLayout
            title="Cadastro - Unidades"
            active="registry-units"
            module="registry"
        >
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold">Cadastro de Unidades</h2>
                        <p className="text-sm text-muted-foreground">
                            Gerencie nome e status operacional das unidades.
                        </p>
                    </div>
                    <Button type="button" onClick={openCreateDialog}>
                        <PlusSquare className="size-4" />
                        Cadastrar unidade
                    </Button>
                </div>

                {notification ? (
                    <Notification message={notification.message} variant={notification.variant} />
                ) : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Unidades ({items.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando unidades...
                            </div>
                        ) : items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Nenhuma unidade cadastrada.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-2 pr-3 font-medium">Nome</th>
                                            <th className="py-2 pr-3 font-medium">Slug</th>
                                            <th className="py-2 pr-3 font-medium">Status</th>
                                            <th className="py-2 text-right font-medium">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item) => (
                                            <tr key={item.id} className="border-b last:border-b-0">
                                                <td className="py-2 pr-3 font-medium">{item.nome}</td>
                                                <td className="py-2 pr-3">{item.slug}</td>
                                                <td className="py-2 pr-3">
                                                    <span
                                                        className={`transport-status-badge ${item.ativo ? 'transport-status-success' : 'transport-status-danger'}`}
                                                    >
                                                        {item.ativo ? 'Ativa' : 'Inativa'}
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
                                                            onClick={() => openEditDialog(item)}
                                                        >
                                                            <PencilLine className="size-4" />
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
                            {editingItem ? 'Editar unidade' : 'Cadastrar unidade'}
                        </DialogTitle>
                        <DialogDescription>
                            Defina os dados principais da unidade.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
                        <div className="space-y-2">
                            <Label htmlFor="unit-name">Nome *</Label>
                            <Input
                                id="unit-name"
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
        </AdminLayout>
    );
}
