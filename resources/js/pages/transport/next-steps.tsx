import { Link } from '@inertiajs/react';
import {
    ClipboardCheck,
    LoaderCircle,
    Printer,
    Search,
    SquareArrowOutUpRight,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Badge } from '@/components/ui/badge';
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
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { apiGet, ApiError, apiPatch, apiPost } from '@/lib/api-client';
import { getAuthToken } from '@/lib/transport-auth';
import type {
    ApiPaginatedResponse,
    NextStepCandidate,
} from '@/types/driver-interview';

interface ColaboradorLookupResponse {
    data: Array<{ id: number }>;
}

interface Unidade {
    id: number;
    nome: string;
}

interface Funcao {
    id: number;
    nome: string;
}

interface WrappedResponse<T> {
    data: T;
}

interface ColaboradorCreateResponse {
    id: number;
}

interface CreateColaboradorForm {
    nome: string;
    apelido: string;
    cpf: string;
    rg: string;
    cnh: string;
    validade_cnh: string;
    telefone: string;
    email: string;
    unidade_id: string;
    funcao_id: string;
    data_admissao: string;
}

interface HiringStatusResponse {
    data: {
        foi_contratado: boolean;
        colaborador_id: number | null;
        onboarding_id: number | null;
        onboarding_status: 'em_andamento' | 'bloqueado' | 'concluido' | null;
    };
}

const emptyColaboradorForm: CreateColaboradorForm = {
    nome: '',
    apelido: '',
    cpf: '',
    rg: '',
    cnh: '',
    validade_cnh: '',
    telefone: '',
    email: '',
    unidade_id: '',
    funcao_id: '',
    data_admissao: '',
};

function normalizeNullable(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}

function sanitizeDigits(value: string): string {
    return value.replace(/\D/g, '');
}

function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function extractFileNameFromDisposition(
    headerValue: string | null,
): string | null {
    if (!headerValue) return null;

    const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);

    if (utf8Match?.[1]) {
        return decodeURIComponent(utf8Match[1]);
    }

    const plainMatch = headerValue.match(/filename="?([^";]+)"?/i);

    return plainMatch?.[1] ?? null;
}

function formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');

    if (digits.length === 11) {
        return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }

    if (digits.length === 10) {
        return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }

    return phone;
}

async function openProtectedHtml(
    url: string,
    autoPrint = false,
): Promise<void> {
    const token = getAuthToken();

    if (!token) {
        throw new Error('Sessão expirada. Faça login novamente.');
    }

    const response = await fetch(url, {
        headers: {
            Accept: 'text/html',
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Não foi possível abrir o documento.');
    }

    const html = await response.text();
    const withPrint = autoPrint
        ? html.replace(
              '</body>',
              '<script>window.onload=function(){window.print();}</script></body>',
          )
        : html;

    const blob = new Blob([withPrint], { type: 'text/html;charset=utf-8' });
    const htmlUrl = URL.createObjectURL(blob);

    window.open(htmlUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(htmlUrl), 60000);
}

async function downloadProtectedPdf(
    url: string,
    fallbackFileName: string,
): Promise<void> {
    const token = getAuthToken();

    if (!token) {
        throw new Error('Sessão expirada. Faça login novamente.');
    }

    const response = await fetch(url, {
        headers: {
            Accept: 'application/pdf',
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Não foi possível baixar o PDF.');
    }

    const blob = await response.blob();
    const fileUrl = URL.createObjectURL(blob);

    const disposition = response.headers.get('Content-Disposition');
    const filename =
        extractFileNameFromDisposition(disposition) ?? fallbackFileName;

    const anchor = document.createElement('a');
    anchor.href = fileUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60000);
}

function DocumentActions({
    title,
    previewUrl,
    downloadUrl,
    fallbackName,
    onBusy,
}: {
    title: string;
    previewUrl: string;
    downloadUrl: string;
    fallbackName: string;
    onBusy: (busy: boolean) => void;
}) {
    async function handleView(): Promise<void> {
        onBusy(true);
        try {
            await openProtectedHtml(previewUrl);
        } finally {
            onBusy(false);
        }
    }

    async function handlePrint(): Promise<void> {
        onBusy(true);
        try {
            await openProtectedHtml(previewUrl, true);
        } finally {
            onBusy(false);
        }
    }

    async function handleDownload(): Promise<void> {
        onBusy(true);
        try {
            await downloadProtectedPdf(downloadUrl, fallbackName);
        } finally {
            onBusy(false);
        }
    }

    return (
        <div className="rounded-md border bg-background p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{title}</p>
                <Badge variant="outline">Documento</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleView}
                >
                    <SquareArrowOutUpRight className="size-4" />
                    Visualizar
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handlePrint}
                >
                    <Printer className="size-4" />
                    Imprimir
                </Button>
                <Button type="button" size="sm" onClick={handleDownload}>
                    Baixar PDF
                </Button>
            </div>
        </div>
    );
}

export default function TransportNextStepsPage() {
    const [items, setItems] = useState<NextStepCandidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search, 450);
    const [error, setError] = useState<string | null>(null);
    const [hiringItemId, setHiringItemId] = useState<number | null>(null);
    const [unidades, setUnidades] = useState<Unidade[]>([]);
    const [funcoes, setFuncoes] = useState<Funcao[]>([]);
    const [formOpen, setFormOpen] = useState(false);
    const [formData, setFormData] =
        useState<CreateColaboradorForm>(emptyColaboradorForm);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [candidateToCreate, setCandidateToCreate] =
        useState<NextStepCandidate | null>(null);

    function applyHiringResult(
        candidateId: number,
        data: HiringStatusResponse['data'],
    ): void {
        setItems((previous) =>
            previous.map((item) =>
                item.id === candidateId
                    ? {
                          ...item,
                          foi_contratado: data.foi_contratado,
                          colaborador_id: data.colaborador_id,
                          onboarding_id: data.onboarding_id,
                          onboarding_status: data.onboarding_status,
                      }
                    : item,
            ),
        );
    }

    async function loadFormOptions(): Promise<{
        unidades: Unidade[];
        funcoes: Funcao[];
    }> {
        if (unidades.length > 0 && funcoes.length > 0) {
            return {
                unidades,
                funcoes,
            };
        }

        const [unidadesResponse, funcoesResponse] = await Promise.all([
            apiGet<WrappedResponse<Unidade[]>>('/registry/unidades'),
            apiGet<WrappedResponse<Funcao[]>>('/registry/funcoes?active=1'),
        ]);

        setUnidades(unidadesResponse.data);
        setFuncoes(funcoesResponse.data);

        return {
            unidades: unidadesResponse.data,
            funcoes: funcoesResponse.data,
        };
    }

    function prefillForm(
        candidate: NextStepCandidate,
        unidadesList: Unidade[],
        funcoesList: Funcao[],
    ): CreateColaboradorForm {
        const normalizedCargo = normalizeText(candidate.cargo_pretendido ?? '');
        const matchingFuncao =
            normalizedCargo.length > 0
                ? funcoesList.find(
                      (funcao) => normalizeText(funcao.nome) === normalizedCargo,
                  )
                : undefined;

        const preferredUnidade =
            candidate.hiring_unidade_id &&
            unidadesList.some((unidade) => unidade.id === candidate.hiring_unidade_id)
                ? String(candidate.hiring_unidade_id)
                : '';

        return {
            nome: candidate.full_name,
            apelido: candidate.preferred_name ?? '',
            cpf: candidate.cpf,
            rg: candidate.rg ?? '',
            cnh: candidate.cnh_number ?? '',
            validade_cnh: (candidate.cnh_expiration_date ?? '').slice(0, 10),
            telefone: candidate.phone,
            email: candidate.email,
            unidade_id: preferredUnidade,
            funcao_id: matchingFuncao ? String(matchingFuncao.id) : '',
            data_admissao: (candidate.start_availability_date ?? '').slice(0, 10),
        };
    }

    async function openCreateCollaboratorModal(
        candidate: NextStepCandidate,
    ): Promise<void> {
        try {
            const { unidades: unidadesList, funcoes: funcoesList } =
                await loadFormOptions();

            setCandidateToCreate(candidate);
            setFormErrors({});
            setFormData(prefillForm(candidate, unidadesList, funcoesList));
            setFormOpen(true);
        } catch (optionsError) {
            if (optionsError instanceof ApiError) {
                setError(optionsError.message);
            } else {
                setError('Não foi possível carregar unidades e funções.');
            }
        }
    }

    async function submitCollaboratorFromInterview(): Promise<void> {
        if (!candidateToCreate) return;

        const clientErrors: Record<string, string> = {};
        const nome = formData.nome.trim();
        const cpf = sanitizeDigits(formData.cpf);
        const rg = formData.rg.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
        const cnh = sanitizeDigits(formData.cnh);
        const telefone = sanitizeDigits(formData.telefone);
        const email = formData.email.trim();

        if (!nome) clientErrors.nome = 'Informe o nome.';
        if (!/^\d{11}$/.test(cpf)) {
            clientErrors.cpf = 'CPF deve conter 11 números.';
        }
        if (!formData.unidade_id) {
            clientErrors.unidade_id = 'Selecione a unidade.';
        }
        if (!formData.funcao_id) {
            clientErrors.funcao_id = 'Selecione a função.';
        }
        if (rg && !/^\d{9}[\dA-Z]$/.test(rg)) {
            clientErrors.rg = 'RG deve ter 9 números + 1 caractere final.';
        }
        if (cnh && !/^\d{11}$/.test(cnh)) {
            clientErrors.cnh = 'CNH deve conter 11 números.';
        }
        if (telefone && !/^\d{11}$/.test(telefone)) {
            clientErrors.telefone = 'Telefone deve conter 11 números.';
        }

        if (Object.keys(clientErrors).length > 0) {
            setFormErrors(clientErrors);
            return;
        }

        setFormSubmitting(true);
        setError(null);
        setFormErrors({});

        try {
            const created = await apiPost<WrappedResponse<ColaboradorCreateResponse>>(
                '/registry/colaboradores',
                {
                    unidade_id: Number(formData.unidade_id),
                    funcao_id: Number(formData.funcao_id),
                    nome,
                    apelido: normalizeNullable(formData.apelido),
                    ativo: true,
                    cpf,
                    rg: rg || null,
                    cnh: cnh || null,
                    validade_cnh: normalizeNullable(formData.validade_cnh),
                    data_admissao: normalizeNullable(formData.data_admissao),
                    telefone: telefone || null,
                    email: email || null,
                },
            );

            const hiringResponse = await apiPatch<HiringStatusResponse>(
                `/next-steps/${candidateToCreate.id}/hiring-status`,
                {
                    foi_contratado: true,
                    colaborador_id: created.data.id,
                },
            );

            applyHiringResult(candidateToCreate.id, hiringResponse.data);
            setFormOpen(false);
            setCandidateToCreate(null);
            setFormData(emptyColaboradorForm);
        } catch (submitError) {
            if (submitError instanceof ApiError) {
                if (submitError.errors) {
                    const flattenedErrors: Record<string, string> = {};
                    Object.entries(submitError.errors).forEach(([field, list]) => {
                        flattenedErrors[field] = list[0] ?? 'Campo inválido.';
                    });
                    setFormErrors((previous) => ({
                        ...previous,
                        ...flattenedErrors,
                    }));
                }
                setError(submitError.message);
            } else {
                setError('Não foi possível cadastrar o colaborador.');
            }
        } finally {
            setFormSubmitting(false);
            setHiringItemId(null);
        }
    }

    async function load(page = 1): Promise<void> {
        setLoading(true);
        setError(null);

        try {
            const response = await apiGet<
                ApiPaginatedResponse<NextStepCandidate>
            >(`/next-steps/candidates?per_page=10&page=${page}`);
            setItems(response.data);
            setCurrentPage(response.meta.current_page);
            setLastPage(response.meta.last_page);
        } catch (fetchError) {
            if (fetchError instanceof ApiError) {
                setError(fetchError.message);
            } else {
                setError('Não foi possível carregar os próximos passos.');
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load(1);
    }, []);

    const filteredItems = useMemo(() => {
        const term = debouncedSearch.trim().toLowerCase();

        if (!term) return items;

        return items.filter((item) =>
            [item.full_name, item.cpf, item.email, item.phone]
                .join(' ')
                .toLowerCase()
                .includes(term),
        );
    }, [items, debouncedSearch]);

    async function handleHiringAction(
        candidate: NextStepCandidate,
        hired: boolean,
    ): Promise<void> {
        setHiringItemId(candidate.id);
        setError(null);

        try {
            if (!hired) {
                const response = await apiPatch<HiringStatusResponse>(
                    `/next-steps/${candidate.id}/hiring-status`,
                    {
                        foi_contratado: false,
                    },
                );

                applyHiringResult(candidate.id, response.data);

                return;
            }

            if (candidate.colaborador_id) {
                const response = await apiPatch<HiringStatusResponse>(
                    `/next-steps/${candidate.id}/hiring-status`,
                    {
                        foi_contratado: true,
                        colaborador_id: candidate.colaborador_id,
                    },
                );

                applyHiringResult(candidate.id, response.data);

                return;
            }

            const lookup = await apiGet<ColaboradorLookupResponse>(
                `/registry/colaboradores?cpf=${encodeURIComponent(candidate.cpf)}&per_page=1`,
            );

            const existing = lookup.data[0];

            if (existing) {
                const response = await apiPatch<HiringStatusResponse>(
                    `/next-steps/${candidate.id}/hiring-status`,
                    {
                        foi_contratado: true,
                        colaborador_id: existing.id,
                    },
                );

                applyHiringResult(candidate.id, response.data);

                return;
            }

            await openCreateCollaboratorModal(candidate);
        } catch (actionError) {
            if (actionError instanceof ApiError) {
                setError(actionError.message);
            } else {
                setError('Não foi possível atualizar o status de contratação.');
            }
        } finally {
            setHiringItemId(null);
        }
    }

    return (
        <AdminLayout title="Próximos Passos" active="next-steps">
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>

                    <Dialog
                        open={formOpen}
                        onOpenChange={(open) => {
                            if (formSubmitting) return;
                            setFormOpen(open);
                            if (!open) {
                                setCandidateToCreate(null);
                                setFormData(emptyColaboradorForm);
                                setFormErrors({});
                                setHiringItemId(null);
                            }
                        }}
                    >
                        <DialogContent className="sm:max-w-3xl">
                            <DialogHeader>
                                <DialogTitle>Cadastrar colaborador contratado</DialogTitle>
                                <DialogDescription>
                                    Dados da entrevista já foram pré-preenchidos. Complete
                                    apenas o necessário para finalizar o cadastro.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="modal-nome">Nome</Label>
                                    <Input
                                        id="modal-nome"
                                        value={formData.nome}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                nome: event.target.value,
                                            }))
                                        }
                                    />
                                    {formErrors.nome ? (
                                        <p className="text-xs text-destructive">
                                            {formErrors.nome}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="modal-apelido">Apelido</Label>
                                    <Input
                                        id="modal-apelido"
                                        value={formData.apelido}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                apelido: event.target.value,
                                            }))
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="modal-cpf">CPF</Label>
                                    <Input
                                        id="modal-cpf"
                                        value={formData.cpf}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                cpf: event.target.value,
                                            }))
                                        }
                                    />
                                    {formErrors.cpf ? (
                                        <p className="text-xs text-destructive">
                                            {formErrors.cpf}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="modal-rg">RG</Label>
                                    <Input
                                        id="modal-rg"
                                        value={formData.rg}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                rg: event.target.value,
                                            }))
                                        }
                                    />
                                    {formErrors.rg ? (
                                        <p className="text-xs text-destructive">
                                            {formErrors.rg}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="modal-cnh">CNH</Label>
                                    <Input
                                        id="modal-cnh"
                                        value={formData.cnh}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                cnh: event.target.value,
                                            }))
                                        }
                                    />
                                    {formErrors.cnh ? (
                                        <p className="text-xs text-destructive">
                                            {formErrors.cnh}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="modal-validade-cnh">Validade CNH</Label>
                                    <Input
                                        id="modal-validade-cnh"
                                        type="date"
                                        value={formData.validade_cnh}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                validade_cnh: event.target.value,
                                            }))
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="modal-telefone">Telefone</Label>
                                    <Input
                                        id="modal-telefone"
                                        value={formData.telefone}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                telefone: event.target.value,
                                            }))
                                        }
                                    />
                                    {formErrors.telefone ? (
                                        <p className="text-xs text-destructive">
                                            {formErrors.telefone}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="modal-email">E-mail</Label>
                                    <Input
                                        id="modal-email"
                                        value={formData.email}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                email: event.target.value,
                                            }))
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Unidade</Label>
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
                                    {formErrors.unidade_id ? (
                                        <p className="text-xs text-destructive">
                                            {formErrors.unidade_id}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="space-y-2">
                                    <Label>Função</Label>
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
                                    {formErrors.funcao_id ? (
                                        <p className="text-xs text-destructive">
                                            {formErrors.funcao_id}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="modal-admissao">Data de admissão</Label>
                                    <Input
                                        id="modal-admissao"
                                        type="date"
                                        value={formData.data_admissao}
                                        onChange={(event) =>
                                            setFormData((previous) => ({
                                                ...previous,
                                                data_admissao: event.target.value,
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
                                        setFormOpen(false);
                                        setCandidateToCreate(null);
                                        setFormData(emptyColaboradorForm);
                                        setFormErrors({});
                                        setHiringItemId(null);
                                    }}
                                    disabled={formSubmitting}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => void submitCollaboratorFromInterview()}
                                    disabled={formSubmitting}
                                >
                                    {formSubmitting ? (
                                        <>
                                            <LoaderCircle className="size-4 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        'Salvar colaborador'
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                        <h2 className="text-2xl font-semibold">
                            Próximos Passos
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Candidatos aprovados para geração dos documentos de
                            admissão.
                        </p>
                    </div>

                    <div className="relative w-full sm:w-80">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            placeholder="Buscar por nome, CPF, e-mail..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                </div>

                {error ? (
                    <Notification message={error} variant="error" />
                ) : null}

                {busy ? (
                    <Notification
                        message="Preparando documento..."
                        variant="info"
                    />
                ) : null}

                {loading ? (
                    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando candidatos aprovados...
                    </p>
                ) : filteredItems.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-sm text-muted-foreground">
                            Nenhum candidato aprovado encontrado.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {filteredItems.map((item) => (
                            <Card key={item.id}>
                                <CardHeader className="pb-3">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        <CardTitle className="text-lg">
                                            {item.full_name}
                                        </CardTitle>
                                        <Badge variant="secondary">
                                            Aprovado
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-3 md:grid-cols-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase">
                                                CPF
                                            </p>
                                            <p className="text-sm">
                                                {item.cpf}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase">
                                                E-mail
                                            </p>
                                            <p className="text-sm">
                                                {item.email}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase">
                                                Telefone
                                            </p>
                                            <p className="text-sm">
                                                {formatPhone(item.phone)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase">
                                                Estado civil
                                            </p>
                                            <p className="text-sm">
                                                {item.marital_status}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 lg:grid-cols-2">
                                        <DocumentActions
                                            title="Checklist"
                                            previewUrl={
                                                item.documents.checklist
                                                    .preview_url
                                            }
                                            downloadUrl={
                                                item.documents.checklist
                                                    .download_url
                                            }
                                            fallbackName={`Checklist-${item.full_name.replace(/\s+/g, '')}.pdf`}
                                            onBusy={setBusy}
                                        />
                                        <DocumentActions
                                            title="Raça e Etnia"
                                            previewUrl={
                                                item.documents['raca-etnia']
                                                    .preview_url
                                            }
                                            downloadUrl={
                                                item.documents['raca-etnia']
                                                    .download_url
                                            }
                                            fallbackName={`RacaEtnia-${item.full_name.replace(/\s+/g, '')}.pdf`}
                                            onBusy={setBusy}
                                        />
                                    </div>

                                    <div className="rounded-md border bg-muted/20 p-3">
                                        <p className="mb-2 text-sm font-medium">
                                            Foi Contratado?
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={
                                                    item.foi_contratado
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                                disabled={
                                                    hiringItemId === item.id
                                                }
                                                onClick={() =>
                                                    void handleHiringAction(
                                                        item,
                                                        true,
                                                    )
                                                }
                                            >
                                                {hiringItemId === item.id ? (
                                                    <>
                                                        <LoaderCircle className="size-4 animate-spin" />
                                                        Processando...
                                                    </>
                                                ) : (
                                                    'Sim'
                                                )}
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={
                                                    !item.foi_contratado
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                                disabled={
                                                    hiringItemId === item.id
                                                }
                                                onClick={() =>
                                                    void handleHiringAction(
                                                        item,
                                                        false,
                                                    )
                                                }
                                            >
                                                Não
                                            </Button>
                                            {item.colaborador_id ? (
                                                <Badge variant="outline">
                                                    Vinculado ao colaborador #
                                                    {item.colaborador_id}
                                                </Badge>
                                            ) : null}
                                            {item.onboarding_id ? (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    asChild
                                                >
                                                    <Link
                                                        href={`/transport/onboarding?onboarding=${item.onboarding_id}`}
                                                    >
                                                        <ClipboardCheck className="size-4" />
                                                        Abrir onboarding
                                                    </Link>
                                                </Button>
                                            ) : null}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Página {currentPage} de {lastPage}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={currentPage <= 1 || loading}
                            onClick={() => load(currentPage - 1)}
                        >
                            Anterior
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={currentPage >= lastPage || loading}
                            onClick={() => load(currentPage + 1)}
                        >
                            Próxima
                        </Button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
