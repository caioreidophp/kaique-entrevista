import {
    CalendarDays,
    Download,
    Eye,
    LoaderCircle,
    PencilLine,
    PlusCircle,
    PlusSquare,
    Trash2,
    Upload,
} from 'lucide-react';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { IMaskInput } from 'react-imask';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { usePersistedState } from '@/hooks/use-persisted-state';
import {
    ApiError,
    apiDelete,
    apiDownload,
    apiGet,
    apiPatch,
    apiPost,
    apiPut,
} from '@/lib/api-client';
import { getAuthToken } from '@/lib/transport-auth';
import { transportFeatures } from '@/lib/transport-features';

interface Unidade {
    id: number;
    nome: string;
    slug: string;
}

interface Funcao {
    id: number;
    nome: string;
    descricao: string | null;
    ativo: boolean;
}

interface RegistryUser {
    id: number;
    name: string;
    email: string;
}

interface Colaborador {
    id: number;
    unidade_id: number;
    funcao_id: number;
    user_id: number | null;
    nome: string;
    apelido: string | null;
    sexo: string | null;
    ativo: boolean;
    cpf: string;
    rg: string | null;
    cnh: string | null;
    validade_cnh: string | null;
    validade_exame_toxicologico: string | null;
    data_nascimento: string | null;
    data_admissao: string | null;
    data_demissao: string | null;
    telefone: string | null;
    email: string | null;
    cep: string | null;
    logradouro: string | null;
    numero_endereco: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade_uf: string | null;
    endereco_completo: string | null;
    dados_bancarios_1: string | null;
    dados_bancarios_2: string | null;
    chave_pix: string | null;
    tipo_chave_pix: string | null;
    nome_banco: string | null;
    numero_banco: string | null;
    numero_agencia: string | null;
    tipo_conta: string | null;
    numero_conta: string | null;
    banco_salario: string | null;
    numero_agencia_salario: string | null;
    numero_conta_salario: string | null;
    conta_pagamento: string | null;
    cartao_beneficio: string | null;
    foto_3x4_path: string | null;
    foto_3x4_url: string | null;
    unidade?: Unidade;
    funcao?: Funcao;
    user?: RegistryUser | null;
}

interface PaginatedResponse<T> {
    current_page: number;
    data: T[];
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
}

interface WrappedResponse<T> {
    data: T;
}

interface ColaboradorFormData {
    unidade_id: string;
    funcao_id: string;
    nome: string;
    apelido: string;
    sexo: string;
    ativo: boolean;
    cpf: string;
    rg: string;
    cnh: string;
    validade_cnh: string;
    validade_exame_toxicologico: string;
    data_nascimento: string;
    data_admissao: string;
    data_demissao: string;
    telefone: string;
    email: string;
    cep: string;
    logradouro: string;
    numero_endereco: string;
    complemento: string;
    bairro: string;
    cidade_uf: string;
    endereco_completo: string;
    dados_bancarios_1: string;
    dados_bancarios_2: string;
    chave_pix: string;
    tipo_chave_pix: string;
    nome_banco: string;
    numero_banco: string;
    numero_agencia: string;
    tipo_conta: string;
    numero_conta: string;
    banco_salario: string;
    numero_agencia_salario: string;
    numero_conta_salario: string;
    conta_pagamento: string;
    cartao_beneficio: string;
}

interface SpreadsheetImportError {
    linha: number;
    erro: string;
    [key: string]: string | number;
}

interface SpreadsheetImportResult {
    total_lidos: number;
    total_importados: number;
    total_ignorados: number;
    erros: SpreadsheetImportError[];
}

interface FeriasRegistro {
    id: number;
    data_inicio: string;
    data_termino: string;
    periodo_aquisitivo_inicio?: string | null;
    periodo_aquisitivo_fim?: string | null;
    com_abono?: boolean;
    dias_ferias?: number;
    observacoes: string | null;
}

interface VacationCandidateRow {
    colaborador_id: number;
    periodo_aquisitivo_inicio?: string;
    periodo_aquisitivo_fim?: string;
    direito: string;
    limite: string;
}

type ColaboradorSortBy = 'nome' | 'funcao' | 'unidade' | 'cpf' | 'ativo';
type SortDirection = 'asc' | 'desc';

interface AfastamentoRegistro {
    id: number;
    data_inicio: string;
    data_termino: string;
    motivo: string;
    observacoes: string | null;
}

type QuickEditInputType = 'text' | 'date' | 'select';

type DetailsTab = 'contato' | 'ferias' | 'afastamentos' | 'dados_bancarios';

const maskedInputClassName =
    'border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive';

const emptyForm: ColaboradorFormData = {
    unidade_id: '',
    funcao_id: '',
    nome: '',
    apelido: '',
    sexo: '',
    ativo: true,
    cpf: '',
    rg: '',
    cnh: '',
    validade_cnh: '',
    validade_exame_toxicologico: '',
    data_nascimento: '',
    data_admissao: '',
    data_demissao: '',
    telefone: '',
    email: '',
    cep: '',
    logradouro: '',
    numero_endereco: '',
    complemento: '',
    bairro: '',
    cidade_uf: '',
    endereco_completo: '',
    dados_bancarios_1: '',
    dados_bancarios_2: '',
    chave_pix: '',
    tipo_chave_pix: '',
    nome_banco: '',
    numero_banco: '',
    numero_agencia: '',
    tipo_conta: '',
    numero_conta: '',
    banco_salario: '',
    numero_agencia_salario: '',
    numero_conta_salario: '',
    conta_pagamento: '',
    cartao_beneficio: '',
};

function collaboratorToFormData(item: Colaborador): ColaboradorFormData {
    return {
        unidade_id: String(item.unidade_id),
        funcao_id: String(item.funcao_id),
        nome: item.nome,
        apelido: item.apelido ?? '',
        sexo: item.sexo ?? '',
        ativo: item.ativo,
        cpf: formatCpf(item.cpf),
        rg: sanitizeRg(item.rg ?? ''),
        cnh: sanitizeCnh(item.cnh ?? ''),
        validade_cnh: dateToInput(item.validade_cnh),
        validade_exame_toxicologico: dateToInput(
            item.validade_exame_toxicologico,
        ),
        data_nascimento: dateToInput(item.data_nascimento),
        data_admissao: dateToInput(item.data_admissao),
        data_demissao: dateToInput(item.data_demissao),
        telefone: formatPhone(item.telefone ?? ''),
        email: item.email ?? '',
        cep: item.cep ?? '',
        logradouro: item.logradouro ?? '',
        numero_endereco: item.numero_endereco ?? '',
        complemento: item.complemento ?? '',
        bairro: item.bairro ?? '',
        cidade_uf: item.cidade_uf ?? '',
        endereco_completo: item.endereco_completo ?? '',
        dados_bancarios_1: item.dados_bancarios_1 ?? '',
        dados_bancarios_2: item.dados_bancarios_2 ?? '',
        chave_pix: item.chave_pix ?? '',
        tipo_chave_pix: item.tipo_chave_pix ?? '',
        nome_banco: item.nome_banco ?? '',
        numero_banco: item.numero_banco ?? '',
        numero_agencia: item.numero_agencia ?? '',
        tipo_conta: item.tipo_conta ?? '',
        numero_conta: item.numero_conta ?? '',
        banco_salario: item.banco_salario ?? '',
        numero_agencia_salario: item.numero_agencia_salario ?? '',
        numero_conta_salario: item.numero_conta_salario ?? '',
        conta_pagamento: item.conta_pagamento ?? '',
        cartao_beneficio: item.cartao_beneficio ?? '',
    };
}

function enumLabel(
    value: string | null | undefined,
    labels: Record<string, string>,
): string {
    if (!value) return '-';
    return labels[value] ?? value;
}

function normalizeNullable(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}

function dateToInput(value: string | null): string {
    if (!value) return '';
    return value.slice(0, 10);
}

function dateToView(value: string | null): string {
    if (!value) return '-';

    const [year, month, day] = value.slice(0, 10).split('-');
    if (!year || !month || !day) return value;

    return `${day}/${month}/${year}`;
}

function sanitizeCpf(value: string): string {
    return value.replace(/\D/g, '').slice(0, 11);
}

function formatCpf(value: string): string {
    const digits = sanitizeCpf(value);

    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9)
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;

    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function sanitizePhone(value: string): string {
    return value.replace(/\D/g, '').slice(0, 11);
}

function formatPhone(value: string): string {
    const digits = sanitizePhone(value);

    if (digits.length === 0) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCep(value: string | null): string {
    if (!value) return '-';

    const digits = value.replace(/\D/g, '').slice(0, 8);

    if (digits.length <= 5) {
        return digits;
    }

    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function sanitizeRg(value: string): string {
    const normalized = value.toUpperCase().replace(/[^0-9A-Z]/g, '');

    if (!normalized) return '';

    const max = normalized.slice(0, 10);
    const prefix = max.slice(0, 9).replace(/[^0-9]/g, '');
    const last = max.length >= 10 ? max[9] : '';

    if (!last) {
        return prefix;
    }

    return `${prefix}${last}`.slice(0, 10);
}

function formatRg(value: string): string {
    const sanitized = sanitizeRg(value);

    if (sanitized.length <= 3) return sanitized;
    if (sanitized.length <= 6)
        return `${sanitized.slice(0, 3)}.${sanitized.slice(3)}`;
    if (sanitized.length <= 9) {
        return `${sanitized.slice(0, 3)}.${sanitized.slice(3, 6)}.${sanitized.slice(6)}`;
    }

    return `${sanitized.slice(0, 3)}.${sanitized.slice(3, 6)}.${sanitized.slice(6, 9)}-${sanitized.slice(9)}`;
}

function sanitizeCnh(value: string): string {
    return value.replace(/\D/g, '').slice(0, 11);
}

function importErrorTypeLabel(value: string | number | undefined): string {
    const type = String(value ?? '').trim();

    if (type === 'campos_obrigatorios') return 'Campos obrigatórios';
    if (type === 'cpf_invalido') return 'CPF inválido';
    if (type === 'cpf_duplicado_planilha') return 'CPF duplicado na planilha';
    if (type === 'cpf_duplicado_sistema') return 'CPF já cadastrado';
    if (type === 'funcao_nao_encontrada') return 'Função não encontrada';
    if (type === 'unidade_nao_encontrada') return 'Unidade não encontrada';
    if (type === 'status_invalido') return 'Status inválido';

    return type ? type.replace(/_/g, ' ') : 'Validação';
}

export default function TransportRegistryCollaboratorsPage() {
    const [unidades, setUnidades] = useState<Unidade[]>([]);
    const [funcoes, setFuncoes] = useState<Funcao[]>([]);
    const [items, setItems] = useState<Colaborador[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [nameFilter, setNameFilter, resetNameFilter] = usePersistedState(
        'transport:registry:collaborators:nameFilter',
        '',
    );
    const [unidadeFilter, setUnidadeFilter, resetUnidadeFilter] =
        usePersistedState(
            'transport:registry:collaborators:unidadeFilter',
            'all',
        );
    const [activeFilter, setActiveFilter, resetActiveFilter] =
        usePersistedState<'all' | '1' | '0'>(
            'transport:registry:collaborators:activeFilter',
            'all',
        );

    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [sortBy, setSortBy] = useState<ColaboradorSortBy>('nome');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const [formOpen, setFormOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Colaborador | null>(null);
    const [detailsItem, setDetailsItem] = useState<Colaborador | null>(null);
    const [detailsTab, setDetailsTab] = useState<DetailsTab>('contato');
    const [deleteCandidate, setDeleteCandidate] = useState<Colaborador | null>(
        null,
    );
    const [formData, setFormData] = useState<ColaboradorFormData>(emptyForm);
    const [prefillHandled, setPrefillHandled] = useState(false);
    const [importingSpreadsheet, setImportingSpreadsheet] = useState(false);
    const [exportingCsv, setExportingCsv] = useState(false);
    const [importResult, setImportResult] =
        useState<SpreadsheetImportResult | null>(null);
    const [importResultOpen, setImportResultOpen] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [fotoFile, setFotoFile] = useState<File | null>(null);
    const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null);
    const [feriasByColaborador, setFeriasByColaborador] = useState<
        Record<number, FeriasRegistro[]>
    >({});
    const [afastamentosByColaborador, setAfastamentosByColaborador] = useState<
        Record<number, AfastamentoRegistro[]>
    >({});
    const [feriasModalOpen, setFeriasModalOpen] = useState(false);
    const [feriasSaving, setFeriasSaving] = useState(false);
    const [editingFeriasId, setEditingFeriasId] = useState<number | null>(null);
    const [afastamentoModalOpen, setAfastamentoModalOpen] = useState(false);
    const [editingAfastamentoId, setEditingAfastamentoId] = useState<number | null>(null);
    const [feriasDraft, setFeriasDraft] = useState({
        data_inicio: '',
        data_termino: '',
        observacoes: '',
    });
    const [afastamentoDraft, setAfastamentoDraft] = useState({
        data_inicio: '',
        data_termino: '',
        motivo: '',
        observacoes: '',
    });
    const [quickEditOpen, setQuickEditOpen] = useState(false);
    const [quickEditSaving, setQuickEditSaving] = useState(false);
    const [quickEditLabel, setQuickEditLabel] = useState('');
    const [quickEditField, setQuickEditField] = useState<keyof ColaboradorFormData | null>(null);
    const [quickEditType, setQuickEditType] = useState<QuickEditInputType>('text');
    const [quickEditValue, setQuickEditValue] = useState('');
    const [quickEditOptions, setQuickEditOptions] = useState<Array<{ value: string; label: string }>>([]);
    const spreadsheetInputRef = useRef<HTMLInputElement | null>(null);

    const selectedUnidadeName = useMemo(() => {
        if (!detailsItem) return '-';
        return detailsItem.unidade?.nome ?? '-';
    }, [detailsItem]);

    const selectedFuncaoName = useMemo(() => {
        if (!detailsItem) return '-';
        return detailsItem.funcao?.nome ?? '-';
    }, [detailsItem]);

    const importSuccessRate = useMemo(() => {
        if (!importResult || importResult.total_lidos <= 0) return 0;
        return Math.round(
            (importResult.total_importados / importResult.total_lidos) * 100,
        );
    }, [importResult]);

    async function loadOptions(): Promise<void> {
        try {
            const [unidadesResponse, funcoesResponse] = await Promise.all([
                apiGet<WrappedResponse<Unidade[]>>('/registry/unidades'),
                apiGet<WrappedResponse<Funcao[]>>('/registry/funcoes?active=1'),
            ]);

            setUnidades(unidadesResponse.data);
            setFuncoes(funcoesResponse.data);
        } catch {
            setNotification({
                message: 'Não foi possível carregar unidades e funções.',
                variant: 'error',
            });
        }
    }

    function buildQuery(page: number): string {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('per_page', '10');
        params.set('sort_by', sortBy);
        params.set('sort_direction', sortDirection);

        if (nameFilter.trim()) params.set('name', nameFilter.trim());
        if (unidadeFilter !== 'all') params.set('unidade_id', unidadeFilter);
        if (activeFilter !== 'all') params.set('active', activeFilter);

        return params.toString();
    }

    async function loadColaboradores(page = 1): Promise<void> {
        setLoading(true);

        try {
            const response = await apiGet<PaginatedResponse<Colaborador>>(
                `/registry/colaboradores?${buildQuery(page)}`,
            );

            setItems(response.data);
            setCurrentPage(response.current_page);
            setLastPage(response.last_page);
            setTotal(response.total);
        } catch {
            setNotification({
                message: 'Não foi possível carregar os colaboradores.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadOptions();
        loadColaboradores(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (prefillHandled || typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        const fromInterview = params.get('from_interview') === '1';
        const nome = params.get('nome') ?? '';
        const email = params.get('email') ?? '';
        const cpf = params.get('cpf') ?? '';
        const telefone = params.get('telefone') ?? '';

        if (!fromInterview) {
            setPrefillHandled(true);
            return;
        }

        setFormData((previous) => ({
            ...previous,
            nome,
            email,
            cpf,
            telefone,
            ativo: true,
        }));
        setFormOpen(true);
        setPrefillHandled(true);
    }, [prefillHandled]);

    function openCreateDialog(): void {
        setEditingItem(null);
        setFormData(emptyForm);
        setFormErrors({});
        setFotoFile(null);
        setFotoPreviewUrl(null);
        setFormOpen(true);
    }

    function openEditDialog(item: Colaborador): void {
        setEditingItem(item);
        setFormData(collaboratorToFormData(item));
        setFormErrors({});
        setFotoFile(null);
        setFotoPreviewUrl(item.foto_3x4_url ?? null);
        setFormOpen(true);
    }

    function openDetailsDialog(item: Colaborador): void {
        setDetailsItem(item);
        setFormData(collaboratorToFormData(item));
        setDetailsTab('contato');
        setDetailsOpen(true);
        void loadFeriasForCollaborator(item.id);
    }

    async function loadFeriasForCollaborator(colaboradorId: number): Promise<void> {
        try {
            const response = await apiGet<WrappedResponse<FeriasRegistro[]>>(
                `/payroll/vacations/collaborators/${colaboradorId}`,
            );

            setFeriasByColaborador((previous) => ({
                ...previous,
                [colaboradorId]: response.data,
            }));
        } catch {
            setNotification({
                message: 'Não foi possível carregar férias do colaborador.',
                variant: 'error',
            });
        }
    }

    function openFeriasCreateModal(): void {
        setEditingFeriasId(null);
        setFeriasDraft({ data_inicio: '', data_termino: '', observacoes: '' });
        setFeriasModalOpen(true);
    }

    function openFeriasEditModal(item: FeriasRegistro): void {
        setEditingFeriasId(item.id);
        setFeriasDraft({
            data_inicio: item.data_inicio,
            data_termino: item.data_termino,
            observacoes: item.observacoes ?? '',
        });
        setFeriasModalOpen(true);
    }

    async function saveFeriasDraft(): Promise<void> {
        if (!detailsItem) return;
        if (!feriasDraft.data_inicio || !feriasDraft.data_termino) {
            setNotification({
                message: 'Informe data início e data término para lançar férias.',
                variant: 'error',
            });
            return;
        }

        setFeriasSaving(true);

        try {
            const candidates = await apiGet<WrappedResponse<VacationCandidateRow[]>>(
                '/payroll/vacations/candidates',
            );

            const candidate = candidates.data.find(
                (item) => item.colaborador_id === detailsItem.id,
            );

            if (!candidate) {
                setNotification({
                    message:
                        'Não foi possível calcular período aquisitivo deste colaborador para lançar férias.',
                    variant: 'error',
                });
                return;
            }

            if (editingFeriasId) {
                await apiPut(`/payroll/vacations/${editingFeriasId}`, {
                    colaborador_id: detailsItem.id,
                    com_abono: false,
                    data_inicio: feriasDraft.data_inicio,
                    data_fim: feriasDraft.data_termino,
                    periodo_aquisitivo_inicio: candidate.periodo_aquisitivo_inicio ?? candidate.direito,
                    periodo_aquisitivo_fim: candidate.periodo_aquisitivo_fim ?? candidate.limite,
                    observacoes: feriasDraft.observacoes,
                });
            } else {
                await apiPost('/payroll/vacations', {
                    colaborador_id: detailsItem.id,
                    com_abono: false,
                    data_inicio: feriasDraft.data_inicio,
                    data_fim: feriasDraft.data_termino,
                    periodo_aquisitivo_inicio: candidate.periodo_aquisitivo_inicio ?? candidate.direito,
                    periodo_aquisitivo_fim: candidate.periodo_aquisitivo_fim ?? candidate.limite,
                    observacoes: feriasDraft.observacoes,
                });
            }

            await loadFeriasForCollaborator(detailsItem.id);

            setEditingFeriasId(null);
            setFeriasDraft({ data_inicio: '', data_termino: '', observacoes: '' });
            setFeriasModalOpen(false);
            setNotification({
                message: editingFeriasId
                    ? 'Férias atualizadas com sucesso.'
                    : 'Férias lançadas com sucesso e sincronizadas com o Controle de Férias.',
                variant: 'success',
            });
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
                    message: 'Não foi possível lançar férias.',
                    variant: 'error',
                });
            }
        } finally {
            setFeriasSaving(false);
        }
    }

    function openAfastamentoCreateModal(): void {
        setEditingAfastamentoId(null);
        setAfastamentoDraft({
            data_inicio: '',
            data_termino: '',
            motivo: '',
            observacoes: '',
        });
        setAfastamentoModalOpen(true);
    }

    function openAfastamentoEditModal(item: AfastamentoRegistro): void {
        setEditingAfastamentoId(item.id);
        setAfastamentoDraft({
            data_inicio: item.data_inicio,
            data_termino: item.data_termino,
            motivo: item.motivo,
            observacoes: item.observacoes ?? '',
        });
        setAfastamentoModalOpen(true);
    }

    function saveAfastamentoDraft(): void {
        if (!detailsItem) return;
        if (
            !afastamentoDraft.data_inicio ||
            !afastamentoDraft.data_termino ||
            !afastamentoDraft.motivo.trim()
        ) {
            setNotification({
                message:
                    'Informe data início, data término e motivo para lançar afastamento.',
                variant: 'error',
            });
            return;
        }

        const registro: AfastamentoRegistro = {
            id: Date.now(),
            data_inicio: afastamentoDraft.data_inicio,
            data_termino: afastamentoDraft.data_termino,
            motivo: afastamentoDraft.motivo.trim(),
            observacoes: normalizeNullable(afastamentoDraft.observacoes),
        };

        setAfastamentosByColaborador((previous) => {
            const current = [...(previous[detailsItem.id] ?? [])];

            if (editingAfastamentoId) {
                const next = current.map((item) =>
                    item.id === editingAfastamentoId ? registro : item,
                );

                return {
                    ...previous,
                    [detailsItem.id]: next,
                };
            }

            return {
                ...previous,
                [detailsItem.id]: [...current, registro],
            };
        });
        setAfastamentoDraft({
            data_inicio: '',
            data_termino: '',
            motivo: '',
            observacoes: '',
        });
        setEditingAfastamentoId(null);
        setAfastamentoModalOpen(false);
        setNotification({
            message: editingAfastamentoId
                ? 'Afastamento atualizado no perfil.'
                : 'Afastamento adicionado no perfil. Integração completa virá na próxima etapa.',
            variant: editingAfastamentoId ? 'success' : 'info',
        });
    }

    function openDeleteDialog(item: Colaborador): void {
        setDeleteCandidate(item);
        setDeleteDialogOpen(true);
    }

    function buildColaboradorPayload(source: ColaboradorFormData) {
        const sanitizedCpf = sanitizeCpf(source.cpf);
        const sanitizedRg = sanitizeRg(source.rg);
        const sanitizedPhone = sanitizePhone(source.telefone);
        const sanitizedCnh = sanitizeCnh(source.cnh);
        const normalizedEmail = source.email.trim();

        return {
            unidade_id: Number(source.unidade_id),
            funcao_id: Number(source.funcao_id),
            nome: source.nome.trim(),
            apelido: normalizeNullable(source.apelido),
            sexo: normalizeNullable(source.sexo),
            ativo: source.ativo,
            cpf: sanitizedCpf,
            rg: sanitizedRg !== '' ? sanitizedRg : null,
            cnh: sanitizedCnh !== '' ? sanitizedCnh : null,
            validade_cnh: normalizeNullable(source.validade_cnh),
            validade_exame_toxicologico: normalizeNullable(
                source.validade_exame_toxicologico,
            ),
            data_nascimento: normalizeNullable(source.data_nascimento),
            data_admissao: normalizeNullable(source.data_admissao),
            data_demissao: normalizeNullable(source.data_demissao),
            telefone: sanitizedPhone !== '' ? sanitizedPhone : null,
            email: normalizedEmail !== '' ? normalizedEmail : null,
            cep: normalizeNullable(source.cep),
            logradouro: normalizeNullable(source.logradouro),
            numero_endereco: normalizeNullable(source.numero_endereco),
            complemento: normalizeNullable(source.complemento),
            bairro: normalizeNullable(source.bairro),
            cidade_uf: normalizeNullable(source.cidade_uf),
            endereco_completo: normalizeNullable(source.endereco_completo),
            dados_bancarios_1: normalizeNullable(source.dados_bancarios_1),
            dados_bancarios_2: normalizeNullable(source.dados_bancarios_2),
            chave_pix: normalizeNullable(source.chave_pix),
            tipo_chave_pix: normalizeNullable(source.tipo_chave_pix),
            nome_banco: normalizeNullable(source.nome_banco),
            numero_banco: normalizeNullable(source.numero_banco),
            numero_agencia: normalizeNullable(source.numero_agencia),
            tipo_conta: normalizeNullable(source.tipo_conta),
            numero_conta: normalizeNullable(source.numero_conta),
            banco_salario: normalizeNullable(source.banco_salario),
            numero_agencia_salario: normalizeNullable(
                source.numero_agencia_salario,
            ),
            numero_conta_salario: normalizeNullable(source.numero_conta_salario),
            conta_pagamento: normalizeNullable(source.conta_pagamento),
            cartao_beneficio: normalizeNullable(source.cartao_beneficio),
        };
    }

    function openQuickEdit(
        field: keyof ColaboradorFormData,
        label: string,
        type: QuickEditInputType = 'text',
        options: Array<{ value: string; label: string }> = [],
    ): void {
        if (!detailsItem) return;

        const rawValue = formData[field];
        const value = typeof rawValue === 'boolean' ? (rawValue ? '1' : '0') : String(rawValue ?? '');

        setQuickEditField(field);
        setQuickEditLabel(label);
        setQuickEditType(type);
        setQuickEditOptions(options);
        setQuickEditValue(value);
        setQuickEditOpen(true);
    }

    async function saveQuickEdit(): Promise<void> {
        if (!detailsItem || !quickEditField) return;

        setQuickEditSaving(true);

        const nextFormData: ColaboradorFormData = {
            ...formData,
            [quickEditField]:
                quickEditField === 'ativo'
                    ? quickEditValue === '1'
                    : quickEditValue,
        } as ColaboradorFormData;

        try {
            const response = await apiPut<WrappedResponse<Colaborador>>(
                `/registry/colaboradores/${detailsItem.id}`,
                buildColaboradorPayload(nextFormData),
            );

            const refreshed = response.data;

            setDetailsItem(refreshed);
            setFormData(collaboratorToFormData(refreshed));
            setItems((previous) =>
                previous.map((item) =>
                    item.id === refreshed.id ? refreshed : item,
                ),
            );

            setQuickEditOpen(false);
            setNotification({
                message: `${quickEditLabel} atualizado com sucesso.`,
                variant: 'success',
            });
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
                    message: 'Não foi possível atualizar o campo selecionado.',
                    variant: 'error',
                });
            }
        } finally {
            setQuickEditSaving(false);
        }
    }

    async function handleSubmit(
        event: React.FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();
        setSaving(true);
        setNotification(null);

        const sanitizedCpf = sanitizeCpf(formData.cpf);
        const sanitizedRg = sanitizeRg(formData.rg);
        const sanitizedPhone = sanitizePhone(formData.telefone);
        const sanitizedCnh = sanitizeCnh(formData.cnh);
        const normalizedEmail = formData.email.trim();
        const clientErrors: Record<string, string> = {};

        if (!/^\d{11}$/.test(sanitizedCpf)) {
            clientErrors.cpf = 'CPF deve conter exatamente 11 números.';
        }

        if (sanitizedPhone !== '' && !/^\d{11}$/.test(sanitizedPhone)) {
            clientErrors.telefone =
                'Telefone deve conter exatamente 11 números.';
        }

        if (sanitizedRg !== '' && !/^\d{9}[\dA-Z]$/.test(sanitizedRg)) {
            clientErrors.rg =
                'RG deve ter 9 números e 1 número ou letra no final.';
        }

        if (sanitizedCnh !== '' && !/^\d{11}$/.test(sanitizedCnh)) {
            clientErrors.cnh = 'CNH deve conter exatamente 11 números.';
        }

        if (
            normalizedEmail !== '' &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
        ) {
            clientErrors.email = 'Informe um e-mail válido.';
        }

        if (Object.keys(clientErrors).length > 0) {
            setFormErrors(clientErrors);
            setNotification({
                message: 'Revise os campos de CPF, RG, CNH, telefone e e-mail.',
                variant: 'error',
            });
            setSaving(false);

            return;
        }

        setFormErrors({});

        const payload = buildColaboradorPayload(formData);

        try {
            let savedColaborador: Colaborador | null = null;

            if (editingItem) {
                const updated = await apiPut<WrappedResponse<Colaborador>>(
                    `/registry/colaboradores/${editingItem.id}`,
                    payload,
                );

                savedColaborador = updated.data;
            } else {
                const created = await apiPost<WrappedResponse<Colaborador>>(
                    '/registry/colaboradores',
                    payload,
                );
                savedColaborador = created.data;

                if (typeof window !== 'undefined') {
                    const params = new URLSearchParams(window.location.search);
                    const fromInterview = params.get('from_interview') === '1';
                    const interviewId = params.get('interview_id');

                    if (fromInterview && interviewId) {
                        await apiPatch(
                            `/next-steps/${interviewId}/hiring-status`,
                            {
                                foi_contratado: true,
                                colaborador_id: created.data.id,
                            },
                        );
                    }
                }
            }

            if (fotoFile && savedColaborador) {
                const uploadFormData = new FormData();
                uploadFormData.append('foto', fotoFile);

                await apiPost(
                    `/registry/colaboradores/${savedColaborador.id}/foto-3x4`,
                    uploadFormData,
                );
            }

            setFormOpen(false);
            setFormData(emptyForm);
            setEditingItem(null);
            setFotoFile(null);
            setFotoPreviewUrl(null);
            setNotification({
                message: editingItem
                    ? 'Colaborador atualizado com sucesso.'
                    : 'Colaborador cadastrado com sucesso.',
                variant: 'success',
            });
            await loadColaboradores(currentPage);
        } catch (error) {
            if (error instanceof ApiError) {
                const firstError = error.errors
                    ? Object.values(error.errors)[0]?.[0]
                    : null;
                const flattenedErrors: Record<string, string> = {};

                if (error.errors) {
                    Object.entries(error.errors).forEach(([field, list]) => {
                        flattenedErrors[field] = list[0] ?? 'Campo inválido.';
                    });
                    setFormErrors((previous) => ({
                        ...previous,
                        ...flattenedErrors,
                    }));
                }

                setNotification({
                    message: firstError ?? error.message,
                    variant: 'error',
                });
            } else {
                setNotification({
                    message: 'Não foi possível salvar o colaborador.',
                    variant: 'error',
                });
            }
        } finally {
            setSaving(false);
        }
    }

    function handleApplyFilters(): void {
        void loadColaboradores(1);
    }

    function clearFilters(): void {
        resetNameFilter();
        resetUnidadeFilter();
        resetActiveFilter();
        void loadColaboradores(1);
    }

    function sortIndicator(column: ColaboradorSortBy): string {
        if (sortBy !== column) return '↕';
        return sortDirection === 'asc' ? '↑' : '↓';
    }

    function toggleSort(column: ColaboradorSortBy): void {
        if (sortBy === column) {
            setSortDirection((previous) => {
                const next = previous === 'asc' ? 'desc' : 'asc';
                window.setTimeout(() => {
                    void loadColaboradores(1);
                }, 0);
                return next;
            });
            return;
        }

        setSortBy(column);
        setSortDirection('asc');
        window.setTimeout(() => {
            void loadColaboradores(1);
        }, 0);
    }

    async function handleDeleteCollaborator(): Promise<void> {
        if (!deleteCandidate) return;

        setDeleting(true);
        setNotification(null);

        try {
            await apiDelete(`/registry/colaboradores/${deleteCandidate.id}`);

            setDeleteDialogOpen(false);
            setDeleteCandidate(null);

            setNotification({
                message: 'Colaborador excluído com sucesso.',
                variant: 'success',
            });

            const targetPage =
                items.length <= 1 && currentPage > 1
                    ? currentPage - 1
                    : currentPage;
            await loadColaboradores(targetPage);
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({
                    message: error.message,
                    variant: 'error',
                });
            } else {
                setNotification({
                    message: 'Não foi possível excluir o colaborador.',
                    variant: 'error',
                });
            }
        } finally {
            setDeleting(false);
        }
    }

    function handleImportSpreadsheetClick(): void {
        spreadsheetInputRef.current?.click();
    }

    async function handleSpreadsheetSelected(
        event: ChangeEvent<HTMLInputElement>,
    ): Promise<void> {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) return;

        const token = getAuthToken();

        if (!token) {
            setNotification({
                message: 'Sessão expirada. Faça login novamente.',
                variant: 'error',
            });
            return;
        }

        setImportingSpreadsheet(true);
        setNotification(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(
                '/api/registry/colaboradores/import-spreadsheet',
                {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: formData,
                },
            );

            const json = (await response.json().catch(() => ({}))) as {
                message?: string;
                total_lidos?: number;
                total_importados?: number;
                total_ignorados?: number;
                erros?: SpreadsheetImportError[];
            };

            if (!response.ok) {
                const backendMessage = json.message?.trim();

                if (response.status === 413) {
                    throw new Error(
                        'Arquivo muito grande para importação. Envie um XLSX menor.',
                    );
                }

                if (response.status === 422 && !backendMessage) {
                    throw new Error(
                        'Arquivo inválido. Verifique se o formato é .xlsx e se os dados começam na linha 5.',
                    );
                }

                throw new Error(
                    backendMessage || 'Não foi possível importar a planilha.',
                );
            }

            setImportResult({
                total_lidos: json.total_lidos ?? 0,
                total_importados: json.total_importados ?? 0,
                total_ignorados: json.total_ignorados ?? 0,
                erros: json.erros ?? [],
            });
            setImportResultOpen(true);

            const totalImportados = json.total_importados ?? 0;
            const totalIgnorados = json.total_ignorados ?? 0;
            const resultMessage =
                totalIgnorados > 0
                    ? `Importação concluída com pendências: ${totalImportados} importado(s), ${totalIgnorados} ignorado(s).`
                    : `Importação concluída com sucesso: ${totalImportados} importado(s).`;

            setNotification({
                message: resultMessage,
                variant: totalIgnorados > 0 ? 'info' : 'success',
            });

            await loadColaboradores(1);
        } catch (error) {
            setNotification({
                message:
                    error instanceof Error
                        ? error.message
                        : 'Não foi possível importar a planilha.',
                variant: 'error',
            });
        } finally {
            setImportingSpreadsheet(false);
        }
    }

    async function handleExportCsv(): Promise<void> {
        setExportingCsv(true);

        try {
            const fileName = `colaboradores-${new Date().toISOString().slice(0, 10)}.csv`;
            await apiDownload('/registry/colaboradores/export-csv', fileName);

            setNotification({
                message: 'Exportação CSV iniciada com sucesso.',
                variant: 'success',
            });
        } catch (error) {
            setNotification({
                message:
                    error instanceof ApiError
                        ? error.message
                        : 'Não foi possível exportar o CSV de colaboradores.',
                variant: 'error',
            });
        } finally {
            setExportingCsv(false);
        }
    }

    return (
        <AdminLayout
            title="Cadastro - Colaboradores"
            active="registry-collaborators"
            module="registry"
        >
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold">
                            Cadastro de Colaboradores
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Cadastre, filtre e atualize os colaboradores da
                            operação.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <input
                            ref={spreadsheetInputRef}
                            type="file"
                            accept=".xlsx"
                            className="hidden"
                            onChange={(event) => {
                                void handleSpreadsheetSelected(event);
                            }}
                        />
                        {transportFeatures.csvExports ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    void handleExportCsv();
                                }}
                                disabled={exportingCsv}
                            >
                                {exportingCsv ? (
                                    <>
                                        <LoaderCircle className="size-4 animate-spin" />
                                        Exportando...
                                    </>
                                ) : (
                                    <>
                                        <Download className="size-4" />
                                        Exportar CSV
                                    </>
                                )}
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleImportSpreadsheetClick}
                            disabled={importingSpreadsheet}
                        >
                            {importingSpreadsheet ? (
                                <>
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Importando...
                                </>
                            ) : (
                                <>
                                    <Upload className="size-4" />
                                    Importar XLSX
                                </>
                            )}
                        </Button>

                        <Button type="button" onClick={openCreateDialog}>
                            <PlusSquare className="size-4" />
                            Cadastrar Colaborador
                        </Button>
                    </div>
                </div>

                {notification ? (
                    <Notification
                        message={notification.message}
                        variant={notification.variant}
                    />
                ) : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-4">
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="filter-name">Nome</Label>
                                <Input
                                    id="filter-name"
                                    value={nameFilter}
                                    onChange={(event) =>
                                        setNameFilter(event.target.value)
                                    }
                                    placeholder="Buscar por nome"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Unidade</Label>
                                <Select
                                    value={unidadeFilter}
                                    onValueChange={setUnidadeFilter}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            Todas
                                        </SelectItem>
                                        {unidades.map((unidade) => (
                                            <SelectItem
                                                key={unidade.id}
                                                value={String(unidade.id)}
                                            >
                                                {unidade.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select
                                    value={activeFilter}
                                    onValueChange={(value: 'all' | '1' | '0') =>
                                        setActiveFilter(value)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            Todos
                                        </SelectItem>
                                        <SelectItem value="1">
                                            Ativos
                                        </SelectItem>
                                        <SelectItem value="0">
                                            Inativos
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleApplyFilters}
                            >
                                Aplicar filtros
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={clearFilters}
                            >
                                Limpar
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Colaboradores ({total})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando colaboradores...
                            </div>
                        ) : items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Nenhum colaborador encontrado.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-2 pr-3 font-medium">
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-1 hover:text-foreground"
                                                    onClick={() => toggleSort('nome')}
                                                >
                                                    Nome <span>{sortIndicator('nome')}</span>
                                                </button>
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-1 hover:text-foreground"
                                                    onClick={() => toggleSort('funcao')}
                                                >
                                                    Função <span>{sortIndicator('funcao')}</span>
                                                </button>
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-1 hover:text-foreground"
                                                    onClick={() => toggleSort('unidade')}
                                                >
                                                    Unidade <span>{sortIndicator('unidade')}</span>
                                                </button>
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-1 hover:text-foreground"
                                                    onClick={() => toggleSort('cpf')}
                                                >
                                                    CPF <span>{sortIndicator('cpf')}</span>
                                                </button>
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-1 hover:text-foreground"
                                                    onClick={() => toggleSort('ativo')}
                                                >
                                                    Status <span>{sortIndicator('ativo')}</span>
                                                </button>
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
                                                    {item.funcao?.nome ?? '-'}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {item.unidade?.nome ?? '-'}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {item.cpf}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {item.ativo
                                                        ? 'Ativo'
                                                        : 'Inativo'}
                                                </td>
                                                <td className="py-2">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="cursor-pointer"
                                                            aria-label="Ver"
                                                            onClick={() =>
                                                                openDetailsDialog(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            <Eye className="size-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="cursor-pointer"
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
                                                            className="cursor-pointer text-destructive hover:text-destructive"
                                                            aria-label="Excluir"
                                                            onClick={() =>
                                                                openDeleteDialog(
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

                        <div className="mt-4 flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                Página {currentPage} de {lastPage}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={currentPage <= 1 || loading}
                                    onClick={() =>
                                        void loadColaboradores(currentPage - 1)
                                    }
                                >
                                    Anterior
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={
                                        currentPage >= lastPage || loading
                                    }
                                    onClick={() =>
                                        void loadColaboradores(currentPage + 1)
                                    }
                                >
                                    Próxima
                                </Button>
                            </div>
                        </div>
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
                        setFormErrors({});
                        setFotoFile(null);
                        setFotoPreviewUrl(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingItem
                                ? 'Editar colaborador'
                                : 'Cadastrar colaborador'}
                        </DialogTitle>
                        <DialogDescription>
                            Preencha os dados obrigatórios e opcionais do
                            colaborador.
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                            <div className="rounded-lg border bg-muted/20 p-3">
                                <div className="grid gap-3 md:grid-cols-[120px_1fr] md:items-center">
                                    <div className="flex justify-center md:justify-start">
                                        <Avatar className="h-24 w-24 rounded-md border">
                                            <AvatarImage
                                                src={
                                                    fotoPreviewUrl ?? undefined
                                                }
                                                alt={
                                                    formData.nome || 'Foto 3x4'
                                                }
                                            />
                                            <AvatarFallback className="rounded-md text-lg font-semibold">
                                                {(
                                                    formData.nome
                                                        .trim()
                                                        .charAt(0) || '3'
                                                ).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="foto-3x4">
                                            Foto 3x4
                                        </Label>
                                        <Input
                                            id="foto-3x4"
                                            type="file"
                                            accept="image/png,image/jpeg,image/jpg,image/webp"
                                            onChange={(event) => {
                                                const file =
                                                    event.target.files?.[0] ??
                                                    null;

                                                setFotoFile(file);

                                                if (file) {
                                                    setFotoPreviewUrl(
                                                        URL.createObjectURL(
                                                            file,
                                                        ),
                                                    );
                                                } else if (
                                                    editingItem?.foto_3x4_url
                                                ) {
                                                    setFotoPreviewUrl(
                                                        editingItem.foto_3x4_url,
                                                    );
                                                } else {
                                                    setFotoPreviewUrl(null);
                                                }
                                            }}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Formatos: JPG, PNG ou WEBP (máx.
                                            3MB).
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label>Unidade *</Label>
                                    <Select
                                        value={formData.unidade_id}
                                        onValueChange={(value) =>
                                            setFormData((previous) => ({
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
                                                <SelectItem
                                                    key={unidade.id}
                                                    value={String(unidade.id)}
                                                >
                                                    {unidade.nome}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Função *</Label>
                                    <Select
                                        value={formData.funcao_id}
                                        onValueChange={(value) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                funcao_id: value,
                                            }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {funcoes.map((funcao) => (
                                                <SelectItem
                                                    key={funcao.id}
                                                    value={String(funcao.id)}
                                                >
                                                    {funcao.nome}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Status *</Label>
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
                                            <SelectItem value="1">
                                                Ativo
                                            </SelectItem>
                                            <SelectItem value="0">
                                                Inativo
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="nome">
                                        Nome completo *
                                    </Label>
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
                                    <Label htmlFor="apelido">Apelido</Label>
                                    <Input
                                        id="apelido"
                                        value={formData.apelido}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                apelido: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-4">
                                <div className="space-y-2">
                                    <Label htmlFor="cpf">CPF *</Label>
                                    <IMaskInput
                                        id="cpf"
                                        mask="000.000.000-00"
                                        value={formData.cpf}
                                        className={maskedInputClassName}
                                        inputMode="numeric"
                                        overwrite
                                        unmask={false}
                                        onAccept={(value) => {
                                            setFormData((previous) => ({
                                                ...previous,
                                                cpf: String(value),
                                            }));
                                            setFormErrors((previous) => ({
                                                ...previous,
                                                cpf: '',
                                            }));
                                        }}
                                    />
                                    {formErrors.cpf ? (
                                        <p className="text-xs text-destructive">
                                            {formErrors.cpf}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="rg">RG</Label>
                                    <Input
                                        id="rg"
                                        value={formData.rg}
                                        onChange={(event) => {
                                            setFormData((previous) => ({
                                                ...previous,
                                                rg: sanitizeRg(
                                                    event.target.value,
                                                ),
                                            }));
                                            setFormErrors((previous) => ({
                                                ...previous,
                                                rg: '',
                                            }));
                                        }}
                                    />
                                    {formErrors.rg ? (
                                        <p className="text-xs text-destructive">
                                            {formErrors.rg}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cnh">CNH</Label>
                                    <IMaskInput
                                        id="cnh"
                                        mask="00000000000"
                                        value={formData.cnh}
                                        className={maskedInputClassName}
                                        inputMode="numeric"
                                        overwrite
                                        unmask={false}
                                        onAccept={(value) => {
                                            setFormData((previous) => ({
                                                ...previous,
                                                cnh: String(value),
                                            }));
                                            setFormErrors((previous) => ({
                                                ...previous,
                                                cnh: '',
                                            }));
                                        }}
                                    />
                                    {formErrors.cnh ? (
                                        <p className="text-xs text-destructive">
                                            {formErrors.cnh}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="validade-cnh">
                                        Validade CNH
                                    </Label>
                                    <Input
                                        id="validade-cnh"
                                        type="date"
                                        value={formData.validade_cnh}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                validade_cnh:
                                                    event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-4">
                                <div className="space-y-2">
                                    <Label>Sexo</Label>
                                    <div className="flex h-9 items-center gap-4 rounded-md border px-3">
                                        <label className="inline-flex items-center gap-2 text-sm">
                                            <input
                                                type="radio"
                                                name="sexo"
                                                checked={formData.sexo === 'M'}
                                                onChange={() =>
                                                    setFormData((previous) => ({
                                                        ...previous,
                                                        sexo: 'M',
                                                    }))
                                                }
                                            />
                                            M
                                        </label>
                                        <label className="inline-flex items-center gap-2 text-sm">
                                            <input
                                                type="radio"
                                                name="sexo"
                                                checked={formData.sexo === 'F'}
                                                onChange={() =>
                                                    setFormData((previous) => ({
                                                        ...previous,
                                                        sexo: 'F',
                                                    }))
                                                }
                                            />
                                            F
                                        </label>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="nascimento">
                                        Data de nascimento
                                    </Label>
                                    <Input
                                        id="nascimento"
                                        type="date"
                                        value={formData.data_nascimento}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                data_nascimento:
                                                    event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="telefone">Telefone</Label>
                                    <IMaskInput
                                        id="telefone"
                                        mask="(00) 00000-0000"
                                        value={formData.telefone}
                                        className={maskedInputClassName}
                                        inputMode="numeric"
                                        overwrite
                                        unmask={false}
                                        onAccept={(value) => {
                                            setFormData((previous) => ({
                                                ...previous,
                                                telefone: String(value),
                                            }));
                                            setFormErrors((previous) => ({
                                                ...previous,
                                                telefone: '',
                                            }));
                                        }}
                                    />
                                    {formErrors.telefone ? (
                                        <p className="text-xs text-destructive">
                                            {formErrors.telefone}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="validade-exame-toxico">
                                        Data val. exame tox.
                                    </Label>
                                    <Input
                                        id="validade-exame-toxico"
                                        type="date"
                                        value={
                                            formData.validade_exame_toxicologico
                                        }
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                validade_exame_toxicologico:
                                                    event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="admissao">
                                        Data de admissão
                                    </Label>
                                    <Input
                                        id="admissao"
                                        type="date"
                                        value={formData.data_admissao}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                data_admissao:
                                                    event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="demissao">
                                        Data de demissão
                                    </Label>
                                    <Input
                                        id="demissao"
                                        type="date"
                                        value={formData.data_demissao}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                data_demissao:
                                                    event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">E-mail</Label>
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
                                    />
                                    {formErrors.email ? (
                                        <p className="text-xs text-destructive">
                                            {formErrors.email}
                                        </p>
                                    ) : null}
                                </div>
                            </div>

                            <div className="rounded-lg border bg-muted/10 p-3">
                                <p className="mb-3 text-sm font-semibold">
                                    Endereço
                                </p>
                                <div className="grid gap-3 md:grid-cols-6">
                                    <div className="space-y-2 md:col-span-1">
                                        <Label htmlFor="cep">CEP</Label>
                                        <IMaskInput
                                            id="cep"
                                            mask="00000-000"
                                            value={formData.cep}
                                            className={maskedInputClassName}
                                            onAccept={(value) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    cep: String(value),
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-3">
                                        <Label htmlFor="logradouro">
                                            Rua / Logradouro
                                        </Label>
                                        <Input
                                            id="logradouro"
                                            value={formData.logradouro}
                                            onChange={(event) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    logradouro:
                                                        event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-1">
                                        <Label htmlFor="numero-endereco">
                                            Nº
                                        </Label>
                                        <Input
                                            id="numero-endereco"
                                            value={formData.numero_endereco}
                                            onChange={(event) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    numero_endereco:
                                                        event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-1">
                                        <Label htmlFor="complemento">
                                            Complemento
                                        </Label>
                                        <Input
                                            id="complemento"
                                            value={formData.complemento}
                                            onChange={(event) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    complemento:
                                                        event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="bairro">Bairro</Label>
                                        <Input
                                            id="bairro"
                                            value={formData.bairro}
                                            onChange={(event) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    bairro: event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="cidade-uf">
                                            Cidade/UF
                                        </Label>
                                        <Input
                                            id="cidade-uf"
                                            value={formData.cidade_uf}
                                            onChange={(event) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    cidade_uf:
                                                        event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="endereco">
                                            Endereço completo
                                        </Label>
                                        <Input
                                            id="endereco"
                                            value={formData.endereco_completo}
                                            onChange={(event) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    endereco_completo:
                                                        event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border bg-muted/10 p-3">
                                <p className="mb-3 text-sm font-semibold">
                                    Dados bancários - Conta particular
                                </p>
                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="numero-banco">
                                            Número do banco
                                        </Label>
                                        <Input
                                            id="numero-banco"
                                            value={formData.numero_banco}
                                            onChange={(event) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    numero_banco:
                                                        event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="nome-banco">
                                            Nome do banco
                                        </Label>
                                        <Input
                                            id="nome-banco"
                                            value={formData.nome_banco}
                                            onChange={(event) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    nome_banco:
                                                        event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="agencia">
                                            Número da agência
                                        </Label>
                                        <Input
                                            id="agencia"
                                            value={formData.numero_agencia}
                                            onChange={(event) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    numero_agencia:
                                                        event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="mt-3 grid gap-3 md:grid-cols-4">
                                    <div className="space-y-2">
                                        <Label>Tipo de conta</Label>
                                        <Select
                                            value={formData.tipo_conta}
                                            onValueChange={(value) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    tipo_conta: value,
                                                }))
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="poupanca">
                                                    Poupanca
                                                </SelectItem>
                                                <SelectItem value="corrente">
                                                    Corrente
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="conta">
                                            Número da conta
                                        </Label>
                                        <Input
                                            id="conta"
                                            value={formData.numero_conta}
                                            onChange={(event) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    numero_conta:
                                                        event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="pix">Chave PIX</Label>
                                        <Input
                                            id="pix"
                                            value={formData.chave_pix}
                                            onChange={(event) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    chave_pix:
                                                        event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="mt-3 grid gap-3 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label>Tipo da chave PIX</Label>
                                        <Select
                                            value={formData.tipo_chave_pix}
                                            onValueChange={(value) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    tipo_chave_pix: value,
                                                }))
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="cpf_cnpj">
                                                    CPF/CNPJ
                                                </SelectItem>
                                                <SelectItem value="celular">
                                                    Celular
                                                </SelectItem>
                                                <SelectItem value="email">
                                                    E-mail
                                                </SelectItem>
                                                <SelectItem value="aleatoria">
                                                    Aleatoria
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="banco-1">
                                            Dados bancários 1 (opcional)
                                        </Label>
                                        <Input
                                            id="banco-1"
                                            value={formData.dados_bancarios_1}
                                            onChange={(event) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    dados_bancarios_1:
                                                        event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="banco-2">
                                            Dados bancários 2 (opcional)
                                        </Label>
                                        <Input
                                            id="banco-2"
                                            value={formData.dados_bancarios_2}
                                            onChange={(event) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    dados_bancarios_2:
                                                        event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border bg-muted/10 p-3">
                                <p className="mb-3 text-sm font-semibold">
                                    Dados bancários - Conta salário
                                </p>
                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label>Banco</Label>
                                        <Select
                                            value={formData.banco_salario}
                                            onValueChange={(value) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    banco_salario: value,
                                                }))
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="brasil">
                                                    Brasil
                                                </SelectItem>
                                                <SelectItem value="bradesco">
                                                    Bradesco
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="agencia-salario">
                                            Número da agência
                                        </Label>
                                        <Input
                                            id="agencia-salario"
                                            value={formData.numero_agencia_salario}
                                            onChange={(event) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    numero_agencia_salario:
                                                        event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="conta-salario">
                                            Número da conta
                                        </Label>
                                        <Input
                                            id="conta-salario"
                                            value={formData.numero_conta_salario}
                                            onChange={(event) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    numero_conta_salario:
                                                        event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Qual conta usar para pagamento</Label>
                                    <Select
                                        value={formData.conta_pagamento}
                                        onValueChange={(value) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                conta_pagamento: value,
                                            }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="salario">
                                                Salario
                                            </SelectItem>
                                            <SelectItem value="particular">
                                                Particular
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Qual cartão benefício</Label>
                                    <Select
                                        value={formData.cartao_beneficio}
                                        onValueChange={(value) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                cartao_beneficio: value,
                                            }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="alelo">
                                                Alelo
                                            </SelectItem>
                                            <SelectItem value="vr">VR</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
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
                                data-save-action="true"
                                disabled={
                                    saving ||
                                    !formData.unidade_id ||
                                    !formData.funcao_id ||
                                    !formData.nome ||
                                    !formData.cpf
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

            <Dialog
                open={detailsOpen}
                onOpenChange={(open) => {
                    setDetailsOpen(open);
                    if (!open) {
                        setQuickEditOpen(false);
                        setFeriasModalOpen(false);
                        setAfastamentoModalOpen(false);
                        setEditingAfastamentoId(null);
                    }
                }}
            >
                <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>Perfil do colaborador</DialogTitle>
                        <DialogDescription>
                            Visão principal sempre disponível no topo e páginas
                            internas para contato, férias, afastamentos e dados
                            bancários. Dê dois cliques em um campo para editar.
                        </DialogDescription>
                    </DialogHeader>

                    {detailsItem ? (
                        <div className="max-h-[calc(92vh-9rem)] space-y-4 overflow-y-auto pr-2">
                            <div className="rounded-xl border bg-muted/20 p-4">
                                <div className="grid gap-4 lg:grid-cols-[120px_1fr]">
                                    <div className="flex justify-center lg:justify-start">
                                        <Avatar className="h-28 w-24 rounded-md border">
                                            <AvatarImage
                                                src={
                                                    detailsItem.foto_3x4_url ??
                                                    undefined
                                                }
                                                alt={detailsItem.nome}
                                                className="object-cover"
                                            />
                                            <AvatarFallback className="rounded-md text-2xl font-bold">
                                                {detailsItem.nome
                                                    .trim()
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="grid gap-3 md:grid-cols-4">
                                            <div className="rounded-lg border bg-background p-3">
                                                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                    Código
                                                </p>
                                                <p className="text-base font-semibold">
                                                    {String(detailsItem.id).padStart(
                                                        6,
                                                        '0',
                                                    )}
                                                </p>
                                            </div>
                                            <div
                                                className="cursor-pointer rounded-lg border bg-background p-3 transition-colors hover:bg-muted/40 md:col-span-2"
                                                onDoubleClick={() =>
                                                    openQuickEdit(
                                                        'nome',
                                                        'Nome do colaborador',
                                                    )
                                                }
                                                title="Dê dois cliques para editar"
                                            >
                                                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                    Nome do colaborador
                                                </p>
                                                <p className="text-base font-semibold">
                                                    {detailsItem.nome}
                                                </p>
                                            </div>
                                            <div
                                                className="cursor-pointer rounded-lg border bg-background p-3 transition-colors hover:bg-muted/40"
                                                onDoubleClick={() =>
                                                    openQuickEdit(
                                                        'funcao_id',
                                                        'Cargo',
                                                        'select',
                                                        funcoes.map((funcao) => ({
                                                            value: String(
                                                                funcao.id,
                                                            ),
                                                            label: funcao.nome,
                                                        })),
                                                    )
                                                }
                                                title="Dê dois cliques para editar"
                                            >
                                                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                    Cargo
                                                </p>
                                                <p className="text-base font-semibold">
                                                    {selectedFuncaoName}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-4">
                                            <div
                                                className="cursor-pointer rounded-lg border bg-background p-3 transition-colors hover:bg-muted/40"
                                                onDoubleClick={() =>
                                                    openQuickEdit(
                                                        'ativo',
                                                        'Status ativo',
                                                        'select',
                                                        [
                                                            {
                                                                value: '1',
                                                                label: 'Sim',
                                                            },
                                                            {
                                                                value: '0',
                                                                label: 'Não',
                                                            },
                                                        ],
                                                    )
                                                }
                                                title="Dê dois cliques para editar"
                                            >
                                                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                    Ativo
                                                </p>
                                                <p className="text-sm font-medium">
                                                    {detailsItem.ativo
                                                        ? 'Sim'
                                                        : 'Não'}
                                                </p>
                                            </div>
                                            <div
                                                className="cursor-pointer rounded-lg border bg-background p-3 transition-colors hover:bg-muted/40"
                                                onDoubleClick={() =>
                                                    openQuickEdit(
                                                        'apelido',
                                                        'Apelido',
                                                    )
                                                }
                                                title="Dê dois cliques para editar"
                                            >
                                                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                    Apelido
                                                </p>
                                                <p className="text-sm font-medium">
                                                    {detailsItem.apelido ?? '-'}
                                                </p>
                                            </div>
                                            <div
                                                className="cursor-pointer rounded-lg border bg-background p-3 transition-colors hover:bg-muted/40"
                                                onDoubleClick={() =>
                                                    openQuickEdit(
                                                        'sexo',
                                                        'Sexo',
                                                        'select',
                                                        [
                                                            {
                                                                value: 'M',
                                                                label: 'M',
                                                            },
                                                            {
                                                                value: 'F',
                                                                label: 'F',
                                                            },
                                                        ],
                                                    )
                                                }
                                                title="Dê dois cliques para editar"
                                            >
                                                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                    Sexo
                                                </p>
                                                <p className="text-sm font-medium">
                                                    {detailsItem.sexo ?? '-'}
                                                </p>
                                            </div>
                                            <div
                                                className="cursor-pointer rounded-lg border bg-background p-3 transition-colors hover:bg-muted/40"
                                                onDoubleClick={() =>
                                                    openQuickEdit(
                                                        'unidade_id',
                                                        'Empresa',
                                                        'select',
                                                        unidades.map(
                                                            (unidade) => ({
                                                                value: String(
                                                                    unidade.id,
                                                                ),
                                                                label: unidade.nome,
                                                            }),
                                                        ),
                                                    )
                                                }
                                                title="Dê dois cliques para editar"
                                            >
                                                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                    Empresa
                                                </p>
                                                <p className="text-sm font-medium">
                                                    {selectedUnidadeName}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                                <div
                                    className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                    onDoubleClick={() =>
                                        openQuickEdit('cpf', 'CPF')
                                    }
                                    title="Dê dois cliques para editar"
                                >
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        CPF
                                    </p>
                                    <p className="text-sm font-medium">
                                        {detailsItem.cpf}
                                    </p>
                                </div>
                                <div
                                    className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                    onDoubleClick={() =>
                                        openQuickEdit('rg', 'RG')
                                    }
                                    title="Dê dois cliques para editar"
                                >
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        RG
                                    </p>
                                    <p className="text-sm font-medium">
                                        {detailsItem.rg
                                            ? formatRg(detailsItem.rg)
                                            : '-'}
                                    </p>
                                </div>
                                <div
                                    className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                    onDoubleClick={() =>
                                        openQuickEdit(
                                            'data_nascimento',
                                            'Data nascimento',
                                            'date',
                                        )
                                    }
                                    title="Dê dois cliques para editar"
                                >
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        Data nascimento
                                    </p>
                                    <p className="text-sm font-medium">
                                        {dateToView(detailsItem.data_nascimento)}
                                    </p>
                                </div>
                                <div
                                    className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                    onDoubleClick={() =>
                                        openQuickEdit(
                                            'data_admissao',
                                            'Data admissão',
                                            'date',
                                        )
                                    }
                                    title="Dê dois cliques para editar"
                                >
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        Data admissão
                                    </p>
                                    <p className="text-sm font-medium">
                                        {dateToView(detailsItem.data_admissao)}
                                    </p>
                                </div>
                                <div
                                    className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                    onDoubleClick={() =>
                                        openQuickEdit(
                                            'data_demissao',
                                            'Data demissão',
                                            'date',
                                        )
                                    }
                                    title="Dê dois cliques para editar"
                                >
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        Data demissão
                                    </p>
                                    <p className="text-sm font-medium">
                                        {dateToView(detailsItem.data_demissao)}
                                    </p>
                                </div>
                                <div
                                    className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                    onDoubleClick={() =>
                                        openQuickEdit('cnh', 'Nº registro CNH')
                                    }
                                    title="Dê dois cliques para editar"
                                >
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        Nº registro CNH
                                    </p>
                                    <p className="text-sm font-medium">
                                        {detailsItem.cnh ?? '-'}
                                    </p>
                                </div>
                                <div
                                    className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                    onDoubleClick={() =>
                                        openQuickEdit(
                                            'validade_cnh',
                                            'Data validade CNH',
                                            'date',
                                        )
                                    }
                                    title="Dê dois cliques para editar"
                                >
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        Data validade CNH
                                    </p>
                                    <p className="text-sm font-medium">
                                        {dateToView(detailsItem.validade_cnh)}
                                    </p>
                                </div>
                                <div
                                    className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                    onDoubleClick={() =>
                                        openQuickEdit(
                                            'validade_exame_toxicologico',
                                            'Data val. exame tox.',
                                            'date',
                                        )
                                    }
                                    title="Dê dois cliques para editar"
                                >
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        Data val. exame tox.
                                    </p>
                                    <p className="text-sm font-medium">
                                        {dateToView(
                                            detailsItem.validade_exame_toxicologico,
                                        )}
                                    </p>
                                </div>
                                <div className="rounded-lg border p-3 lg:col-span-2">
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        Salário inicial
                                    </p>
                                    <p className="text-sm font-medium">R$ 0,00</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 border-b pb-2">
                                <Button
                                    type="button"
                                    variant={
                                        detailsTab === 'contato'
                                            ? 'default'
                                            : 'outline'
                                    }
                                    size="sm"
                                    onClick={() => setDetailsTab('contato')}
                                >
                                    Contato
                                </Button>
                                <Button
                                    type="button"
                                    variant={
                                        detailsTab === 'ferias'
                                            ? 'default'
                                            : 'outline'
                                    }
                                    size="sm"
                                    onClick={() => setDetailsTab('ferias')}
                                >
                                    Férias
                                </Button>
                                <Button
                                    type="button"
                                    variant={
                                        detailsTab === 'afastamentos'
                                            ? 'default'
                                            : 'outline'
                                    }
                                    size="sm"
                                    onClick={() =>
                                        setDetailsTab('afastamentos')
                                    }
                                >
                                    Afastamentos
                                </Button>
                                <Button
                                    type="button"
                                    variant={
                                        detailsTab === 'dados_bancarios'
                                            ? 'default'
                                            : 'outline'
                                    }
                                    size="sm"
                                    onClick={() =>
                                        setDetailsTab('dados_bancarios')
                                    }
                                >
                                    Dados bancários
                                </Button>
                            </div>

                            {detailsTab === 'contato' ? (
                                <div className="grid gap-3 md:grid-cols-6">
                                    <div className="md:col-span-6 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                                        Dica: nesta seção, clique duas vezes em qualquer campo para editar sem sair do perfil.
                                    </div>
                                    <div
                                        className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40 md:col-span-1"
                                        onDoubleClick={() =>
                                            openQuickEdit('telefone', 'Telefone')
                                        }
                                        title="Dê dois cliques para editar"
                                    >
                                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                            Telefone
                                        </p>
                                        <p className="text-sm font-medium">
                                            {formatPhone(detailsItem.telefone ?? '') || '-'}
                                        </p>
                                    </div>
                                    <div
                                        className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40 md:col-span-3"
                                        onDoubleClick={() =>
                                            openQuickEdit('email', 'E-mail')
                                        }
                                        title="Dê dois cliques para editar"
                                    >
                                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                            E-mail
                                        </p>
                                        <p className="text-sm font-medium break-all">
                                            {detailsItem.email ?? '-'}
                                        </p>
                                    </div>
                                    <div
                                        className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40 md:col-span-2 lg:col-span-1"
                                        onDoubleClick={() =>
                                            openQuickEdit('cep', 'CEP')
                                        }
                                        title="Dê dois cliques para editar"
                                    >
                                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                            CEP
                                        </p>
                                        <p className="text-sm font-medium">
                                            {formatCep(detailsItem.cep)}
                                        </p>
                                    </div>
                                    <div
                                        className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40 md:col-span-4"
                                        onDoubleClick={() =>
                                            openQuickEdit(
                                                'logradouro',
                                                'Rua / Logradouro',
                                            )
                                        }
                                        title="Dê dois cliques para editar"
                                    >
                                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                            Rua / Logradouro
                                        </p>
                                        <p className="text-sm font-medium">
                                            {detailsItem.logradouro ?? '-'}
                                        </p>
                                    </div>
                                    <div
                                        className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40 md:col-span-1"
                                        onDoubleClick={() =>
                                            openQuickEdit(
                                                'numero_endereco',
                                                'Número',
                                            )
                                        }
                                        title="Dê dois cliques para editar"
                                    >
                                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                            Nº
                                        </p>
                                        <p className="text-sm font-medium">
                                            {detailsItem.numero_endereco ?? '-'}
                                        </p>
                                    </div>
                                    <div
                                        className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40 md:col-span-2"
                                        onDoubleClick={() =>
                                            openQuickEdit(
                                                'complemento',
                                                'Complemento',
                                            )
                                        }
                                        title="Dê dois cliques para editar"
                                    >
                                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                            Complemento
                                        </p>
                                        <p className="text-sm font-medium">
                                            {detailsItem.complemento ?? '-'}
                                        </p>
                                    </div>
                                    <div
                                        className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40 md:col-span-1"
                                        onDoubleClick={() =>
                                            openQuickEdit('bairro', 'Bairro')
                                        }
                                        title="Dê dois cliques para editar"
                                    >
                                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                            Bairro
                                        </p>
                                        <p className="text-sm font-medium">
                                            {detailsItem.bairro ?? '-'}
                                        </p>
                                    </div>
                                    <div
                                        className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40 md:col-span-2"
                                        onDoubleClick={() =>
                                            openQuickEdit(
                                                'cidade_uf',
                                                'Cidade/UF',
                                            )
                                        }
                                        title="Dê dois cliques para editar"
                                    >
                                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                            Cidade/UF
                                        </p>
                                        <p className="text-sm font-medium">
                                            {detailsItem.cidade_uf ?? '-'}
                                        </p>
                                    </div>
                                    <div
                                        className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40 md:col-span-6"
                                        onDoubleClick={() =>
                                            openQuickEdit(
                                                'endereco_completo',
                                                'Endereço completo',
                                            )
                                        }
                                        title="Dê dois cliques para editar"
                                    >
                                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                            Endereço completo
                                        </p>
                                        <p className="text-sm font-medium">
                                            {detailsItem.endereco_completo ?? '-'}
                                        </p>
                                    </div>
                                </div>
                            ) : null}

                            {detailsTab === 'ferias' ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold">
                                            Férias lançadas
                                        </h3>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={openFeriasCreateModal}
                                        >
                                            <PlusCircle className="size-4" />
                                            Lançar nova...
                                        </Button>
                                    </div>
                                    <div className="overflow-x-auto rounded-lg border">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/40 text-left">
                                                <tr>
                                                    <th className="px-3 py-2 font-medium">
                                                        Data início
                                                    </th>
                                                    <th className="px-3 py-2 font-medium">
                                                        Data término
                                                    </th>
                                                    <th className="px-3 py-2 font-medium">
                                                        Observações
                                                    </th>
                                                    <th className="px-3 py-2 font-medium text-right">
                                                        Ações
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(feriasByColaborador[
                                                    detailsItem.id
                                                ] ?? []).map((item) => (
                                                    <tr
                                                        key={item.id}
                                                        className="border-t"
                                                    >
                                                        <td className="px-3 py-2">
                                                            {dateToView(
                                                                item.data_inicio,
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {dateToView(
                                                                item.data_termino,
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {item.observacoes ??
                                                                '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => openFeriasEditModal(item)}
                                                            >
                                                                Editar
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {(feriasByColaborador[
                                                    detailsItem.id
                                                ] ?? []).length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={4}
                                                            className="px-3 py-6 text-center text-muted-foreground"
                                                        >
                                                            Nenhum lançamento de férias encontrado.
                                                        </td>
                                                    </tr>
                                                ) : null}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Esta seção é sincronizada com o painel Controle de Férias.
                                    </p>
                                </div>
                            ) : null}

                            {detailsTab === 'afastamentos' ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold">
                                            Afastamentos
                                        </h3>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={openAfastamentoCreateModal}
                                        >
                                            <PlusCircle className="size-4" />
                                            Lançar novo...
                                        </Button>
                                    </div>
                                    <div className="overflow-x-auto rounded-lg border">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/40 text-left">
                                                <tr>
                                                    <th className="px-3 py-2 font-medium">
                                                        Data início
                                                    </th>
                                                    <th className="px-3 py-2 font-medium">
                                                        Data término
                                                    </th>
                                                    <th className="px-3 py-2 font-medium">
                                                        Motivo
                                                    </th>
                                                    <th className="px-3 py-2 font-medium">
                                                        Observações
                                                    </th>
                                                    <th className="px-3 py-2 font-medium text-right">
                                                        Ações
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(afastamentosByColaborador[
                                                    detailsItem.id
                                                ] ?? []).map((item) => (
                                                    <tr
                                                        key={item.id}
                                                        className="cursor-pointer border-t hover:bg-muted/40"
                                                        onDoubleClick={() =>
                                                            openAfastamentoEditModal(
                                                                item,
                                                            )
                                                        }
                                                        title="Dê dois cliques para editar"
                                                    >
                                                        <td className="px-3 py-2">
                                                            {dateToView(
                                                                item.data_inicio,
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {dateToView(
                                                                item.data_termino,
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {item.motivo}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {item.observacoes ??
                                                                '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    openAfastamentoEditModal(
                                                                        item,
                                                                    )
                                                                }
                                                            >
                                                                Editar
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {(afastamentosByColaborador[
                                                    detailsItem.id
                                                ] ?? []).length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={5}
                                                            className="px-3 py-6 text-center text-muted-foreground"
                                                        >
                                                            Nenhum afastamento
                                                            lançado.
                                                        </td>
                                                    </tr>
                                                ) : null}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : null}

                            {detailsTab === 'dados_bancarios' ? (
                                <div className="space-y-4">
                                    <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                                        Dica: nos dados bancários, clique duas vezes no campo para editar.
                                    </div>
                                    <div className="space-y-3">
                                        <p className="text-sm font-semibold">
                                            Conta particular
                                        </p>
                                        <div className="grid gap-3 md:grid-cols-3">
                                            <div
                                                className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                                onDoubleClick={() =>
                                                    openQuickEdit(
                                                        'numero_banco',
                                                        'Número do banco',
                                                    )
                                                }
                                                title="Dê dois cliques para editar"
                                            >
                                                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                    Número do banco
                                                </p>
                                                <p className="text-sm font-medium">
                                                    {detailsItem.numero_banco ??
                                                        '-'}
                                                </p>
                                            </div>
                                            <div
                                                className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                                onDoubleClick={() =>
                                                    openQuickEdit(
                                                        'nome_banco',
                                                        'Nome do banco',
                                                    )
                                                }
                                                title="Dê dois cliques para editar"
                                            >
                                                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                    Nome do banco
                                                </p>
                                                <p className="text-sm font-medium">
                                                    {detailsItem.nome_banco ??
                                                        '-'}
                                                </p>
                                            </div>
                                            <div
                                                className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                                onDoubleClick={() =>
                                                    openQuickEdit(
                                                        'numero_agencia',
                                                        'Agência',
                                                    )
                                                }
                                                title="Dê dois cliques para editar"
                                            >
                                                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                    Agência
                                                </p>
                                                <p className="text-sm font-medium">
                                                    {detailsItem.numero_agencia ??
                                                        '-'}
                                                </p>
                                            </div>
                                            <div
                                                className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                                onDoubleClick={() =>
                                                    openQuickEdit(
                                                        'tipo_conta',
                                                        'Tipo conta',
                                                        'select',
                                                        [
                                                            {
                                                                value: 'poupanca',
                                                                label: 'Poupança',
                                                            },
                                                            {
                                                                value: 'corrente',
                                                                label: 'Corrente',
                                                            },
                                                        ],
                                                    )
                                                }
                                                title="Dê dois cliques para editar"
                                            >
                                                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                    Tipo conta
                                                </p>
                                                <p className="text-sm font-medium">
                                                    {enumLabel(
                                                        detailsItem.tipo_conta,
                                                        {
                                                            poupanca:
                                                                'Poupanca',
                                                            corrente:
                                                                'Corrente',
                                                        },
                                                    )}
                                                </p>
                                            </div>
                                            <div
                                                className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                                onDoubleClick={() =>
                                                    openQuickEdit(
                                                        'numero_conta',
                                                        'Número conta',
                                                    )
                                                }
                                                title="Dê dois cliques para editar"
                                            >
                                                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                    Número conta
                                                </p>
                                                <p className="text-sm font-medium">
                                                    {detailsItem.numero_conta ??
                                                        '-'}
                                                </p>
                                            </div>
                                            <div
                                                className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                                onDoubleClick={() =>
                                                    openQuickEdit(
                                                        'chave_pix',
                                                        'Chave PIX',
                                                    )
                                                }
                                                title="Dê dois cliques para editar"
                                            >
                                                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                    Chave PIX
                                                </p>
                                                <p className="text-sm font-medium break-all">
                                                    {detailsItem.chave_pix ??
                                                        '-'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-sm font-semibold">
                                            Conta salário
                                        </p>
                                        <div className="grid gap-3 md:grid-cols-3">
                                            <div
                                                className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                                onDoubleClick={() =>
                                                    openQuickEdit(
                                                        'banco_salario',
                                                        'Banco salário',
                                                        'select',
                                                        [
                                                            {
                                                                value: 'brasil',
                                                                label: 'Brasil',
                                                            },
                                                            {
                                                                value: 'bradesco',
                                                                label: 'Bradesco',
                                                            },
                                                        ],
                                                    )
                                                }
                                                title="Dê dois cliques para editar"
                                            >
                                                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                    Banco
                                                </p>
                                                <p className="text-sm font-medium">
                                                    {enumLabel(
                                                        detailsItem.banco_salario,
                                                        {
                                                            brasil: 'Brasil',
                                                            bradesco:
                                                                'Bradesco',
                                                        },
                                                    )}
                                                </p>
                                            </div>
                                            <div
                                                className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                                onDoubleClick={() =>
                                                    openQuickEdit(
                                                        'numero_agencia_salario',
                                                        'Agência salário',
                                                    )
                                                }
                                                title="Dê dois cliques para editar"
                                            >
                                                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                    Agência
                                                </p>
                                                <p className="text-sm font-medium">
                                                    {detailsItem.numero_agencia_salario ??
                                                        '-'}
                                                </p>
                                            </div>
                                            <div
                                                className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                                onDoubleClick={() =>
                                                    openQuickEdit(
                                                        'numero_conta_salario',
                                                        'Número conta salário',
                                                    )
                                                }
                                                title="Dê dois cliques para editar"
                                            >
                                                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                    Número conta
                                                </p>
                                                <p className="text-sm font-medium">
                                                    {detailsItem.numero_conta_salario ??
                                                        '-'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div
                                            className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                            onDoubleClick={() =>
                                                openQuickEdit(
                                                    'conta_pagamento',
                                                    'Conta usada para pagamento',
                                                    'select',
                                                    [
                                                        {
                                                            value: 'salario',
                                                            label: 'Salário',
                                                        },
                                                        {
                                                            value: 'particular',
                                                            label: 'Particular',
                                                        },
                                                    ],
                                                )
                                            }
                                            title="Dê dois cliques para editar"
                                        >
                                            <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                Conta usada para pagamento
                                            </p>
                                            <p className="text-sm font-medium">
                                                {enumLabel(
                                                    detailsItem.conta_pagamento,
                                                    {
                                                        salario: 'Salario',
                                                        particular:
                                                            'Particular',
                                                    },
                                                )}
                                            </p>
                                        </div>
                                        <div
                                            className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                            onDoubleClick={() =>
                                                openQuickEdit(
                                                    'cartao_beneficio',
                                                    'Cartão benefício',
                                                    'select',
                                                    [
                                                        {
                                                            value: 'alelo',
                                                            label: 'Alelo',
                                                        },
                                                        {
                                                            value: 'vr',
                                                            label: 'VR',
                                                        },
                                                    ],
                                                )
                                            }
                                            title="Dê dois cliques para editar"
                                        >
                                            <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                                Cartão benefício
                                            </p>
                                            <p className="text-sm font-medium">
                                                {enumLabel(
                                                    detailsItem.cartao_beneficio,
                                                    {
                                                        alelo: 'Alelo',
                                                        vr: 'VR',
                                                    },
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setDetailsOpen(false)}
                                >
                                    Fechar perfil
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            <Dialog
                open={quickEditOpen}
                onOpenChange={(open) => {
                    setQuickEditOpen(open);
                    if (!open) {
                        setQuickEditField(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar campo</DialogTitle>
                        <DialogDescription>
                            Atualize <strong>{quickEditLabel}</strong> e grave sem sair do perfil.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                        <Label>{quickEditLabel}</Label>
                        {quickEditType === 'select' ? (
                            <Select
                                value={quickEditValue}
                                onValueChange={setQuickEditValue}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {quickEditOptions.map((option) => (
                                        <SelectItem
                                            key={`${option.value}-${option.label}`}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                type={quickEditType === 'date' ? 'date' : 'text'}
                                value={quickEditValue}
                                onChange={(event) =>
                                    setQuickEditValue(event.target.value)
                                }
                            />
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setQuickEditOpen(false)}
                            disabled={quickEditSaving}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            data-save-action="true"
                            onClick={() => void saveQuickEdit()}
                            disabled={quickEditSaving || !quickEditField}
                        >
                            {quickEditSaving ? 'Gravando...' : 'Gravar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={feriasModalOpen}
                onOpenChange={(open) => {
                    setFeriasModalOpen(open);
                    if (!open) {
                        setEditingFeriasId(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            <span className="inline-flex items-center gap-2">
                                <CalendarDays className="size-4" />
                                {editingFeriasId
                                    ? 'Editar lançamento de férias'
                                    : 'Novo lançamento de férias'}
                            </span>
                        </DialogTitle>
                        <DialogDescription>
                            {editingFeriasId
                                ? 'Ajuste o lançamento de férias selecionado.'
                                : 'Registre o período de férias para salvar diretamente no Controle de Férias.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="ferias-inicio">Data início</Label>
                                <Input
                                    id="ferias-inicio"
                                    type="date"
                                    value={feriasDraft.data_inicio}
                                    onChange={(event) =>
                                        setFeriasDraft((previous) => ({
                                            ...previous,
                                            data_inicio: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ferias-fim">Data término</Label>
                                <Input
                                    id="ferias-fim"
                                    type="date"
                                    value={feriasDraft.data_termino}
                                    onChange={(event) =>
                                        setFeriasDraft((previous) => ({
                                            ...previous,
                                            data_termino: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ferias-obs">Observações</Label>
                            <textarea
                                id="ferias-obs"
                                className="border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex min-h-24 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                value={feriasDraft.observacoes}
                                onChange={(event) =>
                                    setFeriasDraft((previous) => ({
                                        ...previous,
                                        observacoes: event.target.value,
                                    }))
                                }
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setFeriasModalOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            data-save-action="true"
                            onClick={() => void saveFeriasDraft()}
                            disabled={feriasSaving}
                        >
                            {feriasSaving
                                ? 'Gravando...'
                                : editingFeriasId
                                  ? 'Salvar alterações'
                                  : 'Gravar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={afastamentoModalOpen}
                onOpenChange={(open) => {
                    setAfastamentoModalOpen(open);
                    if (!open) {
                        setEditingAfastamentoId(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editingAfastamentoId
                                ? 'Editar afastamento'
                                : 'Novo afastamento'}
                        </DialogTitle>
                        <DialogDescription>
                            Registre período, motivo e observações no perfil do
                            colaborador.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="afastamento-inicio">
                                    Data início
                                </Label>
                                <Input
                                    id="afastamento-inicio"
                                    type="date"
                                    value={afastamentoDraft.data_inicio}
                                    onChange={(event) =>
                                        setAfastamentoDraft((previous) => ({
                                            ...previous,
                                            data_inicio: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="afastamento-fim">
                                    Data término
                                </Label>
                                <Input
                                    id="afastamento-fim"
                                    type="date"
                                    value={afastamentoDraft.data_termino}
                                    onChange={(event) =>
                                        setAfastamentoDraft((previous) => ({
                                            ...previous,
                                            data_termino: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="afastamento-motivo">Motivo</Label>
                            <Input
                                id="afastamento-motivo"
                                value={afastamentoDraft.motivo}
                                onChange={(event) =>
                                    setAfastamentoDraft((previous) => ({
                                        ...previous,
                                        motivo: event.target.value,
                                    }))
                                }
                                placeholder="Ex.: Licença médica"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="afastamento-obs">Observações</Label>
                            <textarea
                                id="afastamento-obs"
                                className="border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex min-h-24 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                value={afastamentoDraft.observacoes}
                                onChange={(event) =>
                                    setAfastamentoDraft((previous) => ({
                                        ...previous,
                                        observacoes: event.target.value,
                                    }))
                                }
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setAfastamentoModalOpen(false);
                                setEditingAfastamentoId(null);
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            data-save-action="true"
                            onClick={saveAfastamentoDraft}
                        >
                            {editingAfastamentoId ? 'Salvar' : 'Gravar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                    setDeleteDialogOpen(open);

                    if (!open) {
                        setDeleteCandidate(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir colaborador?</DialogTitle>
                        <DialogDescription>
                            Esta ação remove o colaborador da listagem.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-md border bg-muted/20 p-3 text-sm">
                        <p className="font-medium">
                            {deleteCandidate?.nome ?? '-'}
                        </p>
                        <p className="text-muted-foreground">
                            CPF: {deleteCandidate?.cpf ?? '-'}
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeleteDialogOpen(false)}
                            disabled={deleting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => void handleDeleteCollaborator()}
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

            <Dialog open={importResultOpen} onOpenChange={setImportResultOpen}>
                <DialogContent className="sm:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Resultado da Importação XLSX</DialogTitle>
                        <DialogDescription>
                            Resumo completo do processamento da planilha e erros
                            por linha.
                        </DialogDescription>
                    </DialogHeader>

                    {importResult ? (
                        <div className="space-y-4">
                            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                                <p className="font-medium">
                                    {importResult.total_ignorados > 0
                                        ? 'Importação concluída com pendências.'
                                        : 'Importação concluída sem pendências.'}
                                </p>
                                <p className="text-muted-foreground">
                                    Taxa de aproveitamento: {importSuccessRate}%
                                </p>
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-lg border bg-muted/20 p-3">
                                    <p className="text-xs text-muted-foreground uppercase">
                                        Total lidos
                                    </p>
                                    <p className="text-xl font-semibold">
                                        {importResult.total_lidos}
                                    </p>
                                </div>
                                <div className="rounded-lg border bg-muted/20 p-3">
                                    <p className="text-xs text-muted-foreground uppercase">
                                        Total importados
                                    </p>
                                    <p className="text-xl font-semibold">
                                        {importResult.total_importados}
                                    </p>
                                </div>
                                <div className="rounded-lg border bg-muted/20 p-3">
                                    <p className="text-xs text-muted-foreground uppercase">
                                        Total ignorados
                                    </p>
                                    <p className="text-xl font-semibold">
                                        {importResult.total_ignorados}
                                    </p>
                                </div>
                            </div>

                            {importResult.erros.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Nenhum erro encontrado.
                                </p>
                            ) : (
                                <div className="max-h-[360px] overflow-auto rounded-md border">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/40 text-left">
                                            <tr>
                                                <th className="px-3 py-2 font-medium">
                                                    Linha
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Tipo
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Erro
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Detalhes
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importResult.erros.map(
                                                (errorItem, index) => {
                                                    const details =
                                                        Object.entries(
                                                            errorItem,
                                                        )
                                                            .filter(
                                                                ([key]) =>
                                                                    key !==
                                                                        'linha' &&
                                                                    key !==
                                                                        'erro' &&
                                                                    key !==
                                                                        'tipo',
                                                            )
                                                            .map(
                                                                ([
                                                                    key,
                                                                    value,
                                                                ]) =>
                                                                    `${key}: ${value}`,
                                                            )
                                                            .join(' | ');

                                                    return (
                                                        <tr
                                                            key={`${errorItem.linha}-${index}`}
                                                            className="border-t"
                                                        >
                                                            <td className="px-3 py-2">
                                                                <button
                                                                    type="button"
                                                                    className="rounded border px-2 py-1 text-xs hover:bg-muted"
                                                                    title="Copiar número da linha para correção na planilha"
                                                                    onClick={() => {
                                                                        void navigator.clipboard
                                                                            .writeText(String(errorItem.linha))
                                                                            .then(() => {
                                                                                setNotification({
                                                                                    message: `Linha ${errorItem.linha} copiada.`,
                                                                                    variant: 'info',
                                                                                });
                                                                            })
                                                                            .catch(() => {
                                                                                setNotification({
                                                                                    message: 'Não foi possível copiar a linha.',
                                                                                    variant: 'error',
                                                                                });
                                                                            });
                                                                    }}
                                                                >
                                                                    {errorItem.linha}
                                                                </button>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <span className="rounded-full border px-2 py-0.5 text-xs">
                                                                    {importErrorTypeLabel(
                                                                        errorItem.tipo,
                                                                    )}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                {errorItem.erro}
                                                            </td>
                                                            <td className="px-3 py-2 text-muted-foreground">
                                                                {details || '-'}
                                                            </td>
                                                        </tr>
                                                    );
                                                },
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
