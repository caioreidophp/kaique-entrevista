import { Link } from '@inertiajs/react';
import { LoaderCircle, PencilLine, Plus, Search, Trash2, XCircle } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api-client';
import { formatDateBR } from '@/lib/transport-format';
import type {
    ApiPaginatedResponse,
    InterviewCurriculumListItem,
    InterviewCurriculumStatus,
} from '@/types/driver-interview';

type TabKey = 'pendentes' | 'passados';

interface UnidadeOption {
    id: number;
    nome: string;
}

interface FuncaoOption {
    id: number;
    nome: string;
}

interface WrappedResponse<T> {
    data: T;
}

function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function formatPhoneInput(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11);

    if (digits.length === 0) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function filterOptionNames(options: string[], query: string): string[] {
    const normalizedQuery = normalizeText(query);

    if (!normalizedQuery) {
        return options.slice(0, 8);
    }

    return options
        .filter((item) => normalizeText(item).includes(normalizedQuery))
        .slice(0, 8);
}

function curriculumStatusLabel(status: InterviewCurriculumStatus): string {
    if (status === 'recusado') return 'Recusado';
    if (status === 'aguardando_entrevista') return 'Aguardando - Entrevista';
    if (status === 'aprovado_entrevista') return 'Aprovado - Entrevista';
    if (status === 'reprovado_entrevista') return 'Reprovado - Entrevista';
    return 'Pendente';
}

function curriculumStatusBadgeClass(status: InterviewCurriculumStatus): string {
    if (status === 'aprovado_entrevista') return 'transport-status-success';
    if (status === 'reprovado_entrevista' || status === 'recusado') {
        return 'transport-status-danger';
    }
    if (status === 'aguardando_entrevista') return 'transport-status-info';
    return 'transport-status-warning';
}

export default function TransportInterviewCurriculumsPage() {
    const [activeTab, setActiveTab] = useState<TabKey>('pendentes');
    const [items, setItems] = useState<InterviewCurriculumListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search, 350);

    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const [createOpen, setCreateOpen] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createPhone, setCreatePhone] = useState('');
    const [createRoleName, setCreateRoleName] = useState('');
    const [createUnitName, setCreateUnitName] = useState('');
    const [createRoleQuery, setCreateRoleQuery] = useState('');
    const [createUnitQuery, setCreateUnitQuery] = useState('');
    const [createRoleOptionsOpen, setCreateRoleOptionsOpen] = useState(false);
    const [createUnitOptionsOpen, setCreateUnitOptionsOpen] = useState(false);
    const [createFile, setCreateFile] = useState<File | null>(null);
    const [createCnhFile, setCreateCnhFile] = useState<File | null>(null);
    const [createWorkCardFile, setCreateWorkCardFile] = useState<File | null>(null);
    const [createError, setCreateError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [unidades, setUnidades] = useState<UnidadeOption[]>([]);
    const [funcoes, setFuncoes] = useState<FuncaoOption[]>([]);

    const [refuseTarget, setRefuseTarget] =
        useState<InterviewCurriculumListItem | null>(null);
    const [refusing, setRefusing] = useState(false);
    const [editTarget, setEditTarget] =
        useState<InterviewCurriculumListItem | null>(null);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editRoleName, setEditRoleName] = useState('');
    const [editUnitName, setEditUnitName] = useState('');
    const [editRoleQuery, setEditRoleQuery] = useState('');
    const [editUnitQuery, setEditUnitQuery] = useState('');
    const [editRoleOptionsOpen, setEditRoleOptionsOpen] = useState(false);
    const [editUnitOptionsOpen, setEditUnitOptionsOpen] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [deleteTarget, setDeleteTarget] =
        useState<InterviewCurriculumListItem | null>(null);
    const [deleting, setDeleting] = useState(false);

    const tabTitle = useMemo(() => {
        return activeTab === 'pendentes' ? 'Pendentes' : 'Passados';
    }, [activeTab]);

    const unitNames = useMemo(
        () => unidades.map((item) => item.nome),
        [unidades],
    );

    const roleNames = useMemo(
        () => funcoes.map((item) => item.nome),
        [funcoes],
    );

    const createFilteredUnits = useMemo(
        () => filterOptionNames(unitNames, createUnitQuery),
        [createUnitQuery, unitNames],
    );

    const createFilteredRoles = useMemo(
        () => filterOptionNames(roleNames, createRoleQuery),
        [createRoleQuery, roleNames],
    );

    const editFilteredUnits = useMemo(
        () => filterOptionNames(unitNames, editUnitQuery),
        [editUnitQuery, unitNames],
    );

    const editFilteredRoles = useMemo(
        () => filterOptionNames(roleNames, editRoleQuery),
        [editRoleQuery, roleNames],
    );

    async function load(page = 1): Promise<void> {
        setLoading(true);

        try {
            const query = new URLSearchParams();
            query.set('tab', activeTab);
            query.set('page', String(page));
            query.set('per_page', '10');

            if (debouncedSearch.trim()) {
                query.set('search', debouncedSearch.trim());
            }

            const response = await apiGet<
                ApiPaginatedResponse<InterviewCurriculumListItem>
            >(`/interview-curriculums?${query.toString()}`);

            setItems(response.data);
            setCurrentPage(response.meta.current_page);
            setLastPage(response.meta.last_page);
        } catch {
            setNotification({
                message: 'Não foi possível carregar os currículos.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    async function loadOptions(): Promise<void> {
        try {
            const [unidadesResponse, funcoesResponse] = await Promise.all([
                apiGet<WrappedResponse<UnidadeOption[]>>('/registry/unidades'),
                apiGet<WrappedResponse<FuncaoOption[]>>('/registry/funcoes?active=1'),
            ]);

            setUnidades(unidadesResponse.data ?? []);
            setFuncoes(funcoesResponse.data ?? []);
        } catch {
            setNotification({
                message: 'Não foi possível carregar unidades e funções para o currículo.',
                variant: 'error',
            });
        }
    }

    useEffect(() => {
        void loadOptions();
        void load(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, debouncedSearch]);

    function resetCreateForm(): void {
        setCreateName('');
        setCreatePhone('');
        setCreateRoleName('');
        setCreateUnitName('');
        setCreateRoleQuery('');
        setCreateUnitQuery('');
        setCreateRoleOptionsOpen(false);
        setCreateUnitOptionsOpen(false);
        setCreateFile(null);
        setCreateCnhFile(null);
        setCreateWorkCardFile(null);
        setCreateError(null);
    }

    async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();

        const trimmedName = createName.trim();
        const trimmedPhone = formatPhoneInput(createPhone.trim());
        const trimmedRoleName = createRoleName.trim();
        const trimmedUnitName = createUnitName.trim();

        if (!trimmedName) {
            setCreateError('Informe o nome do candidato.');
            return;
        }

        if (!createFile) {
            setCreateError('Selecione o arquivo do currículo.');
            return;
        }

        if (!trimmedPhone || !trimmedRoleName || !trimmedUnitName) {
            setCreateError('Preencha telefone, função e unidade.');
            return;
        }

        const roleExists = roleNames.some(
            (item) => normalizeText(item) === normalizeText(trimmedRoleName),
        );
        const unitExists = unitNames.some(
            (item) => normalizeText(item) === normalizeText(trimmedUnitName),
        );

        if (!roleExists || !unitExists) {
            setCreateError('Selecione função e unidade a partir das opções cadastradas.');
            return;
        }

        setCreatePhone(trimmedPhone);

        setCreating(true);
        setCreateError(null);

        try {
            const formData = new FormData();
            formData.append('full_name', trimmedName);
            formData.append('phone', trimmedPhone);
            formData.append('role_name', trimmedRoleName);
            formData.append('unit_name', trimmedUnitName);
            formData.append('curriculum_file', createFile);

            if (createCnhFile) {
                formData.append('cnh_attachment_file', createCnhFile);
            }

            if (createWorkCardFile) {
                formData.append('work_card_attachment_file', createWorkCardFile);
            }

            await apiPost('/interview-curriculums', formData);

            setNotification({
                message: 'Currículo cadastrado com sucesso.',
                variant: 'success',
            });

            setCreateOpen(false);
            resetCreateForm();
            setActiveTab('pendentes');
            await load(1);
        } catch (error) {
            if (error instanceof ApiError) {
                setCreateError(error.message);
            } else {
                setCreateError('Não foi possível cadastrar o currículo.');
            }
        } finally {
            setCreating(false);
        }
    }

    async function handleConfirmRefuse(): Promise<void> {
        if (!refuseTarget) {
            return;
        }

        setRefusing(true);

        try {
            await apiPatch(`/interview-curriculums/${refuseTarget.id}/refuse`);
            setNotification({
                message: 'Currículo recusado com sucesso.',
                variant: 'success',
            });
            setRefuseTarget(null);
            await load(1);
        } catch {
            setNotification({
                message: 'Não foi possível recusar este currículo.',
                variant: 'error',
            });
        } finally {
            setRefusing(false);
        }
    }

    function openEditDialog(item: InterviewCurriculumListItem): void {
        setEditTarget(item);
        setEditName(item.full_name);
        setEditPhone(formatPhoneInput(item.phone ?? ''));
        setEditRoleName(item.role_name ?? '');
        setEditUnitName(item.unit_name ?? '');
        setEditRoleQuery(item.role_name ?? '');
        setEditUnitQuery(item.unit_name ?? '');
        setEditRoleOptionsOpen(false);
        setEditUnitOptionsOpen(false);
        setEditError(null);
    }

    async function handleSaveEdit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();

        if (!editTarget) {
            return;
        }

        const maskedPhone = formatPhoneInput(editPhone.trim());

        const payload = {
            full_name: editName.trim(),
            phone: maskedPhone,
            role_name: editRoleName.trim(),
            unit_name: editUnitName.trim(),
        };

        if (!payload.full_name || !payload.phone || !payload.role_name || !payload.unit_name) {
            setEditError('Preencha nome, telefone, função e unidade.');
            return;
        }

        const roleExists = roleNames.some(
            (item) => normalizeText(item) === normalizeText(payload.role_name),
        );
        const unitExists = unitNames.some(
            (item) => normalizeText(item) === normalizeText(payload.unit_name),
        );

        if (!roleExists || !unitExists) {
            setEditError('Selecione função e unidade a partir das opções cadastradas.');
            return;
        }

        setEditPhone(maskedPhone);

        setEditing(true);
        setEditError(null);

        try {
            await apiPut(`/interview-curriculums/${editTarget.id}`, payload);
            setNotification({
                message: 'Currículo atualizado com sucesso.',
                variant: 'success',
            });
            setEditTarget(null);
            await load(currentPage);
        } catch (error) {
            if (error instanceof ApiError) {
                setEditError(error.message);
            } else {
                setEditError('Não foi possível atualizar o currículo.');
            }
        } finally {
            setEditing(false);
        }
    }

    async function handleConfirmDelete(): Promise<void> {
        if (!deleteTarget) {
            return;
        }

        setDeleting(true);

        try {
            await apiDelete(`/interview-curriculums/${deleteTarget.id}`);
            setNotification({
                message: 'Currículo excluído com sucesso.',
                variant: 'success',
            });
            setDeleteTarget(null);
            await load(1);
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({ message: error.message, variant: 'error' });
            } else {
                setNotification({
                    message: 'Não foi possível excluir este currículo.',
                    variant: 'error',
                });
            }
        } finally {
            setDeleting(false);
        }
    }

    return (
        <AdminLayout title="Currículos" active="curriculums">
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold">Currículos</h2>
                        <p className="text-sm text-muted-foreground">
                            Cadastre, acompanhe e recuse currículos antes da entrevista.
                        </p>
                    </div>
                    <Button
                        type="button"
                        onClick={() => {
                            setCreateOpen(true);
                            setCreateError(null);
                        }}
                    >
                        <Plus className="size-4" />
                        Novo currículo
                    </Button>
                </div>

                {notification ? (
                    <Notification
                        message={notification.message}
                        variant={notification.variant}
                    />
                ) : null}

                <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-[1fr_auto]">
                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Buscar por nome"
                            className="pl-9"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant={
                                activeTab === 'pendentes' ? 'default' : 'outline'
                            }
                            onClick={() => setActiveTab('pendentes')}
                        >
                            Pendentes
                        </Button>
                        <Button
                            type="button"
                            variant={
                                activeTab === 'passados' ? 'default' : 'outline'
                            }
                            onClick={() => setActiveTab('passados')}
                        >
                            Passados
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[1300px] text-sm">
                        <thead className="bg-muted/40">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium">Nome</th>
                                <th className="px-4 py-3 text-left font-medium">Telefone</th>
                                <th className="px-4 py-3 text-left font-medium">Função</th>
                                <th className="px-4 py-3 text-left font-medium">Unidade</th>
                                <th className="px-4 py-3 text-left font-medium">Arquivo</th>
                                <th className="px-4 py-3 text-left font-medium">Status</th>
                                <th className="px-4 py-3 text-left font-medium">Anexos</th>
                                <th className="px-4 py-3 text-left font-medium">Entrevista</th>
                                <th className="px-4 py-3 text-left font-medium">Cadastro</th>
                                <th className="px-4 py-3 text-right font-medium">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={10}
                                        className="px-4 py-8 text-center text-muted-foreground"
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <LoaderCircle className="size-4 animate-spin" />
                                            Carregando...
                                        </span>
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={10}
                                        className="px-4 py-8 text-center text-muted-foreground"
                                    >
                                        Nenhum currículo em {tabTitle.toLowerCase()}.
                                    </td>
                                </tr>
                            ) : (
                                items.map((item) => (
                                    <tr key={item.id} className="border-t">
                                        <td className="px-4 py-3 font-medium">{item.full_name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{item.phone ?? '-'}</td>
                                        <td className="px-4 py-3">{item.role_name ?? '-'}</td>
                                        <td className="px-4 py-3">{item.unit_name ?? '-'}</td>
                                        <td className="px-4 py-3">
                                            {item.document_url ? (
                                                <a
                                                    href={item.document_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex max-w-[260px] truncate text-primary hover:underline"
                                                >
                                                    {item.document_original_name}
                                                </a>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge
                                                className={`transport-status-badge ${curriculumStatusBadgeClass(item.status)}`}
                                            >
                                                {curriculumStatusLabel(item.status)}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <Badge variant="outline">{item.attachments_status}</Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.linked_interview ? (
                                                <Link
                                                    href={`/transport/interviews/${item.linked_interview.id}`}
                                                    className="text-primary hover:underline"
                                                >
                                                    {item.linked_interview.full_name}
                                                </Link>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {formatDateBR(item.created_at)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="inline-flex items-center gap-1.5">
                                                {activeTab === 'pendentes' ? (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        title="Recusar"
                                                        onClick={() => setRefuseTarget(item)}
                                                    >
                                                        <XCircle className="size-4" />
                                                    </Button>
                                                ) : null}
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    title="Editar"
                                                    onClick={() => openEditDialog(item)}
                                                >
                                                    <PencilLine className="size-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="icon"
                                                    title="Excluir"
                                                    onClick={() => setDeleteTarget(item)}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Página {currentPage} de {lastPage}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={currentPage <= 1}
                            onClick={() => void load(currentPage - 1)}
                        >
                            Anterior
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={currentPage >= lastPage}
                            onClick={() => void load(currentPage + 1)}
                        >
                            Próxima
                        </Button>
                    </div>
                </div>
            </div>

            <Dialog
                open={createOpen}
                onOpenChange={(open) => {
                    setCreateOpen(open);
                    if (!open) {
                        resetCreateForm();
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo currículo</DialogTitle>
                        <DialogDescription>
                            Informe nome, telefone, função, unidade e o arquivo do currículo.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={(event) => void handleCreate(event)}>
                        <div className="space-y-2">
                            <Label htmlFor="curriculum-name">Nome do candidato</Label>
                            <Input
                                id="curriculum-name"
                                value={createName}
                                onChange={(event) => setCreateName(event.target.value)}
                                placeholder="Ex.: Joao da Silva"
                            />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="curriculum-phone">Telefone</Label>
                                <Input
                                    id="curriculum-phone"
                                    value={createPhone}
                                    onChange={(event) =>
                                        setCreatePhone(formatPhoneInput(event.target.value))
                                    }
                                    placeholder="Ex.: (11) 99999-9999"
                                />
                            </div>
                            <div className="relative space-y-2">
                                <Label htmlFor="curriculum-role">Função</Label>
                                <Input
                                    id="curriculum-role"
                                    value={createRoleQuery}
                                    onChange={(event) => {
                                        setCreateRoleQuery(event.target.value);
                                        setCreateRoleName('');
                                        setCreateRoleOptionsOpen(true);
                                    }}
                                    onFocus={() => setCreateRoleOptionsOpen(true)}
                                    onBlur={() => {
                                        window.setTimeout(
                                            () => setCreateRoleOptionsOpen(false),
                                            120,
                                        );
                                    }}
                                    placeholder="Digite para buscar função"
                                />
                                {createRoleOptionsOpen && createFilteredRoles.length > 0 ? (
                                    <div className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border shadow-md">
                                        {createFilteredRoles.map((option) => (
                                            <button
                                                key={`create-role-${option}`}
                                                type="button"
                                                className="hover:bg-muted block w-full px-3 py-2 text-left text-sm"
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    setCreateRoleName(option);
                                                    setCreateRoleQuery(option);
                                                    setCreateRoleOptionsOpen(false);
                                                }}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                        <div className="relative space-y-2">
                            <Label htmlFor="curriculum-unit">Unidade</Label>
                            <Input
                                id="curriculum-unit"
                                value={createUnitQuery}
                                onChange={(event) => {
                                    setCreateUnitQuery(event.target.value);
                                    setCreateUnitName('');
                                    setCreateUnitOptionsOpen(true);
                                }}
                                onFocus={() => setCreateUnitOptionsOpen(true)}
                                onBlur={() => {
                                    window.setTimeout(
                                        () => setCreateUnitOptionsOpen(false),
                                        120,
                                    );
                                }}
                                placeholder="Digite para buscar unidade"
                            />
                            {createUnitOptionsOpen && createFilteredUnits.length > 0 ? (
                                <div className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border shadow-md">
                                    {createFilteredUnits.map((option) => (
                                        <button
                                            key={`create-unit-${option}`}
                                            type="button"
                                            className="hover:bg-muted block w-full px-3 py-2 text-left text-sm"
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                setCreateUnitName(option);
                                                setCreateUnitQuery(option);
                                                setCreateUnitOptionsOpen(false);
                                            }}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="curriculum-file">Arquivo do currículo</Label>
                            <Input
                                id="curriculum-file"
                                type="file"
                                accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/jpg"
                                onChange={(event) =>
                                    setCreateFile(event.target.files?.[0] ?? null)
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Formatos aceitos: PDF, DOC, DOCX e JPEG (max. 10 MB).
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="curriculum-cnh-file">Anexo CNH (opcional)</Label>
                                <Input
                                    id="curriculum-cnh-file"
                                    type="file"
                                    accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                                    onChange={(event) =>
                                        setCreateCnhFile(
                                            event.target.files?.[0] ?? null,
                                        )
                                    }
                                />
                                <p className="text-xs text-muted-foreground">
                                    JPG, PNG, WEBP ou PDF (max. 8 MB).
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="curriculum-work-card-file">
                                    Carteira de Trabalho (opcional)
                                </Label>
                                <Input
                                    id="curriculum-work-card-file"
                                    type="file"
                                    accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                                    onChange={(event) =>
                                        setCreateWorkCardFile(
                                            event.target.files?.[0] ?? null,
                                        )
                                    }
                                />
                                <p className="text-xs text-muted-foreground">
                                    JPG, PNG, WEBP ou PDF (max. 8 MB).
                                </p>
                            </div>
                        </div>

                        {createError ? (
                            <Notification message={createError} variant="error" />
                        ) : null}

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCreateOpen(false)}
                                disabled={creating}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={creating}>
                                {creating ? (
                                    <>
                                        <LoaderCircle className="size-4 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    'Cadastrar'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(refuseTarget)}
                onOpenChange={(open) => {
                    if (!open) {
                        setRefuseTarget(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar recusa</DialogTitle>
                        <DialogDescription>
                            Deseja mover o currículo de{' '}
                            <strong>{refuseTarget?.full_name}</strong> para passados
                            como recusado?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setRefuseTarget(null)}
                            disabled={refusing}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => void handleConfirmRefuse()}
                            disabled={refusing}
                        >
                            {refusing ? (
                                <>
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Recusando...
                                </>
                            ) : (
                                'Recusar'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(editTarget)}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditTarget(null);
                        setEditError(null);
                        setEditRoleQuery('');
                        setEditUnitQuery('');
                        setEditRoleOptionsOpen(false);
                        setEditUnitOptionsOpen(false);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar currículo</DialogTitle>
                        <DialogDescription>
                            Atualize os dados principais do currículo.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={(event) => void handleSaveEdit(event)}>
                        <div className="space-y-2">
                            <Label htmlFor="edit-curriculum-name">Nome do candidato</Label>
                            <Input
                                id="edit-curriculum-name"
                                value={editName}
                                onChange={(event) => setEditName(event.target.value)}
                            />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="edit-curriculum-phone">Telefone</Label>
                                <Input
                                    id="edit-curriculum-phone"
                                    value={editPhone}
                                    onChange={(event) =>
                                        setEditPhone(formatPhoneInput(event.target.value))
                                    }
                                />
                            </div>
                            <div className="relative space-y-2">
                                <Label htmlFor="edit-curriculum-role">Função</Label>
                                <Input
                                    id="edit-curriculum-role"
                                    value={editRoleQuery}
                                    onChange={(event) => {
                                        setEditRoleQuery(event.target.value);
                                        setEditRoleName('');
                                        setEditRoleOptionsOpen(true);
                                    }}
                                    onFocus={() => setEditRoleOptionsOpen(true)}
                                    onBlur={() => {
                                        window.setTimeout(
                                            () => setEditRoleOptionsOpen(false),
                                            120,
                                        );
                                    }}
                                />
                                {editRoleOptionsOpen && editFilteredRoles.length > 0 ? (
                                    <div className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border shadow-md">
                                        {editFilteredRoles.map((option) => (
                                            <button
                                                key={`edit-role-${option}`}
                                                type="button"
                                                className="hover:bg-muted block w-full px-3 py-2 text-left text-sm"
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    setEditRoleName(option);
                                                    setEditRoleQuery(option);
                                                    setEditRoleOptionsOpen(false);
                                                }}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                        <div className="relative space-y-2">
                            <Label htmlFor="edit-curriculum-unit">Unidade</Label>
                            <Input
                                id="edit-curriculum-unit"
                                value={editUnitQuery}
                                onChange={(event) => {
                                    setEditUnitQuery(event.target.value);
                                    setEditUnitName('');
                                    setEditUnitOptionsOpen(true);
                                }}
                                onFocus={() => setEditUnitOptionsOpen(true)}
                                onBlur={() => {
                                    window.setTimeout(
                                        () => setEditUnitOptionsOpen(false),
                                        120,
                                    );
                                }}
                            />
                            {editUnitOptionsOpen && editFilteredUnits.length > 0 ? (
                                <div className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border shadow-md">
                                    {editFilteredUnits.map((option) => (
                                        <button
                                            key={`edit-unit-${option}`}
                                            type="button"
                                            className="hover:bg-muted block w-full px-3 py-2 text-left text-sm"
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                setEditUnitName(option);
                                                setEditUnitQuery(option);
                                                setEditUnitOptionsOpen(false);
                                            }}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>

                        {editError ? (
                            <Notification message={editError} variant="error" />
                        ) : null}

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditTarget(null)}
                                disabled={editing}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={editing}>
                                {editing ? (
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
                        <DialogTitle>Excluir currículo</DialogTitle>
                        <DialogDescription>
                            Confirmar exclusão do currículo de <strong>{deleteTarget?.full_name}</strong>?
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
                            onClick={() => void handleConfirmDelete()}
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
