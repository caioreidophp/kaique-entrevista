import { LoaderCircle, PencilLine, PlusSquare, Trash2, Upload } from 'lucide-react';
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

interface Unidade {
    id: number;
    nome: string;
}

interface PlacaFrota {
    id: number;
    placa: string;
    unidade_id: number;
    unidade?: Unidade;
}

interface Aviario {
    id: number;
    nome: string;
    cidade: string;
    km: string | number | null;
}

interface AviarioImportResult {
    total_lidos: number;
    total_importados: number;
    total_ignorados: number;
}

interface WrappedResponse<T> {
    data: T;
}

function formatKm(value: string | number | null): string {
    if (value === null || value === undefined || value === '') {
        return '-';
    }

    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
        return '-';
    }

    return String(Math.round(numeric));
}

const emptyPlacaForm = {
    placa: '',
    unidade_id: '',
};

const emptyAviarioForm = {
    nome: '',
    cidade: '',
    km: '',
};

export default function TransportRegistryPlatesAviariesPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const [unidades, setUnidades] = useState<Unidade[]>([]);
    const [placas, setPlacas] = useState<PlacaFrota[]>([]);
    const [aviarios, setAviarios] = useState<Aviario[]>([]);

    const [placaDialogOpen, setPlacaDialogOpen] = useState(false);
    const [aviarioDialogOpen, setAviarioDialogOpen] = useState(false);
    const [placaBulkDialogOpen, setPlacaBulkDialogOpen] = useState(false);
    const [aviarioBulkDialogOpen, setAviarioBulkDialogOpen] = useState(false);
    const [aviarioImportDialogOpen, setAviarioImportDialogOpen] = useState(false);
    const [editingPlaca, setEditingPlaca] = useState<PlacaFrota | null>(null);
    const [editingAviario, setEditingAviario] = useState<Aviario | null>(null);

    const [placaForm, setPlacaForm] = useState(emptyPlacaForm);
    const [aviarioForm, setAviarioForm] = useState(emptyAviarioForm);
    const [placaBulkForm, setPlacaBulkForm] = useState({ unidade_id: '', placas: '' });
    const [aviarioBulkForm, setAviarioBulkForm] = useState({ cidade: '', aviarios: '' });
    const [aviarioImportFile, setAviarioImportFile] = useState<File | null>(null);

    async function load(): Promise<void> {
        setLoading(true);
        setNotification(null);

        try {
            const [u, p, a] = await Promise.all([
                apiGet<WrappedResponse<Unidade[]>>('/registry/unidades'),
                apiGet<WrappedResponse<PlacaFrota[]>>('/registry/placas-frota'),
                apiGet<WrappedResponse<Aviario[]>>('/registry/aviarios'),
            ]);

            setUnidades(u.data);
            setPlacas(p.data);
            setAviarios(a.data);
        } catch {
            setNotification({
                message: 'Não foi possível carregar placas e aviários.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    function openCreatePlaca(): void {
        setEditingPlaca(null);
        setPlacaForm({
            ...emptyPlacaForm,
            unidade_id: unidades[0] ? String(unidades[0].id) : '',
        });
        setPlacaDialogOpen(true);
    }

    function openBulkPlaca(): void {
        setPlacaBulkForm({
            unidade_id: unidades[0] ? String(unidades[0].id) : '',
            placas: '',
        });
        setPlacaBulkDialogOpen(true);
    }

    function openEditPlaca(item: PlacaFrota): void {
        setEditingPlaca(item);
        setPlacaForm({
            placa: item.placa,
            unidade_id: String(item.unidade_id),
        });
        setPlacaDialogOpen(true);
    }

    function openCreateAviario(): void {
        setEditingAviario(null);
        setAviarioForm(emptyAviarioForm);
        setAviarioDialogOpen(true);
    }

    function openBulkAviario(): void {
        setAviarioBulkForm({ cidade: '', aviarios: '' });
        setAviarioBulkDialogOpen(true);
    }

    function openEditAviario(item: Aviario): void {
        setEditingAviario(item);
        setAviarioForm({
            nome: item.nome,
            cidade: item.cidade,
            km:
                item.km !== null && item.km !== undefined
                    ? String(Math.round(Number(item.km)))
                    : '',
        });
        setAviarioDialogOpen(true);
    }

    async function savePlaca(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setSaving(true);
        setNotification(null);

        const payload = {
            placa: placaForm.placa,
            unidade_id: Number(placaForm.unidade_id),
        };

        try {
            if (editingPlaca) {
                await apiPut(`/registry/placas-frota/${editingPlaca.id}`, payload);
            } else {
                await apiPost('/registry/placas-frota', payload);
            }

            setNotification({
                message: editingPlaca ? 'Placa atualizada com sucesso.' : 'Placa cadastrada com sucesso.',
                variant: 'success',
            });
            setPlacaDialogOpen(false);
            setEditingPlaca(null);
            setPlacaForm(emptyPlacaForm);
            await load();
        } catch (error) {
            if (error instanceof ApiError) {
                const firstError = error.errors ? Object.values(error.errors)[0]?.[0] : null;
                setNotification({ message: firstError ?? error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível salvar a placa.', variant: 'error' });
            }
        } finally {
            setSaving(false);
        }
    }

    async function saveAviario(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setSaving(true);
        setNotification(null);

        const payload = {
            nome: aviarioForm.nome.trim(),
            cidade: aviarioForm.cidade.trim(),
            km:
                aviarioForm.km.trim() === ''
                    ? null
                    : Math.round(Number(aviarioForm.km.replace(',', '.'))),
        };

        try {
            if (editingAviario) {
                await apiPut(`/registry/aviarios/${editingAviario.id}`, payload);
            } else {
                await apiPost('/registry/aviarios', payload);
            }

            setNotification({
                message: editingAviario ? 'Aviário atualizado com sucesso.' : 'Aviário cadastrado com sucesso.',
                variant: 'success',
            });
            setAviarioDialogOpen(false);
            setEditingAviario(null);
            setAviarioForm(emptyAviarioForm);
            await load();
        } catch (error) {
            if (error instanceof ApiError) {
                const firstError = error.errors ? Object.values(error.errors)[0]?.[0] : null;
                setNotification({ message: firstError ?? error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível salvar o aviário.', variant: 'error' });
            }
        } finally {
            setSaving(false);
        }
    }

    async function importAviariosSpreadsheet(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();

        if (!aviarioImportFile) {
            setNotification({
                message: 'Selecione um arquivo XLSX para importar.',
                variant: 'error',
            });
            return;
        }

        setSaving(true);
        setNotification(null);

        const formData = new FormData();
        formData.append('file', aviarioImportFile);

        try {
            const response = await apiPost<AviarioImportResult>(
                '/registry/aviarios/import-spreadsheet',
                formData,
            );

            setNotification({
                message: `Importação concluída: ${response.total_importados} importado(s), ${response.total_ignorados} ignorado(s), ${response.total_lidos} lido(s).`,
                variant: 'success',
            });

            setAviarioImportDialogOpen(false);
            setAviarioImportFile(null);
            await load();
        } catch (error) {
            if (error instanceof ApiError) {
                const firstError = error.errors ? Object.values(error.errors)[0]?.[0] : null;
                setNotification({ message: firstError ?? error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível importar o XLSX de aviários.', variant: 'error' });
            }
        } finally {
            setSaving(false);
        }
    }

    async function savePlacasBulk(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setSaving(true);
        setNotification(null);

        try {
            const response = await apiPost<{ created_count: number; skipped_existing: string[] }>(
                '/registry/placas-frota/bulk',
                {
                    unidade_id: Number(placaBulkForm.unidade_id),
                    placas: placaBulkForm.placas,
                },
            );

            setNotification({
                message:
                    response.created_count > 0
                        ? `Cadastro em lote concluído: ${response.created_count} placa(s) criada(s).`
                        : 'Nenhuma placa nova foi criada (todas já existiam ou entrada vazia).',
                variant: 'success',
            });

            setPlacaBulkDialogOpen(false);
            setPlacaBulkForm({ unidade_id: '', placas: '' });
            await load();
        } catch (error) {
            if (error instanceof ApiError) {
                const firstError = error.errors ? Object.values(error.errors)[0]?.[0] : null;
                setNotification({ message: firstError ?? error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível cadastrar placas em lote.', variant: 'error' });
            }
        } finally {
            setSaving(false);
        }
    }

    async function saveAviariosBulk(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setSaving(true);
        setNotification(null);

        try {
            const response = await apiPost<{ created_count: number; skipped_existing: string[] }>(
                '/registry/aviarios/bulk',
                {
                    cidade: aviarioBulkForm.cidade,
                    aviarios: aviarioBulkForm.aviarios,
                },
            );

            setNotification({
                message:
                    response.created_count > 0
                        ? `Cadastro em lote concluído: ${response.created_count} aviário(s) criado(s).`
                        : 'Nenhum aviário novo foi criado (todos já existiam ou entrada vazia).',
                variant: 'success',
            });

            setAviarioBulkDialogOpen(false);
            setAviarioBulkForm({ cidade: '', aviarios: '' });
            await load();
        } catch (error) {
            if (error instanceof ApiError) {
                const firstError = error.errors ? Object.values(error.errors)[0]?.[0] : null;
                setNotification({ message: firstError ?? error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível cadastrar aviários em lote.', variant: 'error' });
            }
        } finally {
            setSaving(false);
        }
    }

    async function removePlaca(id: number): Promise<void> {
        setDeletingId(`placa-${id}`);

        try {
            await apiDelete(`/registry/placas-frota/${id}`);
            setNotification({ message: 'Placa excluída com sucesso.', variant: 'success' });
            await load();
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({ message: error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível excluir a placa.', variant: 'error' });
            }
        } finally {
            setDeletingId(null);
        }
    }

    async function removeAviario(id: number): Promise<void> {
        setDeletingId(`aviario-${id}`);

        try {
            await apiDelete(`/registry/aviarios/${id}`);
            setNotification({ message: 'Aviário excluído com sucesso.', variant: 'success' });
            await load();
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({ message: error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível excluir o aviário.', variant: 'error' });
            }
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <AdminLayout
            title="Cadastro - Placas e Aviários"
            active="registry-plates-aviaries"
            module="registry"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Placas e Aviários</h2>
                    <p className="text-sm text-muted-foreground">
                        Cadastre separadamente placas da frota e aviários para uso nos painéis operacionais.
                    </p>
                </div>

                {notification ? <Notification message={notification.message} variant={notification.variant} /> : null}

                <div className="grid gap-6 xl:grid-cols-2">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Placas ({placas.length})</CardTitle>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={openBulkPlaca}>
                                    Cadastrar em Lote
                                </Button>
                                <Button type="button" onClick={openCreatePlaca}>
                                    <PlusSquare className="size-4" />
                                    Cadastrar Placa
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Carregando placas...
                                </div>
                            ) : placas.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Nenhuma placa cadastrada.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-left text-muted-foreground">
                                                <th className="py-2 pr-3 font-medium">Placa</th>
                                                <th className="py-2 pr-3 font-medium">Unidade frota</th>
                                                <th className="py-2 text-right font-medium">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {placas.map((item) => (
                                                <tr key={item.id} className="border-b last:border-b-0">
                                                    <td className="py-2 pr-3 font-medium">{item.placa}</td>
                                                    <td className="py-2 pr-3">{item.unidade?.nome ?? '-'}</td>
                                                    <td className="py-2">
                                                        <div className="flex justify-end gap-2">
                                                            <Button type="button" variant="ghost" size="sm" title="Editar" aria-label="Editar" onClick={() => openEditPlaca(item)}>
                                                                <PencilLine className="size-4" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-destructive hover:text-destructive"
                                                                title="Excluir"
                                                                aria-label="Excluir"
                                                                onClick={() => void removePlaca(item.id)}
                                                                disabled={deletingId === `placa-${item.id}`}
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

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Aviários ({aviarios.length})</CardTitle>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => setAviarioImportDialogOpen(true)}>
                                    <Upload className="size-4" />
                                    Importar XLSX
                                </Button>
                                <Button type="button" variant="outline" onClick={openBulkAviario}>
                                    Cadastrar em Lote
                                </Button>
                                <Button type="button" onClick={openCreateAviario}>
                                    <PlusSquare className="size-4" />
                                    Cadastrar Aviário
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Carregando aviários...
                                </div>
                            ) : aviarios.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Nenhum aviário cadastrado.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-left text-muted-foreground">
                                                <th className="py-2 pr-3 font-medium">Aviário</th>
                                                <th className="py-2 pr-3 font-medium">Cidade</th>
                                                <th className="py-2 pr-3 font-medium">KM</th>
                                                <th className="py-2 text-right font-medium">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {aviarios.map((item) => (
                                                <tr key={item.id} className="border-b last:border-b-0">
                                                    <td className="py-2 pr-3 font-medium">{item.nome}</td>
                                                    <td className="py-2 pr-3">{item.cidade}</td>
                                                    <td className="py-2 pr-3">{formatKm(item.km)}</td>
                                                    <td className="py-2">
                                                        <div className="flex justify-end gap-2">
                                                            <Button type="button" variant="ghost" size="sm" title="Editar" aria-label="Editar" onClick={() => openEditAviario(item)}>
                                                                <PencilLine className="size-4" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-destructive hover:text-destructive"
                                                                title="Excluir"
                                                                aria-label="Excluir"
                                                                onClick={() => void removeAviario(item.id)}
                                                                disabled={deletingId === `aviario-${item.id}`}
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
            </div>

            <Dialog
                open={placaDialogOpen}
                onOpenChange={(open) => {
                    setPlacaDialogOpen(open);
                    if (!open) {
                        setEditingPlaca(null);
                        setPlacaForm(emptyPlacaForm);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingPlaca ? 'Editar Placa' : 'Cadastrar Placa'}</DialogTitle>
                        <DialogDescription>
                            Informe a placa e a unidade da frota à qual ela pertence.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={(event) => void savePlaca(event)}>
                        <div className="space-y-2">
                            <Label htmlFor="placa">Placa *</Label>
                            <Input
                                id="placa"
                                value={placaForm.placa}
                                onChange={(event) =>
                                    setPlacaForm((previous) => ({
                                        ...previous,
                                        placa: event.target.value.toUpperCase(),
                                    }))
                                }
                                placeholder="ABC1D23"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Unidade da frota *</Label>
                            <Select
                                value={placaForm.unidade_id || undefined}
                                onValueChange={(value) =>
                                    setPlacaForm((previous) => ({
                                        ...previous,
                                        unidade_id: value,
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {unidades.map((unidade) => (
                                        <SelectItem key={unidade.id} value={String(unidade.id)}>
                                            {unidade.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setPlacaDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? 'Salvando...' : editingPlaca ? 'Salvar alterações' : 'Cadastrar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={placaBulkDialogOpen}
                onOpenChange={(open) => {
                    setPlacaBulkDialogOpen(open);
                    if (!open) {
                        setPlacaBulkForm({ unidade_id: '', placas: '' });
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cadastrar Placas em Lote</DialogTitle>
                        <DialogDescription>
                            Informe a unidade e cole várias placas (uma por linha, vírgula ou ponto e vírgula).
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={(event) => void savePlacasBulk(event)}>
                        <div className="space-y-2">
                            <Label>Unidade da frota *</Label>
                            <Select
                                value={placaBulkForm.unidade_id || undefined}
                                onValueChange={(value) =>
                                    setPlacaBulkForm((previous) => ({
                                        ...previous,
                                        unidade_id: value,
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {unidades.map((unidade) => (
                                        <SelectItem key={unidade.id} value={String(unidade.id)}>
                                            {unidade.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="placas-bulk">Placas *</Label>
                            <textarea
                                id="placas-bulk"
                                className="flex min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                                value={placaBulkForm.placas}
                                onChange={(event) =>
                                    setPlacaBulkForm((previous) => ({
                                        ...previous,
                                        placas: event.target.value,
                                    }))
                                }
                                placeholder={'ABC1D23\nDEF4G56\nGHI7J89'}
                                required
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setPlacaBulkDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? 'Salvando...' : 'Cadastrar em lote'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={aviarioDialogOpen}
                onOpenChange={(open) => {
                    setAviarioDialogOpen(open);
                    if (!open) {
                        setEditingAviario(null);
                        setAviarioForm(emptyAviarioForm);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingAviario ? 'Editar Aviário' : 'Cadastrar Aviário'}</DialogTitle>
                        <DialogDescription>
                            Informe o nome do aviário, sua cidade e a distância (KM) até o abatedouro.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={(event) => void saveAviario(event)}>
                        <div className="space-y-2">
                            <Label htmlFor="aviario-nome">Nome do aviário *</Label>
                            <Input
                                id="aviario-nome"
                                value={aviarioForm.nome}
                                onChange={(event) =>
                                    setAviarioForm((previous) => ({
                                        ...previous,
                                        nome: event.target.value,
                                    }))
                                }
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="aviario-cidade">Cidade *</Label>
                            <Input
                                id="aviario-cidade"
                                value={aviarioForm.cidade}
                                onChange={(event) =>
                                    setAviarioForm((previous) => ({
                                        ...previous,
                                        cidade: event.target.value,
                                    }))
                                }
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="aviario-km">KM</Label>
                            <Input
                                id="aviario-km"
                                type="number"
                                step="1"
                                min="0"
                                value={aviarioForm.km}
                                onChange={(event) =>
                                    setAviarioForm((previous) => ({
                                        ...previous,
                                        km: event.target.value,
                                    }))
                                }
                                placeholder="Ex.: 35"
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAviarioDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? 'Salvando...' : editingAviario ? 'Salvar alterações' : 'Cadastrar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={aviarioImportDialogOpen}
                onOpenChange={(open) => {
                    setAviarioImportDialogOpen(open);
                    if (!open) {
                        setAviarioImportFile(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Importar Aviários por XLSX</DialogTitle>
                        <DialogDescription>
                            O arquivo deve usar: coluna A = nome do aviário, coluna B = cidade, coluna C = KM.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={(event) => void importAviariosSpreadsheet(event)}>
                        <div className="space-y-2">
                            <Label htmlFor="aviarios-xlsx">Arquivo XLSX *</Label>
                            <Input
                                id="aviarios-xlsx"
                                type="file"
                                accept=".xlsx"
                                onChange={(event) => setAviarioImportFile(event.target.files?.[0] ?? null)}
                                required
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAviarioImportDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={saving || !aviarioImportFile}>
                                {saving ? 'Importando...' : 'Importar XLSX'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={aviarioBulkDialogOpen}
                onOpenChange={(open) => {
                    setAviarioBulkDialogOpen(open);
                    if (!open) {
                        setAviarioBulkForm({ cidade: '', aviarios: '' });
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cadastrar Aviários em Lote</DialogTitle>
                        <DialogDescription>
                            Informe a cidade e cole vários aviários (uma por linha, vírgula ou ponto e vírgula).
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={(event) => void saveAviariosBulk(event)}>
                        <div className="space-y-2">
                            <Label htmlFor="cidade-bulk">Cidade *</Label>
                            <Input
                                id="cidade-bulk"
                                value={aviarioBulkForm.cidade}
                                onChange={(event) =>
                                    setAviarioBulkForm((previous) => ({
                                        ...previous,
                                        cidade: event.target.value,
                                    }))
                                }
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="aviarios-bulk">Aviários *</Label>
                            <textarea
                                id="aviarios-bulk"
                                className="flex min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                                value={aviarioBulkForm.aviarios}
                                onChange={(event) =>
                                    setAviarioBulkForm((previous) => ({
                                        ...previous,
                                        aviarios: event.target.value,
                                    }))
                                }
                                placeholder={'Aviário São João\nAviário Boa Vista\nAviário Santa Rita'}
                                required
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAviarioBulkDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? 'Salvando...' : 'Cadastrar em lote'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
