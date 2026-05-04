import { Link } from '@inertiajs/react';
import { LoaderCircle, PencilLine, Plus, Printer, Search, Trash2, XCircle } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api-client';
import { formatDateBR } from '@/lib/transport-format';
import type {
    ApiPaginatedResponse,
    InterviewCandidateListGroup,
    InterviewCurriculumListItem,
    InterviewCurriculumStatus,
} from '@/types/driver-interview';

type TabKey = 'pendentes' | 'passados' | 'lista-candidatos';

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

interface CandidateListResponse {
    filters: {
        role_name: string | null;
        unit_name: string | null;
        interview_date: string | null;
    };
    total_candidates: number;
    groups: InterviewCandidateListGroup[];
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

function normalizeTreatmentStatus(status: InterviewCurriculumStatus): 'pendente' | 'convocado_entrevista' | 'descartado' {
    if (['convocado_entrevista', 'aguardando_entrevista', 'aprovado_entrevista'].includes(status)) {
        return 'convocado_entrevista';
    }

    if (['descartado', 'recusado', 'reprovado_entrevista'].includes(status)) {
        return 'descartado';
    }

    return 'pendente';
}

function curriculumStatusLabel(status: InterviewCurriculumStatus): string {
    if (['convocado_entrevista', 'aguardando_entrevista', 'aprovado_entrevista'].includes(status)) {
        return 'Convocado para entrevista';
    }

    if (['descartado', 'recusado', 'reprovado_entrevista'].includes(status)) {
        return 'Descartado';
    }

    return 'Pendente';
}

function curriculumStatusBadgeClass(status: InterviewCurriculumStatus): string {
    if (['convocado_entrevista', 'aguardando_entrevista', 'aprovado_entrevista'].includes(status)) {
        return 'transport-status-info';
    }

    if (['descartado', 'recusado', 'reprovado_entrevista'].includes(status)) {
        return 'transport-status-danger';
    }

    return 'transport-status-warning';
}

function formatInterviewTime(value: string | null | undefined): string {
    if (!value) return '-';
    return value.slice(0, 5);
}

export default function TransportInterviewCurriculumsPage() {
    const [activeTab, setActiveTab] = useState<TabKey>('pendentes');
    const [items, setItems] = useState<InterviewCurriculumListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [candidateGroups, setCandidateGroups] = useState<InterviewCandidateListGroup[]>([]);
    const [candidateTotal, setCandidateTotal] = useState(0);
    const [candidateLoading, setCandidateLoading] = useState(false);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search, 350);
    const [functionFilter, setFunctionFilter] = useState('all');
    const [unitFilter, setUnitFilter] = useState('all');
    const [interviewDateFilter, setInterviewDateFilter] = useState('');

    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const [createOpen, setCreateOpen] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createPhone, setCreatePhone] = useState('');
    const [createRoleName, setCreateRoleName] = useState('none');
    const [createUnitName, setCreateUnitName] = useState('none');
    const [createFile, setCreateFile] = useState<File | null>(null);
    const [createCnhFile, setCreateCnhFile] = useState<File | null>(null);
    const [createWorkCardFile, setCreateWorkCardFile] = useState<File | null>(null);
    const [createError, setCreateError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [unidades, setUnidades] = useState<UnidadeOption[]>([]);
    const [funcoes, setFuncoes] = useState<FuncaoOption[]>([]);

    const [refuseTarget, setRefuseTarget] = useState<InterviewCurriculumListItem | null>(null);
    const [refusing, setRefusing] = useState(false);
    const [editTarget, setEditTarget] = useState<InterviewCurriculumListItem | null>(null);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editRoleName, setEditRoleName] = useState('none');
    const [editUnitName, setEditUnitName] = useState('none');
    const [editObservation, setEditObservation] = useState('');
    const [editStatus, setEditStatus] = useState<'pendente' | 'convocado_entrevista' | 'descartado'>('pendente');
    const [editInterviewDate, setEditInterviewDate] = useState('');
    const [editInterviewTime, setEditInterviewTime] = useState('');
    const [editDiscardReason, setEditDiscardReason] = useState('');
    const [editTreatmentNotes, setEditTreatmentNotes] = useState('');
    const [editConfirmedInterviewDate, setEditConfirmedInterviewDate] = useState('');
    const [editConfirmedInterviewTime, setEditConfirmedInterviewTime] = useState('');
    const [editConfirmationNotes, setEditConfirmationNotes] = useState('');
    const [editError, setEditError] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<InterviewCurriculumListItem | null>(null);
    const [deleting, setDeleting] = useState(false);

    const unitNames = useMemo(
        () => unidades.map((item) => item.nome),
        [unidades],
    );

    const roleNames = useMemo(
        () => funcoes.map((item) => item.nome),
        [funcoes],
    );

    const filteredCandidateGroups = useMemo(() => {
        const normalizedSearch = normalizeText(debouncedSearch);

        return candidateGroups
            .map((group) => {
                const items = group.items.filter((item) => {
                    if (!normalizedSearch) return true;

                    return normalizeText(
                        `${item.full_name} ${item.role_name ?? ''} ${item.unit_name ?? ''} ${item.phone ?? ''}`,
                    ).includes(normalizedSearch);
                });

                return {
                    ...group,
                    items,
                    total: items.length,
                };
            })
            .filter((group) => group.items.length > 0);
    }, [candidateGroups, debouncedSearch]);

    async function load(page = 1): Promise<void> {
        setLoading(true);

        try {
            const query = new URLSearchParams();
            query.set('tab', activeTab === 'pendentes' ? 'pendentes' : 'passados');
            query.set('page', String(page));
            query.set('per_page', '10');

            if (debouncedSearch.trim()) {
                query.set('search', debouncedSearch.trim());
            }

            if (functionFilter !== 'all') {
                query.set('role_name', functionFilter);
            }

            if (unitFilter !== 'all') {
                query.set('unit_name', unitFilter);
            }

            if (interviewDateFilter) {
                query.set('interview_date_from', interviewDateFilter);
                query.set('interview_date_to', interviewDateFilter);
            }

            const response = await apiGet<ApiPaginatedResponse<InterviewCurriculumListItem>>(
                `/interview-curriculums?${query.toString()}`,
            );

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

    async function loadCandidateList(): Promise<void> {
        setCandidateLoading(true);

        try {
            const query = new URLSearchParams();

            if (functionFilter !== 'all') {
                query.set('role_name', functionFilter);
            }

            if (unitFilter !== 'all') {
                query.set('unit_name', unitFilter);
            }

            if (interviewDateFilter) {
                query.set('interview_date', interviewDateFilter);
            }

            const response = await apiGet<CandidateListResponse>(
                `/interview-curriculums/candidate-list?${query.toString()}`,
            );

            setCandidateGroups(response.groups ?? []);
            setCandidateTotal(response.total_candidates ?? 0);
        } catch {
            setNotification({
                message: 'Não foi possível carregar a lista de candidatos convocados.',
                variant: 'error',
            });
        } finally {
            setCandidateLoading(false);
        }
    }

    async function loadOptions(): Promise<void> {
        try {
            const [unidadesResponse, funcoesResponse] = await Promise.all([
                apiGet<WrappedResponse<UnidadeOption[]>>('/registry/unidades?include_inactive=1'),
                apiGet<WrappedResponse<FuncaoOption[]>>('/registry/funcoes?active=1'),
            ]);

            setUnidades(unidadesResponse.data ?? []);
            setFuncoes(funcoesResponse.data ?? []);
        } catch {
            setNotification({
                message: 'Não foi possível carregar unidades e funções.',
                variant: 'error',
            });
        }
    }

    useEffect(() => {
        void loadOptions();
    }, []);

    useEffect(() => {
        if (activeTab === 'lista-candidatos') {
            void loadCandidateList();
            return;
        }

        void load(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, debouncedSearch, functionFilter, unitFilter, interviewDateFilter]);

    function resetCreateForm(): void {
        setCreateName('');
        setCreatePhone('');
        setCreateRoleName('none');
        setCreateUnitName('none');
        setCreateFile(null);
        setCreateCnhFile(null);
        setCreateWorkCardFile(null);
        setCreateError(null);
    }

    async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();

        const trimmedName = createName.trim();
        const trimmedPhone = formatPhoneInput(createPhone.trim());

        if (!trimmedName) {
            setCreateError('Informe o nome do candidato.');
            return;
        }

        if (!createFile) {
            setCreateError('Selecione o arquivo do currículo.');
            return;
        }

        if (!trimmedPhone || createRoleName === 'none' || createUnitName === 'none') {
            setCreateError('Preencha telefone, função e unidade.');
            return;
        }

        setCreating(true);
        setCreateError(null);

        try {
            const formData = new FormData();
            formData.append('full_name', trimmedName);
            formData.append('phone', trimmedPhone);
            formData.append('role_name', createRoleName);
            formData.append('unit_name', createUnitName);
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

            if (activeTab === 'lista-candidatos') {
                await loadCandidateList();
            } else {
                await load(1);
            }
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
        setEditRoleName(item.role_name ?? 'none');
        setEditUnitName(item.unit_name ?? 'none');
        setEditObservation(item.observacao ?? '');
        setEditStatus(normalizeTreatmentStatus(item.status));
        setEditInterviewDate(item.interview_date ?? '');
        setEditInterviewTime(item.interview_time ? item.interview_time.slice(0, 5) : '');
        setEditDiscardReason(item.discard_reason ?? '');
        setEditTreatmentNotes(item.treatment_notes ?? '');
        setEditConfirmedInterviewDate(item.confirmed_interview_date ?? '');
        setEditConfirmedInterviewTime(
            item.confirmed_interview_time ? item.confirmed_interview_time.slice(0, 5) : '',
        );
        setEditConfirmationNotes(item.confirmation_notes ?? '');
        setEditError(null);
    }

    async function handleSaveEdit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();

        if (!editTarget) {
            return;
        }

        const payload = {
            full_name: editName.trim(),
            phone: formatPhoneInput(editPhone.trim()),
            role_name: editRoleName === 'none' ? '' : editRoleName.trim(),
            unit_name: editUnitName === 'none' ? '' : editUnitName.trim(),
            observacao: editObservation.trim() || null,
            status: editStatus,
            interview_date: editStatus === 'convocado_entrevista' ? (editInterviewDate || null) : null,
            interview_time: editStatus === 'convocado_entrevista' ? (editInterviewTime || null) : null,
            discard_reason: editStatus === 'descartado' ? (editDiscardReason.trim() || null) : null,
            treatment_notes: editTreatmentNotes.trim() || null,
            confirmed_interview_date: editConfirmedInterviewDate || null,
            confirmed_interview_time: editConfirmedInterviewTime || null,
            confirmation_notes: editConfirmationNotes.trim() || null,
        };

        if (!payload.full_name || !payload.phone || !payload.role_name || !payload.unit_name) {
            setEditError('Preencha nome, telefone, função e unidade.');
            return;
        }

        if (payload.status === 'convocado_entrevista' && !payload.interview_date) {
            setEditError('Informe a data da entrevista para candidatos convocados.');
            return;
        }

        if (payload.status === 'descartado' && !payload.discard_reason) {
            setEditError('Informe o motivo do descarte.');
            return;
        }

        setEditing(true);
        setEditError(null);

        try {
            await apiPut(`/interview-curriculums/${editTarget.id}`, payload);
            setNotification({
                message: 'Currículo atualizado com sucesso.',
                variant: 'success',
            });
            setEditTarget(null);

            if (activeTab === 'lista-candidatos') {
                await loadCandidateList();
            } else {
                await load(currentPage);
            }
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

            if (activeTab === 'lista-candidatos') {
                await loadCandidateList();
            } else {
                await load(1);
            }
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

    function clearFilters(): void {
        setSearch('');
        setFunctionFilter('all');
        setUnitFilter('all');
        setInterviewDateFilter('');
    }

    return (
        <AdminLayout title="Currículos" active="curriculums">
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold">Currículos</h2>
                        <p className="text-sm text-muted-foreground">
                            Trate candidatos por status, convoque para entrevista e organize a lista por data.
                        </p>
                    </div>
                    <div className="flex gap-2 print:hidden">
                        {activeTab === 'lista-candidatos' ? (
                            <Button type="button" variant="outline" onClick={() => window.print()}>
                                <Printer className="size-4" />
                                Imprimir lista
                            </Button>
                        ) : null}
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
                </div>

                {notification ? <Notification message={notification.message} variant={notification.variant} /> : null}

                <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-5 print:hidden">
                    <div className="relative md:col-span-2">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Buscar por nome, função, unidade ou telefone"
                            className="pl-9"
                        />
                    </div>
                    <Select value={functionFilter} onValueChange={setFunctionFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Todas as funções" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as funções</SelectItem>
                            {roleNames.map((roleName) => (
                                <SelectItem key={`filter-role-${roleName}`} value={roleName}>
                                    {roleName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={unitFilter} onValueChange={setUnitFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Todas as unidades" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as unidades</SelectItem>
                            {unitNames.map((unitName) => (
                                <SelectItem key={`filter-unit-${unitName}`} value={unitName}>
                                    {unitName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        type="date"
                        value={interviewDateFilter}
                        onChange={(event) => setInterviewDateFilter(event.target.value)}
                        placeholder="Data da entrevista"
                    />
                </div>

                <div className="flex flex-wrap gap-2 print:hidden">
                    <Button
                        type="button"
                        variant={activeTab === 'pendentes' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('pendentes')}
                    >
                        Pendentes
                    </Button>
                    <Button
                        type="button"
                        variant={activeTab === 'passados' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('passados')}
                    >
                        Passados
                    </Button>
                    <Button
                        type="button"
                        variant={activeTab === 'lista-candidatos' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('lista-candidatos')}
                    >
                        Lista de candidatos
                    </Button>
                    <Button type="button" variant="outline" onClick={clearFilters}>
                        Limpar filtros
                    </Button>
                </div>

                {activeTab !== 'lista-candidatos' ? (
                    <>
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full min-w-[1650px] text-sm">
                                <thead className="bg-muted/40">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">Nome</th>
                                        <th className="px-4 py-3 text-left font-medium">Telefone</th>
                                        <th className="px-4 py-3 text-left font-medium">Função</th>
                                        <th className="px-4 py-3 text-left font-medium">Unidade</th>
                                        <th className="px-4 py-3 text-left font-medium">Status</th>
                                        <th className="px-4 py-3 text-left font-medium">Data entrevista</th>
                                        <th className="px-4 py-3 text-left font-medium">Motivo descarte</th>
                                        <th className="px-4 py-3 text-left font-medium">Observações</th>
                                        <th className="px-4 py-3 text-left font-medium">Anexos</th>
                                        <th className="px-4 py-3 text-left font-medium">Entrevista</th>
                                        <th className="px-4 py-3 text-left font-medium">Cadastro</th>
                                        <th className="px-4 py-3 text-right font-medium">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                                                <span className="inline-flex items-center gap-2">
                                                    <LoaderCircle className="size-4 animate-spin" />
                                                    Carregando...
                                                </span>
                                            </td>
                                        </tr>
                                    ) : items.length === 0 ? (
                                        <tr>
                                            <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                                                Nenhum currículo encontrado para este filtro.
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
                                                    <Badge className={`transport-status-badge ${curriculumStatusBadgeClass(item.status)}`}>
                                                        {curriculumStatusLabel(item.status)}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {item.interview_date ? `${formatDateBR(item.interview_date)} ${formatInterviewTime(item.interview_time)}` : '-'}
                                                </td>
                                                <td className="px-4 py-3">{item.discard_reason?.trim() || '-'}</td>
                                                <td className="px-4 py-3">{item.observacao?.trim() || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        {item.document_url ? (
                                                            <a
                                                                href={item.document_url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-primary hover:underline"
                                                                title={item.document_original_name}
                                                            >
                                                                Currículo
                                                            </a>
                                                        ) : null}
                                                        {item.cnh_attachment_url ? (
                                                            <a
                                                                href={item.cnh_attachment_url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-primary hover:underline"
                                                                title={item.cnh_attachment_original_name ?? 'CNH'}
                                                            >
                                                                CNH
                                                            </a>
                                                        ) : null}
                                                        {item.work_card_attachment_url ? (
                                                            <a
                                                                href={item.work_card_attachment_url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-primary hover:underline"
                                                                title={item.work_card_attachment_original_name ?? 'Carteira de Trabalho'}
                                                            >
                                                                CT
                                                            </a>
                                                        ) : null}
                                                        {!item.document_url && !item.cnh_attachment_url && !item.work_card_attachment_url ? (
                                                            <span className="text-muted-foreground">-</span>
                                                        ) : null}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.linked_interview ? (
                                                        <Link href={`/transport/interviews/${item.linked_interview.id}`} className="text-primary hover:underline">
                                                            {item.linked_interview.full_name}
                                                        </Link>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">{formatDateBR(item.created_at)}</td>
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
                    </>
                ) : (
                    <div className="space-y-4">
                        <div className="rounded-lg border bg-muted/10 px-4 py-3 text-sm">
                            <strong className="font-semibold">Lista de Candidatos para Entrevista</strong>
                            <p className="text-muted-foreground">
                                Total filtrado: {candidateLoading ? '...' : candidateTotal} candidato(s).
                            </p>
                        </div>

                        {candidateLoading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando lista de candidatos...
                            </div>
                        ) : filteredCandidateGroups.length === 0 ? (
                            <div className="rounded-lg border px-4 py-8 text-center text-sm text-muted-foreground">
                                Nenhum candidato convocado para os filtros selecionados.
                            </div>
                        ) : (
                            filteredCandidateGroups.map((group) => (
                                <div key={group.interview_date} className="rounded-lg border">
                                    <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                                        <h3 className="font-semibold">
                                            Lista de {formatDateBR(group.interview_date)}
                                        </h3>
                                        <Badge variant="secondary">{group.total} candidato(s)</Badge>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[1120px] text-sm">
                                            <thead className="bg-muted/20">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-medium">Nome</th>
                                                    <th className="px-3 py-2 text-left font-medium">Função</th>
                                                    <th className="px-3 py-2 text-left font-medium">Unidade</th>
                                                    <th className="px-3 py-2 text-left font-medium">Telefone</th>
                                                    <th className="px-3 py-2 text-left font-medium">Data</th>
                                                    <th className="px-3 py-2 text-left font-medium">Horário</th>
                                                    <th className="px-3 py-2 text-left font-medium">Confirmação data</th>
                                                    <th className="px-3 py-2 text-left font-medium">Confirmação horário</th>
                                                    <th className="px-3 py-2 text-left font-medium">Observações</th>
                                                    <th className="px-3 py-2 text-right font-medium print:hidden">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {group.items.map((item) => (
                                                    <tr key={item.id} className="border-t">
                                                        <td className="px-3 py-2 font-medium">{item.full_name}</td>
                                                        <td className="px-3 py-2">{item.role_name ?? '-'}</td>
                                                        <td className="px-3 py-2">{item.unit_name ?? '-'}</td>
                                                        <td className="px-3 py-2">{item.phone ?? '-'}</td>
                                                        <td className="px-3 py-2">{formatDateBR(item.interview_date)}</td>
                                                        <td className="px-3 py-2">{formatInterviewTime(item.interview_time)}</td>
                                                        <td className="px-3 py-2">
                                                            {item.confirmed_interview_date ? formatDateBR(item.confirmed_interview_date) : '-'}
                                                        </td>
                                                        <td className="px-3 py-2">{formatInterviewTime(item.confirmed_interview_time)}</td>
                                                        <td className="px-3 py-2">
                                                            {item.confirmation_notes?.trim()
                                                                || item.treatment_notes?.trim()
                                                                || item.observacao?.trim()
                                                                || '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-right print:hidden">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    openEditDialog(item as unknown as InterviewCurriculumListItem)
                                                                }
                                                            >
                                                                Editar
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
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
                                placeholder="Ex.: João da Silva"
                            />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="curriculum-phone">Telefone</Label>
                                <Input
                                    id="curriculum-phone"
                                    value={createPhone}
                                    onChange={(event) => setCreatePhone(formatPhoneInput(event.target.value))}
                                    placeholder="Ex.: (11) 99999-9999"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Função</Label>
                                <Select value={createRoleName} onValueChange={setCreateRoleName}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Selecione</SelectItem>
                                        {roleNames.map((roleName) => (
                                            <SelectItem key={`create-role-${roleName}`} value={roleName}>
                                                {roleName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Unidade</Label>
                            <Select value={createUnitName} onValueChange={setCreateUnitName}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Selecione</SelectItem>
                                    {unitNames.map((unitName) => (
                                        <SelectItem key={`create-unit-${unitName}`} value={unitName}>
                                            {unitName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="curriculum-file">Arquivo do currículo</Label>
                            <Input
                                id="curriculum-file"
                                type="file"
                                accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/jpg"
                                onChange={(event) => setCreateFile(event.target.files?.[0] ?? null)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Formatos aceitos: PDF, DOC, DOCX e JPEG (máx. 10 MB).
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="curriculum-cnh-file">Anexo CNH (opcional)</Label>
                                <Input
                                    id="curriculum-cnh-file"
                                    type="file"
                                    accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                                    onChange={(event) => setCreateCnhFile(event.target.files?.[0] ?? null)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="curriculum-work-card-file">Carteira de Trabalho (opcional)</Label>
                                <Input
                                    id="curriculum-work-card-file"
                                    type="file"
                                    accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                                    onChange={(event) => setCreateWorkCardFile(event.target.files?.[0] ?? null)}
                                />
                            </div>
                        </div>

                        {createError ? <Notification message={createError} variant="error" /> : null}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
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
                            Deseja mover o currículo de <strong>{refuseTarget?.full_name}</strong> para passados como recusado?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setRefuseTarget(null)} disabled={refusing}>
                            Cancelar
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => void handleConfirmRefuse()} disabled={refusing}>
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
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Editar currículo</DialogTitle>
                        <DialogDescription>
                            Atualize os dados do candidato e o status de tratamento.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={(event) => void handleSaveEdit(event)}>
                        <div className="space-y-2">
                            <Label htmlFor="edit-curriculum-name">Nome do candidato</Label>
                            <Input id="edit-curriculum-name" value={editName} onChange={(event) => setEditName(event.target.value)} />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="edit-curriculum-phone">Telefone</Label>
                                <Input
                                    id="edit-curriculum-phone"
                                    value={editPhone}
                                    onChange={(event) => setEditPhone(formatPhoneInput(event.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Função</Label>
                                <Select value={editRoleName} onValueChange={setEditRoleName}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Selecione</SelectItem>
                                        {roleNames.map((roleName) => (
                                            <SelectItem key={`edit-role-${roleName}`} value={roleName}>
                                                {roleName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Unidade</Label>
                            <Select value={editUnitName} onValueChange={setEditUnitName}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Selecione</SelectItem>
                                    {unitNames.map((unitName) => (
                                        <SelectItem key={`edit-unit-${unitName}`} value={unitName}>
                                            {unitName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Status do tratamento</Label>
                            <Select
                                value={editStatus}
                                onValueChange={(value: 'pendente' | 'convocado_entrevista' | 'descartado') => setEditStatus(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pendente">Pendente</SelectItem>
                                    <SelectItem value="convocado_entrevista">Convocado para entrevista</SelectItem>
                                    <SelectItem value="descartado">Descartado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {editStatus === 'convocado_entrevista' ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-interview-date">Data da entrevista</Label>
                                    <Input
                                        id="edit-interview-date"
                                        type="date"
                                        value={editInterviewDate}
                                        onChange={(event) => setEditInterviewDate(event.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-interview-time">Horário da entrevista (opcional)</Label>
                                    <Input
                                        id="edit-interview-time"
                                        type="time"
                                        value={editInterviewTime}
                                        onChange={(event) => setEditInterviewTime(event.target.value)}
                                    />
                                </div>
                            </div>
                        ) : null}

                        {editStatus === 'descartado' ? (
                            <div className="space-y-2">
                                <Label htmlFor="edit-discard-reason">Motivo do descarte</Label>
                                <Input
                                    id="edit-discard-reason"
                                    value={editDiscardReason}
                                    onChange={(event) => setEditDiscardReason(event.target.value)}
                                    placeholder="Ex.: perfil não aderente para a vaga"
                                />
                            </div>
                        ) : null}

                        <div className="space-y-2">
                            <Label htmlFor="edit-observation">Observação geral</Label>
                            <Input
                                id="edit-observation"
                                value={editObservation}
                                onChange={(event) => setEditObservation(event.target.value)}
                                placeholder="Observações complementares"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-treatment-notes">Notas do tratamento</Label>
                            <Input
                                id="edit-treatment-notes"
                                value={editTreatmentNotes}
                                onChange={(event) => setEditTreatmentNotes(event.target.value)}
                                placeholder="Anotações internas"
                            />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="edit-confirmed-date">Confirmação de data (opcional)</Label>
                                <Input
                                    id="edit-confirmed-date"
                                    type="date"
                                    value={editConfirmedInterviewDate}
                                    onChange={(event) => setEditConfirmedInterviewDate(event.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-confirmed-time">Confirmação de horário (opcional)</Label>
                                <Input
                                    id="edit-confirmed-time"
                                    type="time"
                                    value={editConfirmedInterviewTime}
                                    onChange={(event) => setEditConfirmedInterviewTime(event.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-confirmation-notes">Observação da confirmação</Label>
                            <Input
                                id="edit-confirmation-notes"
                                value={editConfirmationNotes}
                                onChange={(event) => setEditConfirmationNotes(event.target.value)}
                                placeholder="Ex.: candidato confirmou via WhatsApp"
                            />
                        </div>

                        {editError ? <Notification message={editError} variant="error" /> : null}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditTarget(null)} disabled={editing}>
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
                        <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                            Cancelar
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => void handleConfirmDelete()} disabled={deleting}>
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
