import { router } from '@inertiajs/react';
import { LoaderCircle, Pencil, PlusSquare, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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

interface RegistryUser {
    id: number;
    name: string;
    email: string;
    role: 'master_admin' | 'admin' | 'usuario';
    colaborador: {
        id: number;
        nome: string;
    } | null;
}

interface ColaboradorOption {
    id: number;
    nome: string;
}

interface WrappedResponse<T> {
    data: T;
}

interface PaginatedCollaborators {
    data: ColaboradorOption[];
}

interface UserFormData {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    role: 'master_admin' | 'admin' | 'usuario';
    colaborador_id: string;
}

type RoleName = 'master_admin' | 'admin' | 'usuario';

interface PermissionCatalogItem {
    key: string;
    label: string;
}

interface PermissionCatalogGroup {
    key: string;
    label: string;
    items: PermissionCatalogItem[];
}

interface PermissionCatalogSection {
    key: string;
    label: string;
    groups: PermissionCatalogGroup[];
}

interface RolePermissionResponse {
    roles: RoleName[];
    sections: PermissionCatalogSection[];
    permissions_by_role: Record<RoleName, Record<string, boolean>>;
}

const emptyForm: UserFormData = {
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    role: 'admin',
    colaborador_id: 'none',
};

export default function TransportRegistryUsersPage() {
    const [items, setItems] = useState<RegistryUser[]>([]);
    const [colaboradores, setColaboradores] = useState<ColaboradorOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<RegistryUser | null>(null);
    const [deleteCandidate, setDeleteCandidate] =
        useState<RegistryUser | null>(null);
    const [formData, setFormData] = useState<UserFormData>(emptyForm);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);
    const [permissionsOpen, setPermissionsOpen] = useState(false);
    const [permissionsSaving, setPermissionsSaving] = useState(false);
    const [permissionRoles, setPermissionRoles] = useState<RoleName[]>([]);
    const [permissionSections, setPermissionSections] = useState<
        PermissionCatalogSection[]
    >([]);
    const [permissionsByRole, setPermissionsByRole] = useState<
        Record<RoleName, Record<string, boolean>>
    >({
        master_admin: {},
        admin: {},
        usuario: {},
    });
    const [selectedPermissionRole, setSelectedPermissionRole] =
        useState<RoleName>('admin');

    async function load(): Promise<void> {
        setLoading(true);
        setNotification(null);

        try {
            const [usersResponse, colaboradoresResponse, permissionsResponse] = await Promise.all([
                apiGet<WrappedResponse<RegistryUser[]>>('/registry/users'),
                apiGet<PaginatedCollaborators>(
                    '/registry/colaboradores?active=1&per_page=100',
                ),
                apiGet<RolePermissionResponse>('/registry/role-permissions'),
            ]);

            setItems(usersResponse.data);
            setColaboradores(colaboradoresResponse.data);
            setPermissionRoles(permissionsResponse.roles);
            setPermissionSections(permissionsResponse.sections);
            setPermissionsByRole(permissionsResponse.permissions_by_role);
        } catch (error) {
            if (error instanceof ApiError && error.status === 403) {
                setNotification({
                    message:
                        'Apenas Master Admin pode visualizar e cadastrar usuários.',
                    variant: 'error',
                });
            } else {
                setNotification({
                    message: 'Não foi possível carregar os usuários.',
                    variant: 'error',
                });
            }
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

    function openEditDialog(item: RegistryUser): void {
        setEditingItem(item);
        setFormData({
            name: item.name,
            email: item.email,
            password: '',
            password_confirmation: '',
            role: item.role,
            colaborador_id: item.colaborador
                ? String(item.colaborador.id)
                : 'none',
        });
        setFormOpen(true);
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setSaving(true);
        setNotification(null);

        try {
            const payload = {
                name: formData.name.trim(),
                email: formData.email.trim(),
                role: formData.role,
                colaborador_id:
                    formData.colaborador_id === 'none'
                        ? null
                        : Number(formData.colaborador_id),
                ...(formData.password
                    ? {
                          password: formData.password,
                          password_confirmation: formData.password_confirmation,
                      }
                    : {}),
            };

            if (editingItem) {
                await apiPut(`/registry/users/${editingItem.id}`, payload);
            } else {
                await apiPost('/registry/users', payload);
            }

            setNotification({
                message: editingItem
                    ? 'Usuário atualizado com sucesso.'
                    : 'Usuário cadastrado com sucesso.',
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
                    message: 'Não foi possível cadastrar o usuário.',
                    variant: 'error',
                });
            }
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(): Promise<void> {
        if (!deleteCandidate) return;

        setDeleting(true);
        setNotification(null);

        try {
            await apiDelete(`/registry/users/${deleteCandidate.id}`);
            setNotification({
                message: 'Usuário excluído com sucesso.',
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
                    message: 'Não foi possível excluir o usuário.',
                    variant: 'error',
                });
            }
        } finally {
            setDeleting(false);
        }
    }

    function togglePermission(permissionKey: string, checked: boolean): void {
        setPermissionsByRole((previous) => ({
            ...previous,
            [selectedPermissionRole]: {
                ...previous[selectedPermissionRole],
                [permissionKey]: checked,
            },
        }));
    }

    function roleLabel(role: RoleName): string {
        if (role === 'master_admin') return 'Master Admin';
        if (role === 'usuario') return 'Usuário';
        return 'Admin';
    }

    async function handleSavePermissions(): Promise<void> {
        setPermissionsSaving(true);
        setNotification(null);

        try {
            const response = await apiPut<{
                role: RoleName;
                permissions: Record<string, boolean>;
            }>(`/registry/role-permissions/${selectedPermissionRole}`, {
                permissions: permissionsByRole[selectedPermissionRole] ?? {},
            });

            setPermissionsByRole((previous) => ({
                ...previous,
                [response.role]: response.permissions,
            }));

            setNotification({
                message: `Permissões de ${roleLabel(response.role)} atualizadas com sucesso.`,
                variant: 'success',
            });
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({
                    message: error.message,
                    variant: 'error',
                });
            } else {
                setNotification({
                    message: 'Não foi possível salvar as permissões.',
                    variant: 'error',
                });
            }
        } finally {
            setPermissionsSaving(false);
        }
    }

    return (
        <AdminLayout
            title="Cadastro - Usuários"
            active="registry-users"
            module="registry"
        >
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold">
                            Cadastro de Usuários
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Crie acessos ao sistema e vincule ao colaborador
                            quando necessário.
                        </p>
                    </div>
                    <Button type="button" onClick={openCreateDialog}>
                        <PlusSquare className="size-4" />
                        Cadastrar Usuário
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
                        <CardTitle>Permissões por função</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-muted-foreground">
                        <p>
                            Defina exatamente o que cada função da hierarquia
                            pode ver e fazer (painéis, páginas de sidebar,
                            ações e visibilidade de dados de outros usuários).
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPermissionsOpen(true)}
                        >
                            <ShieldCheck className="size-4" />
                            Gerenciar permissões por função
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Usuários ({items.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando usuários...
                            </div>
                        ) : items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Nenhum usuário encontrado.
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
                                                E-mail
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                Perfil
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                Colaborador vinculado
                                            </th>
                                            <th className="py-2 pr-3 text-right font-medium">
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
                                                    {item.name}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {item.email}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {item.role ===
                                                    'master_admin'
                                                        ? 'Master Admin'
                                                                                                                : item.role ===
                                                                                                                        'usuario'
                                                                                                                    ? 'Usuário'
                                                                                                                    : 'Admin'}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {item.colaborador?.nome ??
                                                        '-'}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            title="Editar"
                                                            aria-label="Editar"
                                                            onClick={() =>
                                                                openEditDialog(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            <Pencil className="size-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
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
                            {editingItem
                                ? 'Editar usuário'
                                : 'Cadastrar usuário'}
                        </DialogTitle>
                        <DialogDescription>
                            Apenas Master Admin pode concluir este cadastro.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(event) =>
                                    setFormData((previous) => ({
                                        ...previous,
                                        name: event.target.value,
                                    }))
                                }
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">E-mail *</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(event) =>
                                    setFormData((previous) => ({
                                        ...previous,
                                        email: event.target.value,
                                    }))
                                }
                                required
                            />
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Perfil *</Label>
                                <Select
                                    value={formData.role}
                                    onValueChange={(
                                        value:
                                            | 'master_admin'
                                            | 'admin'
                                            | 'usuario',
                                    ) =>
                                        setFormData((previous) => ({
                                            ...previous,
                                            role: value,
                                        }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin">
                                            Admin
                                        </SelectItem>
                                        <SelectItem value="usuario">
                                            Usuário
                                        </SelectItem>
                                        <SelectItem value="master_admin">
                                            Master Admin
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Colaborador (opcional)</Label>
                                <Select
                                    value={formData.colaborador_id}
                                    onValueChange={(value) =>
                                        setFormData((previous) => ({
                                            ...previous,
                                            colaborador_id: value,
                                        }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            Sem vínculo
                                        </SelectItem>
                                        {colaboradores.map((colaborador) => (
                                            <SelectItem
                                                key={colaborador.id}
                                                value={String(colaborador.id)}
                                            >
                                                {colaborador.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="password">
                                    {editingItem
                                        ? 'Nova senha (opcional)'
                                        : 'Senha *'}
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    minLength={8}
                                    value={formData.password}
                                    onChange={(event) =>
                                        setFormData((previous) => ({
                                            ...previous,
                                            password: event.target.value,
                                        }))
                                    }
                                    required={!editingItem}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password-confirmation">
                                    {editingItem
                                        ? 'Confirmar nova senha'
                                        : 'Confirmar senha *'}
                                </Label>
                                <Input
                                    id="password-confirmation"
                                    type="password"
                                    minLength={8}
                                    value={formData.password_confirmation}
                                    onChange={(event) =>
                                        setFormData((previous) => ({
                                            ...previous,
                                            password_confirmation:
                                                event.target.value,
                                        }))
                                    }
                                    required={!editingItem}
                                />
                            </div>
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
                                disabled={
                                    saving ||
                                    !formData.name ||
                                    !formData.email ||
                                    (!editingItem && !formData.password) ||
                                    (!editingItem &&
                                        !formData.password_confirmation)
                                }
                            >
                                {saving ? (
                                    <>
                                        <LoaderCircle className="size-4 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    editingItem ? 'Atualizar' : 'Salvar'
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
                        <DialogTitle>Excluir usuário</DialogTitle>
                        <DialogDescription>
                            Deseja realmente excluir o usuário{' '}
                            <strong>{deleteCandidate?.name}</strong>?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setPermissionsOpen(false);
                                router.visit('/transport/home');
                            }}
                        >
                            Ver painéis na Home
                        </Button>
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
                            onClick={handleDelete}
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

            <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
                <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Permissões por função</DialogTitle>
                        <DialogDescription>
                            Marque manualmente tudo que o cargo selecionado pode
                            ver e executar no sistema.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                        <div className="space-y-2">
                            <Label>Função</Label>
                            <Select
                                value={selectedPermissionRole}
                                onValueChange={(value) =>
                                    setSelectedPermissionRole(value as RoleName)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {permissionRoles.map((role) => (
                                        <SelectItem key={role} value={role}>
                                            {roleLabel(role)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {permissionSections.map((section) => (
                            <Card key={section.key}>
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        {section.label}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {section.groups.map((group) => (
                                        <div key={group.key} className="space-y-2">
                                            <p className="text-sm font-medium">
                                                {group.label}
                                            </p>
                                            <div className="grid gap-2 md:grid-cols-2">
                                                {group.items.map((item) => (
                                                    <label
                                                        key={item.key}
                                                        className="flex items-start gap-2 rounded-md border p-2"
                                                    >
                                                        <Checkbox
                                                            checked={Boolean(
                                                                permissionsByRole[
                                                                    selectedPermissionRole
                                                                ]?.[item.key],
                                                            )}
                                                            onCheckedChange={(
                                                                checked,
                                                            ) =>
                                                                togglePermission(
                                                                    item.key,
                                                                    Boolean(
                                                                        checked,
                                                                    ),
                                                                )
                                                            }
                                                        />
                                                        <span className="text-sm leading-5">
                                                            {item.label}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPermissionsOpen(false)}
                        >
                            Fechar
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSavePermissions}
                            disabled={permissionsSaving}
                        >
                            {permissionsSaving ? (
                                <>
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                'Salvar permissões'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
