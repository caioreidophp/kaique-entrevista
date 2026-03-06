import {
    Eye,
    LoaderCircle,
    PencilLine,
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
    apiGet,
    apiPatch,
    apiPost,
    apiPut,
} from '@/lib/api-client';
import { getAuthToken } from '@/lib/transport-auth';

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
    data_nascimento: string | null;
    data_admissao: string | null;
    data_demissao: string | null;
    telefone: string | null;
    email: string | null;
    endereco_completo: string | null;
    dados_bancarios_1: string | null;
    dados_bancarios_2: string | null;
    chave_pix: string | null;
    nome_banco: string | null;
    numero_banco: string | null;
    numero_agencia: string | null;
    tipo_conta: string | null;
    numero_conta: string | null;
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
    data_nascimento: string;
    data_admissao: string;
    data_demissao: string;
    telefone: string;
    email: string;
    endereco_completo: string;
    dados_bancarios_1: string;
    dados_bancarios_2: string;
    chave_pix: string;
    nome_banco: string;
    numero_banco: string;
    numero_agencia: string;
    tipo_conta: string;
    numero_conta: string;
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
    data_nascimento: '',
    data_admissao: '',
    data_demissao: '',
    telefone: '',
    email: '',
    endereco_completo: '',
    dados_bancarios_1: '',
    dados_bancarios_2: '',
    chave_pix: '',
    nome_banco: '',
    numero_banco: '',
    numero_agencia: '',
    tipo_conta: '',
    numero_conta: '',
};

function normalizeNullable(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}

function dateToInput(value: string | null): string {
    if (!value) return '';
    return value.slice(0, 10);
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

    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)})${digits.slice(2)}`;

    return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7)}`;
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
    return value.replace(/\D/g, '').slice(0, 9);
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

    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const [formOpen, setFormOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Colaborador | null>(null);
    const [detailsItem, setDetailsItem] = useState<Colaborador | null>(null);
    const [deleteCandidate, setDeleteCandidate] = useState<Colaborador | null>(
        null,
    );
    const [formData, setFormData] = useState<ColaboradorFormData>(emptyForm);
    const [prefillHandled, setPrefillHandled] = useState(false);
    const [importingSpreadsheet, setImportingSpreadsheet] = useState(false);
    const [importResult, setImportResult] =
        useState<SpreadsheetImportResult | null>(null);
    const [importResultOpen, setImportResultOpen] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [fotoFile, setFotoFile] = useState<File | null>(null);
    const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null);
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
        setFormData({
            unidade_id: String(item.unidade_id),
            funcao_id: String(item.funcao_id),
            nome: item.nome,
            apelido: item.apelido ?? '',
            sexo: item.sexo ?? '',
            ativo: item.ativo,
            cpf: formatCpf(item.cpf),
            rg: formatRg(item.rg ?? ''),
            cnh: sanitizeCnh(item.cnh ?? ''),
            validade_cnh: dateToInput(item.validade_cnh),
            data_nascimento: dateToInput(item.data_nascimento),
            data_admissao: dateToInput(item.data_admissao),
            data_demissao: dateToInput(item.data_demissao),
            telefone: formatPhone(item.telefone ?? ''),
            email: item.email ?? '',
            endereco_completo: item.endereco_completo ?? '',
            dados_bancarios_1: item.dados_bancarios_1 ?? '',
            dados_bancarios_2: item.dados_bancarios_2 ?? '',
            chave_pix: item.chave_pix ?? '',
            nome_banco: item.nome_banco ?? '',
            numero_banco: item.numero_banco ?? '',
            numero_agencia: item.numero_agencia ?? '',
            tipo_conta: item.tipo_conta ?? '',
            numero_conta: item.numero_conta ?? '',
        });
        setFormErrors({});
        setFotoFile(null);
        setFotoPreviewUrl(item.foto_3x4_url ?? null);
        setFormOpen(true);
    }

    function openDetailsDialog(item: Colaborador): void {
        setDetailsItem(item);
        setDetailsOpen(true);
    }

    function openDeleteDialog(item: Colaborador): void {
        setDeleteCandidate(item);
        setDeleteDialogOpen(true);
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

        if (sanitizedCnh !== '' && !/^\d{9}$/.test(sanitizedCnh)) {
            clientErrors.cnh = 'CNH deve conter exatamente 9 números.';
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

        const payload = {
            unidade_id: Number(formData.unidade_id),
            funcao_id: Number(formData.funcao_id),
            nome: formData.nome.trim(),
            apelido: normalizeNullable(formData.apelido),
            sexo: normalizeNullable(formData.sexo),
            ativo: formData.ativo,
            cpf: sanitizedCpf,
            rg: sanitizedRg !== '' ? sanitizedRg : null,
            cnh: sanitizedCnh !== '' ? sanitizedCnh : null,
            validade_cnh: normalizeNullable(formData.validade_cnh),
            data_nascimento: normalizeNullable(formData.data_nascimento),
            data_admissao: normalizeNullable(formData.data_admissao),
            data_demissao: normalizeNullable(formData.data_demissao),
            telefone: sanitizedPhone !== '' ? sanitizedPhone : null,
            email: normalizedEmail !== '' ? normalizedEmail : null,
            endereco_completo: normalizeNullable(formData.endereco_completo),
            dados_bancarios_1: normalizeNullable(formData.dados_bancarios_1),
            dados_bancarios_2: normalizeNullable(formData.dados_bancarios_2),
            chave_pix: normalizeNullable(formData.chave_pix),
            nome_banco: normalizeNullable(formData.nome_banco),
            numero_banco: normalizeNullable(formData.numero_banco),
            numero_agencia: normalizeNullable(formData.numero_agencia),
            tipo_conta: normalizeNullable(formData.tipo_conta),
            numero_conta: normalizeNullable(formData.numero_conta),
        };

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
                                                Nome
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                Função
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                Unidade
                                            </th>
                                            <th className="py-2 pr-3 font-medium">
                                                CPF
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
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                openDetailsDialog(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            <Eye className="size-4" />
                                                            Ver
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                openEditDialog(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            <PencilLine className="size-4" />
                                                            Editar
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                openDeleteDialog(
                                                                    item,
                                                                )
                                                            }
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
                                    <IMaskInput
                                        id="rg"
                                        mask="000.000.000-a"
                                        definitions={{
                                            a: /[0-9A-Za-z]/,
                                        }}
                                        value={formData.rg}
                                        className={maskedInputClassName}
                                        overwrite
                                        unmask={false}
                                        onAccept={(value) => {
                                            setFormData((previous) => ({
                                                ...previous,
                                                rg: String(value).toUpperCase(),
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
                                        mask="000000000"
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

                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="sexo">Sexo</Label>
                                    <Input
                                        id="sexo"
                                        value={formData.sexo}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                sexo: event.target.value,
                                            }))
                                        }
                                    />
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
                                        mask="(00)00000-0000"
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

                            <div className="space-y-2">
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

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="banco-1">
                                        Dados bancários 1
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
                                        Dados bancários 2
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

                            <div className="grid gap-3 md:grid-cols-5">
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="pix">Chave PIX</Label>
                                    <Input
                                        id="pix"
                                        value={formData.chave_pix}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                chave_pix: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="nome-banco">
                                        Nome do banco
                                    </Label>
                                    <Input
                                        id="nome-banco"
                                        value={formData.nome_banco}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                nome_banco: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="numero-banco">
                                        Nº banco
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
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="agencia">Agência</Label>
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
                                <div className="space-y-2">
                                    <Label htmlFor="tipo-conta">
                                        Tipo de conta
                                    </Label>
                                    <Input
                                        id="tipo-conta"
                                        value={formData.tipo_conta}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                tipo_conta: event.target.value,
                                            }))
                                        }
                                    />
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

            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Detalhes do colaborador</DialogTitle>
                        <DialogDescription>
                            Visualização dos dados principais do cadastro com
                            foco nas informações essenciais.
                        </DialogDescription>
                    </DialogHeader>

                    {detailsItem ? (
                        <div className="space-y-4">
                            <div className="rounded-xl border bg-muted/20 p-4">
                                <div className="grid gap-4 md:grid-cols-[120px_1fr] md:items-center">
                                    <div className="flex justify-center md:justify-start">
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

                                    <div>
                                        <p className="text-3xl leading-tight font-bold">
                                            {detailsItem.nome}
                                        </p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {detailsItem.apelido
                                                ? `Apelido: ${detailsItem.apelido}`
                                                : 'Sem apelido'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-4">
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        Função
                                    </p>
                                    <p className="text-base font-semibold">
                                        {selectedFuncaoName}
                                    </p>
                                </div>
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        Unidade
                                    </p>
                                    <p className="text-base font-semibold">
                                        {selectedUnidadeName}
                                    </p>
                                </div>
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        Status
                                    </p>
                                    <p className="text-base font-semibold">
                                        {detailsItem.ativo
                                            ? 'Ativo'
                                            : 'Inativo'}
                                    </p>
                                </div>
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        CPF
                                    </p>
                                    <p className="text-base font-semibold">
                                        {detailsItem.cpf}
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-3 text-sm md:grid-cols-2">
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        RG
                                    </p>
                                    <p className="text-sm font-medium">
                                        {detailsItem.rg ?? '-'}
                                    </p>
                                </div>
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        CNH
                                    </p>
                                    <p className="text-sm font-medium">
                                        {detailsItem.cnh ?? '-'}
                                    </p>
                                </div>
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        Telefone
                                    </p>
                                    <p className="text-sm font-medium">
                                        {detailsItem.telefone ?? '-'}
                                    </p>
                                </div>
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        E-mail
                                    </p>
                                    <p className="text-sm font-medium break-all">
                                        {detailsItem.email ?? '-'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : null}
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
                                                                {
                                                                    errorItem.linha
                                                                }
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
