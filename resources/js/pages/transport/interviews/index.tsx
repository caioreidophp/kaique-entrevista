import { Link } from '@inertiajs/react';
import { Eye, LoaderCircle, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { ApiError, apiDelete, apiGet, apiPatch } from '@/lib/api-client';
import { formatDateBR } from '@/lib/transport-format';
import { fetchCurrentUser, getStoredUser } from '@/lib/transport-session';
import type {
    ApiPaginatedResponse,
    DriverInterviewListItem,
    GuepStatus,
    HrStatus,
    InterviewCurriculumStatus,
} from '@/types/driver-interview';

function hrStatusLabel(status: HrStatus): string {
    if (status === 'aprovado') return 'Aprovado';
    if (status === 'reprovado') return 'Reprovado';
    if (status === 'em_analise') return 'Em análise';
    if (status === 'aguardando_vaga') return 'Aguardando vaga';
    if (status === 'guep') return 'GUEP';
    return 'Teste prático';
}

function guepStatusLabel(status: GuepStatus): string {
    if (status === 'nao_fazer') return 'Não fazer';
    if (status === 'a_fazer') return 'A fazer';
    if (status === 'aprovado') return 'Aprovado';
    if (status === 'reprovado') return 'Reprovado';
    return 'Aguardando';
}

function hrStatusBadgeClass(status: HrStatus): string {
    if (status === 'aprovado') return 'transport-status-success';
    if (status === 'reprovado') return 'transport-status-danger';
    if (status === 'em_analise' || status === 'aguardando_vaga') return 'transport-status-warning';
    return 'transport-status-info';
}

function guepStatusBadgeClass(status: GuepStatus): string {
    if (status === 'aprovado') return 'transport-status-success';
    if (status === 'reprovado' || status === 'nao_fazer') return 'transport-status-danger';
    if (status === 'a_fazer') return 'transport-status-warning';
    return 'transport-status-info';
}

function guepStatusSelectClass(status: GuepStatus): string {
    if (status === 'aprovado') return 'border-green-300 bg-green-50 text-green-700';
    if (status === 'reprovado' || status === 'nao_fazer') return 'border-red-300 bg-red-50 text-red-700';
    if (status === 'a_fazer') return 'border-yellow-300 bg-yellow-50 text-yellow-700';
    return 'border-blue-300 bg-blue-50 text-blue-700';
}

function hrStatusSelectClass(status: HrStatus): string {
    if (status === 'aprovado') return 'border-green-300 bg-green-50 text-green-700';
    if (status === 'reprovado') return 'border-red-300 bg-red-50 text-red-700';
    if (status === 'em_analise' || status === 'aguardando_vaga') return 'border-yellow-300 bg-yellow-50 text-yellow-700';
    return 'border-blue-300 bg-blue-50 text-blue-700';
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

const hrStatusOptions: { value: HrStatus; label: string }[] = [
    { value: 'aprovado', label: 'Aprovado' },
    { value: 'reprovado', label: 'Reprovado' },
    { value: 'em_analise', label: 'Em análise' },
    { value: 'aguardando_vaga', label: 'Aguardando vaga' },
    { value: 'guep', label: 'GUEP' },
    { value: 'teste_pratico', label: 'Teste prático' },
];

const guepStatusOptions: { value: GuepStatus; label: string }[] = [
    { value: 'aguardando', label: 'Aguardando' },
    { value: 'a_fazer', label: 'A fazer' },
    { value: 'aprovado', label: 'Aprovado' },
    { value: 'reprovado', label: 'Reprovado' },
    { value: 'nao_fazer', label: 'Não fazer' },
];

export default function TransportInterviewsListPage() {
    const [items, setItems] = useState<DriverInterviewListItem[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const [nameFilter, setNameFilter, resetNameFilter] = usePersistedState(
        'transport:interviews:nameFilter',
        '',
    );
    const [statusFilter, setStatusFilter, resetStatusFilter] =
        usePersistedState<string>('transport:interviews:statusFilter', 'all');
    const [authorFilter, setAuthorFilter, resetAuthorFilter] =
        usePersistedState('transport:interviews:authorFilter', '');
    const [dateFromFilter, setDateFromFilter, resetDateFromFilter] =
        usePersistedState('transport:interviews:dateFromFilter', '');
    const [dateToFilter, setDateToFilter, resetDateToFilter] =
        usePersistedState('transport:interviews:dateToFilter', '');
    const [deleteCandidate, setDeleteCandidate] =
        useState<DriverInterviewListItem | null>(null);
    const [viewerRole, setViewerRole] = useState<
        'master_admin' | 'admin' | 'usuario'
    >('admin');
    const [viewerId, setViewerId] = useState<number | null>(null);
    const [updatingKey, setUpdatingKey] = useState<string | null>(null);
    const [rejectionDialog, setRejectionDialog] = useState<{
        item: DriverInterviewListItem;
        reason: string;
    } | null>(null);

    const isMasterAdmin = viewerRole === 'master_admin';

    function applyDatePreset(days: 7 | 30 | 90): void {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days + 1);

        const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

        setDateFromFilter(toIsoDate(start));
        setDateToFilter(toIsoDate(end));
    }

    function buildQuery(page: number): string {
        const query = new URLSearchParams();
        query.set('page', String(page));
        query.set('per_page', '10');

        if (nameFilter.trim()) query.set('name', nameFilter.trim());
        if (statusFilter !== 'all') query.set('status', statusFilter);
        if (authorFilter.trim() && isMasterAdmin) {
            query.set('author_id', authorFilter.trim());
        }
        if (dateFromFilter) query.set('date_from', dateFromFilter);
        if (dateToFilter) query.set('date_to', dateToFilter);

        return query.toString();
    }

    async function load(page = 1): Promise<void> {
        setLoading(true);
        setNotification(null);

        try {
            const response = await apiGet<
                ApiPaginatedResponse<DriverInterviewListItem>
            >(`/driver-interviews?${buildQuery(page)}`);
            setItems(response.data);
            setCurrentPage(response.meta.current_page);
            setLastPage(response.meta.last_page);
        } catch {
            setNotification({
                message: 'Não foi possível carregar as entrevistas.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const stored = getStoredUser();

        if (stored) {
            setViewerRole(stored.role);
            setViewerId(stored.id);
        }

        fetchCurrentUser()
            .then((user) => {
                setViewerRole(user.role);
                setViewerId(user.id);
            })
            .catch(() => undefined);

        load(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function handleDelete(): Promise<void> {
        if (!deleteCandidate) return;

        try {
            await apiDelete(`/driver-interviews/${deleteCandidate.id}`);
            setNotification({
                message: 'Entrevista excluída com sucesso.',
                variant: 'success',
            });
            setDeleteCandidate(null);
            await load(currentPage);
        } catch {
            setNotification({
                message: 'Não foi possível excluir a entrevista.',
                variant: 'error',
            });
        }
    }

    async function handleInlineStatusUpdate(
        item: DriverInterviewListItem,
        patch: Partial<
            Pick<
                DriverInterviewListItem,
                'hr_status' | 'guep_status' | 'hr_rejection_reason'
            >
        >,
        field: 'hr_status' | 'guep_status',
    ): Promise<void> {
        const key = `${item.id}:${field}`;
        setUpdatingKey(key);

        try {
            const response = await apiPatch<{ data: DriverInterviewListItem }>(
                `/driver-interviews/${item.id}/statuses`,
                patch,
            );

            setItems((previous) =>
                previous.map((current) =>
                    current.id === item.id ? response.data : current,
                ),
            );
            setNotification({
                message: 'Status atualizado com sucesso.',
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
                    message: 'Não foi possível atualizar o status.',
                    variant: 'error',
                });
            }
        } finally {
            setUpdatingKey(null);
        }
    }

    async function handleConfirmRejectionReason(): Promise<void> {
        if (!rejectionDialog) {
            return;
        }

        const reason = rejectionDialog.reason.trim();

        if (!reason) {
            setNotification({
                message: 'Informe o motivo da reprovação antes de salvar.',
                variant: 'error',
            });
            return;
        }

        await handleInlineStatusUpdate(
            rejectionDialog.item,
            {
                hr_status: 'reprovado',
                hr_rejection_reason: reason,
            },
            'hr_status',
        );

        setRejectionDialog(null);
    }

    function clearFilters(): void {
        resetNameFilter();
        resetStatusFilter();
        resetAuthorFilter();
        resetDateFromFilter();
        resetDateToFilter();
        void load(1);
    }

    return (
        <AdminLayout title="Entrevistas" active="interviews">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Entrevistas</h2>
                    <p className="text-sm text-muted-foreground">
                        Gerencie entrevistas de motoristas com filtros e
                        paginação.
                    </p>
                </div>

                {notification ? (
                    <Notification
                        message={notification.message}
                        variant={notification.variant}
                    />
                ) : null}

                <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-2 xl:grid-cols-6">
                    <Input
                        placeholder="Buscar por nome"
                        value={nameFilter}
                        onChange={(event) => setNameFilter(event.target.value)}
                    />
                    <Select
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os status</SelectItem>
                            <SelectItem value="aprovado">Aprovado</SelectItem>
                            <SelectItem value="reprovado">Reprovado</SelectItem>
                            <SelectItem value="aguardando_vaga">
                                Aguardando vaga
                            </SelectItem>
                            <SelectItem value="guep">GUEP</SelectItem>
                            <SelectItem value="teste_pratico">
                                Teste prático
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    {isMasterAdmin ? (
                        <Input
                            placeholder="Filtrar por ID do entrevistador"
                            value={authorFilter}
                            onChange={(event) =>
                                setAuthorFilter(event.target.value)
                            }
                        />
                    ) : (
                        <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                            Filtro por entrevistador disponível para master
                            admin
                        </div>
                    )}

                    <Input
                        type="date"
                        value={dateFromFilter}
                        onChange={(event) =>
                            setDateFromFilter(event.target.value)
                        }
                    />
                    <Input
                        type="date"
                        value={dateToFilter}
                        onChange={(event) =>
                            setDateToFilter(event.target.value)
                        }
                    />
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => applyDatePreset(7)}>
                            7 dias
                        </Button>
                        <Button type="button" variant="outline" onClick={() => applyDatePreset(30)}>
                            30 dias
                        </Button>
                        <Button type="button" variant="outline" onClick={() => applyDatePreset(90)}>
                            90 dias
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" onClick={() => load(1)}>
                            Buscar
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={clearFilters}
                        >
                            Limpar
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[1220px] table-fixed text-sm">
                        <thead className="bg-muted/40">
                            <tr>
                                <th className="w-[220px] px-4 py-3 text-left font-medium">
                                    Nome
                                </th>
                                <th className="w-[100px] px-4 py-3 text-left font-medium">
                                    Entrevistador
                                </th>
                                <th className="w-[160px] px-4 py-3 text-left font-medium">
                                    Unidade
                                </th>
                                <th className="w-[132px] px-2 py-3 text-left font-medium">
                                    Status GUEP
                                </th>
                                <th className="w-[132px] px-2 py-3 text-left font-medium">
                                    Status RH
                                </th>
                                <th className="w-[90px] px-4 py-3 text-left font-medium">
                                    Data
                                </th>
                                <th className="w-[220px] px-2 py-3 text-left font-medium">
                                    Currículo
                                </th>
                                <th className="w-[210px] px-4 py-3 text-right font-medium">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={8}
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
                                        colSpan={8}
                                        className="px-4 py-8 text-center text-muted-foreground"
                                    >
                                        Nenhuma entrevista encontrada.
                                    </td>
                                </tr>
                            ) : (
                                items.map((item) => (
                                    <tr key={item.id} className="border-t">
                                        {(() => {
                                            const canManage =
                                                viewerRole === 'master_admin' ||
                                                item.author_id === viewerId;

                                            return (
                                                <>
                                                    <td className="px-4 py-3 leading-5 font-medium break-words whitespace-normal">
                                                        {item.full_name}
                                                    </td>
                                                    <td className="overflow-hidden px-4 py-3 text-ellipsis whitespace-nowrap">
                                                        {item.author?.name ??
                                                            '-'}
                                                    </td>
                                                    <td className="overflow-hidden px-4 py-3 text-ellipsis whitespace-nowrap">
                                                        {item.hiring_unidade
                                                            ?.nome ?? '-'}
                                                    </td>
                                                    <td className="px-2 py-3">
                                                        {canManage ? (
                                                            <Select
                                                                value={
                                                                    item.guep_status
                                                                }
                                                                disabled={
                                                                    updatingKey ===
                                                                        `${item.id}:guep_status` ||
                                                                    item.hr_status ===
                                                                        'reprovado'
                                                                }
                                                                onValueChange={(
                                                                    value,
                                                                ) =>
                                                                    handleInlineStatusUpdate(
                                                                        item,
                                                                        {
                                                                            guep_status:
                                                                                value as GuepStatus,
                                                                        },
                                                                        'guep_status',
                                                                    )
                                                                }
                                                            >
                                                                <SelectTrigger
                                                                    className={`h-8 w-full rounded-full px-2.5 ${guepStatusSelectClass(item.guep_status)}`}
                                                                >
                                                                    {updatingKey ===
                                                                    `${item.id}:guep_status` ? (
                                                                        <span className="inline-flex items-center gap-2 text-xs">
                                                                            <LoaderCircle className="size-3 animate-spin" />
                                                                            Salvando...
                                                                        </span>
                                                                    ) : (
                                                                        <SelectValue />
                                                                    )}
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {guepStatusOptions.map(
                                                                        (
                                                                            option,
                                                                        ) => (
                                                                            <SelectItem
                                                                                key={
                                                                                    option.value
                                                                                }
                                                                                value={
                                                                                    option.value
                                                                                }
                                                                            >
                                                                                {
                                                                                    option.label
                                                                                }
                                                                            </SelectItem>
                                                                        ),
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <Badge className={`transport-status-badge ${guepStatusBadgeClass(item.guep_status)}`}>
                                                                {guepStatusLabel(
                                                                    item.guep_status,
                                                                )}
                                                            </Badge>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-3">
                                                        {canManage ? (
                                                            <Select
                                                                value={
                                                                    item.hr_status
                                                                }
                                                                disabled={
                                                                    updatingKey ===
                                                                    `${item.id}:hr_status`
                                                                }
                                                                onValueChange={(
                                                                    value,
                                                                ) => {
                                                                    if (
                                                                        value ===
                                                                        item.hr_status
                                                                    ) {
                                                                        return;
                                                                    }

                                                                    if (
                                                                        value ===
                                                                        'reprovado'
                                                                    ) {
                                                                        setRejectionDialog(
                                                                            {
                                                                                item,
                                                                                reason:
                                                                                    item.hr_rejection_reason ??
                                                                                    '',
                                                                            },
                                                                        );
                                                                        return;
                                                                    }

                                                                    void handleInlineStatusUpdate(
                                                                        item,
                                                                        {
                                                                            hr_status:
                                                                                value as HrStatus,
                                                                            hr_rejection_reason:
                                                                                null,
                                                                        },
                                                                        'hr_status',
                                                                    );
                                                                }
                                                                }
                                                            >
                                                                {item.hr_status ===
                                                                    'reprovado' &&
                                                                item.hr_rejection_reason ? (
                                                                    <Tooltip>
                                                                        <TooltipTrigger
                                                                            asChild
                                                                        >
                                                                            <SelectTrigger
                                                                                className={`h-8 w-full rounded-full px-2.5 ${hrStatusSelectClass(item.hr_status)}`}
                                                                                title={
                                                                                    item.hr_rejection_reason
                                                                                }
                                                                            >
                                                                                {updatingKey ===
                                                                                `${item.id}:hr_status` ? (
                                                                                    <span className="inline-flex items-center gap-2 text-xs">
                                                                                        <LoaderCircle className="size-3 animate-spin" />
                                                                                        Salvando...
                                                                                    </span>
                                                                                ) : (
                                                                                    <SelectValue />
                                                                                )}
                                                                            </SelectTrigger>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            {
                                                                                item.hr_rejection_reason
                                                                            }
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                ) : (
                                                                    <SelectTrigger
                                                                        className={`h-8 w-full rounded-full px-2.5 ${hrStatusSelectClass(item.hr_status)}`}
                                                                    >
                                                                        {updatingKey ===
                                                                        `${item.id}:hr_status` ? (
                                                                            <span className="inline-flex items-center gap-2 text-xs">
                                                                                <LoaderCircle className="size-3 animate-spin" />
                                                                                Salvando...
                                                                            </span>
                                                                        ) : (
                                                                            <SelectValue />
                                                                        )}
                                                                    </SelectTrigger>
                                                                )}
                                                                <SelectContent>
                                                                    {hrStatusOptions.map(
                                                                        (
                                                                            option,
                                                                        ) => (
                                                                            <SelectItem
                                                                                key={
                                                                                    option.value
                                                                                }
                                                                                value={
                                                                                    option.value
                                                                                }
                                                                            >
                                                                                {
                                                                                    option.label
                                                                                }
                                                                            </SelectItem>
                                                                        ),
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            item.hr_status ===
                                                                'reprovado' &&
                                                            item.hr_rejection_reason ? (
                                                                <Tooltip>
                                                                    <TooltipTrigger
                                                                        asChild
                                                                    >
                                                                        <Badge
                                                                            className={`transport-status-badge ${hrStatusBadgeClass(item.hr_status)}`}
                                                                            title={
                                                                                item.hr_rejection_reason
                                                                            }
                                                                        >
                                                                            {hrStatusLabel(
                                                                                item.hr_status,
                                                                            )}
                                                                        </Badge>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        {
                                                                            item.hr_rejection_reason
                                                                        }
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            ) : (
                                                                <Badge className={`transport-status-badge ${hrStatusBadgeClass(item.hr_status)}`}>
                                                                    {hrStatusLabel(
                                                                        item.hr_status,
                                                                    )}
                                                                </Badge>
                                                            )
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        {formatDateBR(item.created_at)}
                                                    </td>
                                                    <td className="px-2 py-3">
                                                        {item.curriculum ? (
                                                            <div className="space-y-1">
                                                                <p className="truncate text-xs font-medium">
                                                                    {item.curriculum.full_name}
                                                                </p>
                                                                <Badge
                                                                    className={`transport-status-badge ${curriculumStatusBadgeClass(item.curriculum.status)}`}
                                                                >
                                                                    {curriculumStatusLabel(
                                                                        item.curriculum.status,
                                                                    )}
                                                                </Badge>
                                                            </div>
                                                        ) : (
                                                            <Badge className="transport-status-badge transport-status-warning">
                                                                Sem vínculo
                                                            </Badge>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="px-2"
                                                                title="Ver"
                                                                aria-label="Ver"
                                                                disabled={
                                                                    !canManage
                                                                }
                                                                asChild={
                                                                    canManage
                                                                }
                                                            >
                                                                {canManage ? (
                                                                    <Link
                                                                        href={`/transport/interviews/${item.id}`}
                                                                    >
                                                                        <Eye className="size-4" />
                                                                    </Link>
                                                                ) : (
                                                                    <span>
                                                                        <Eye className="size-4" />
                                                                    </span>
                                                                )}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="px-2"
                                                                title="Editar"
                                                                aria-label="Editar"
                                                                disabled={
                                                                    !canManage
                                                                }
                                                                asChild={
                                                                    canManage
                                                                }
                                                            >
                                                                {canManage ? (
                                                                    <Link
                                                                        href={`/transport/interviews/${item.id}/edit`}
                                                                    >
                                                                        <Pencil className="size-4" />
                                                                    </Link>
                                                                ) : (
                                                                    <span>
                                                                        <Pencil className="size-4" />
                                                                    </span>
                                                                )}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="px-2 text-destructive hover:text-destructive"
                                                                title="Excluir"
                                                                aria-label="Excluir"
                                                                disabled={
                                                                    !canManage
                                                                }
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
                                                </>
                                            );
                                        })()}
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
                            onClick={() => load(currentPage - 1)}
                        >
                            Anterior
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={currentPage >= lastPage}
                            onClick={() => load(currentPage + 1)}
                        >
                            Próxima
                        </Button>
                    </div>
                </div>
            </div>

            <Dialog
                open={Boolean(deleteCandidate)}
                onOpenChange={(open) => {
                    if (!open) setDeleteCandidate(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar exclusão</DialogTitle>
                        <DialogDescription>
                            Deseja realmente excluir a entrevista de{' '}
                            <strong>{deleteCandidate?.full_name}</strong>?
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
                            onClick={handleDelete}
                        >
                            Excluir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(rejectionDialog)}
                onOpenChange={(open) => {
                    if (!open) {
                        setRejectionDialog(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Motivo da reprovação</DialogTitle>
                        <DialogDescription>
                            Ao marcar como reprovado, informe o motivo para
                            consulta posterior.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Input
                            value={rejectionDialog?.reason ?? ''}
                            onChange={(event) =>
                                setRejectionDialog((previous) =>
                                    previous
                                        ? {
                                              ...previous,
                                              reason: event.target.value,
                                          }
                                        : previous,
                                )
                            }
                            placeholder="Descreva o motivo da reprovação"
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setRejectionDialog(null)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void handleConfirmRejectionReason()}
                            disabled={updatingKey !== null}
                        >
                            Salvar motivo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
