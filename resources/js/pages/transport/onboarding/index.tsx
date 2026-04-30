import { AlertCircle, ChevronLeft, ChevronRight, LoaderCircle, Save, Search, WandSparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { RecordCommentsPanel } from '@/components/transport/record-comments-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ApiError, apiGet, apiPatch, apiPost } from '@/lib/api-client';
import type {
    ApiPaginatedResponse,
    OnboardingItem,
    OnboardingRecord,
} from '@/types/driver-interview';

type ExamStatus = '' | 'a_agendar' | 'agendado' | 'realizado' | 'ok';
type YesNo = '' | 'sim' | 'nao';

type FormState = {
    exames: ExamStatus;
    documentos: Record<string, boolean>;
    cursos: Record<string, boolean>;
    outros: Record<string, YesNo>;
};

interface ItemConfig {
    code: string;
    label: string;
}

const DOCUMENT_ITEMS: ItemConfig[] = [
    { code: 'doc_cnh', label: 'CNH' },
    { code: 'doc_rg', label: 'RG' },
    { code: 'doc_comprovacao_endereco', label: 'Comprovação de endereço' },
    { code: 'doc_cpf', label: 'CPF' },
    { code: 'doc_filhos', label: 'Documentos dos filhos' },
    { code: 'doc_informacoes_registro', label: 'Informações para registro' },
];

const COURSE_ITEMS: ItemConfig[] = [
    {
        code: 'curso_conducao_segura_responsavel',
        label: 'Condução segura e responsável',
    },
    { code: 'curso_identificacao_riscos', label: 'Identificação de riscos' },
    {
        code: 'curso_gestao_risco_prevencao_tombamento',
        label: 'Gestão de risco e prevenção de tombamento',
    },
    {
        code: 'curso_seguranca_operacional_agropecuario',
        label: 'Segurança operacional (agropecuário)',
    },
];

const OTHER_ITEMS: ItemConfig[] = [
    { code: 'outro_integracao_seara', label: 'Integração Seara' },
    { code: 'outro_treinamento_kaique', label: 'Treinamento Kaique' },
    { code: 'outro_conta_salario', label: 'Conta salário' },
    { code: 'outro_foto', label: 'Foto' },
];

const EXAM_CODE = 'exames_status';

function emptyFormState(): FormState {
    return {
        exames: '',
        documentos: Object.fromEntries(
            DOCUMENT_ITEMS.map((item) => [item.code, false]),
        ),
        cursos: Object.fromEntries(COURSE_ITEMS.map((item) => [item.code, false])),
        outros: Object.fromEntries(
            OTHER_ITEMS.map((item) => [item.code, '']),
        ) as Record<string, YesNo>,
    };
}

function itemByCode(onboarding: OnboardingRecord | null, code: string): OnboardingItem | undefined {
    return onboarding?.items.find((item) => item.code === code);
}

function isApproved(item: OnboardingItem | undefined): boolean {
    return item?.status === 'aprovado';
}

function examValue(item: OnboardingItem | undefined): ExamStatus {
    const note = (item?.notes ?? '').trim().toLowerCase();

    if (
        note === 'a_agendar' ||
        note === 'agendado' ||
        note === 'realizado' ||
        note === 'ok'
    ) {
        return note;
    }

    return '';
}

function otherValue(item: OnboardingItem | undefined): YesNo {
    const note = (item?.notes ?? '').trim().toLowerCase();

    if (note === 'sim' || note === 'nao') {
        return note;
    }

    return '';
}

function buildForm(onboarding: OnboardingRecord): FormState {
    const next = emptyFormState();

    next.exames = examValue(itemByCode(onboarding, EXAM_CODE));

    DOCUMENT_ITEMS.forEach((config) => {
        next.documentos[config.code] = isApproved(itemByCode(onboarding, config.code));
    });

    COURSE_ITEMS.forEach((config) => {
        next.cursos[config.code] = isApproved(itemByCode(onboarding, config.code));
    });

    OTHER_ITEMS.forEach((config) => {
        next.outros[config.code] = otherValue(itemByCode(onboarding, config.code));
    });

    return next;
}

function mapsEqual<T extends boolean | string>(
    first: Record<string, T>,
    second: Record<string, T>,
): boolean {
    const keys = Object.keys(first);

    if (keys.length !== Object.keys(second).length) {
        return false;
    }

    return keys.every((key) => first[key] === second[key]);
}

function formEquals(first: FormState, second: FormState): boolean {
    return (
        first.exames === second.exames &&
        mapsEqual(first.documentos, second.documentos) &&
        mapsEqual(first.cursos, second.cursos) &&
        mapsEqual(first.outros, second.outros)
    );
}

function onboardingDisplayName(item: OnboardingRecord): string {
    return item.colaborador?.nome ?? item.interview?.full_name ?? `Onboarding #${item.id}`;
}

export default function TransportOnboardingPage() {
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search, 450);
    const [pendingItems, setPendingItems] = useState<OnboardingRecord[]>([]);
    const [historyItems, setHistoryItems] = useState<OnboardingRecord[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [saving, setSaving] = useState(false);

    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const [selected, setSelected] = useState<OnboardingRecord | null>(null);
    const [selectedFromHistory, setSelectedFromHistory] = useState(false);
    const [formState, setFormState] = useState<FormState>(emptyFormState());
    const [initialFormState, setInitialFormState] = useState<FormState>(
        emptyFormState(),
    );
    const [guidedMode, setGuidedMode] = useState(false);
    const [wizardStep, setWizardStep] = useState(0);

    const hasChanges = useMemo(
        () => !formEquals(formState, initialFormState),
        [formState, initialFormState],
    );

    const cursosMarcados = useMemo(
        () => Object.values(formState.cursos).filter(Boolean).length,
        [formState.cursos],
    );

    const cursosStatus = useMemo(() => {
        if (cursosMarcados === 0) return 'A realizar';
        if (cursosMarcados >= 4) return 'Finalizado';
        return 'Em processo';
    }, [cursosMarcados]);

    const canAutoComplete = useMemo(() => {
        const docsOk = Object.values(formState.documentos).every(Boolean);
        const cursosOk = Object.values(formState.cursos).every(Boolean);
        const outrosOk = Object.values(formState.outros).every((value) => value !== '');
        const examesOk = formState.exames !== '';

        return docsOk && cursosOk && outrosOk && examesOk;
    }, [formState]);

    const wizardSteps = useMemo(
        () => ['Exames', 'Documentos', 'Cursos', 'Outros', 'Revisão'],
        [],
    );

    async function loadLists(targetId?: number): Promise<void> {
        setLoading(true);

        const params = new URLSearchParams({
            per_page: '100',
        });

        if (debouncedSearch.trim()) {
            params.set('search', debouncedSearch.trim());
        }

        try {
            const [pendingResponse, historyResponse] = await Promise.all([
                apiGet<ApiPaginatedResponse<OnboardingRecord>>(
                    `/onboardings?status=em_andamento&${params.toString()}`,
                ),
                apiGet<ApiPaginatedResponse<OnboardingRecord>>(
                    `/onboardings?status=concluido&${params.toString()}`,
                ),
            ]);

            setPendingItems(pendingResponse.data);
            setHistoryItems(historyResponse.data);

            const all = [...pendingResponse.data, ...historyResponse.data];

            if (all.length === 0) {
                setSelected(null);
                setFormState(emptyFormState());
                setInitialFormState(emptyFormState());
                return;
            }

            const wantedId = targetId ?? selected?.id;
            const nextSelected = wantedId
                ? all.find((item) => item.id === wantedId) ?? null
                : pendingResponse.data[0] ?? null;

            if (!nextSelected) {
                setSelected(null);
                setFormState(emptyFormState());
                setInitialFormState(emptyFormState());
                return;
            }

            await loadDetail(nextSelected.id, historyResponse.data.some((item) => item.id === nextSelected.id));
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({ message: error.message, variant: 'error' });
            } else {
                setNotification({
                    message: 'Não foi possível carregar os onboardings.',
                    variant: 'error',
                });
            }
        } finally {
            setLoading(false);
        }
    }

    async function loadDetail(id: number, fromHistory: boolean): Promise<void> {
        setLoadingDetail(true);

        try {
            const response = await apiGet<{ data: OnboardingRecord }>(`/onboardings/${id}`);
            const onboarding = response.data;
            const nextForm = buildForm(onboarding);

            setSelected(onboarding);
            setSelectedFromHistory(fromHistory);
            setFormState(nextForm);
            setInitialFormState(nextForm);
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({ message: error.message, variant: 'error' });
            } else {
                setNotification({
                    message: 'Não foi possível carregar os detalhes do onboarding.',
                    variant: 'error',
                });
            }
        } finally {
            setLoadingDetail(false);
        }
    }

    async function patchItem(
        code: string,
        payload: Partial<Pick<OnboardingItem, 'status' | 'notes'>>,
    ): Promise<void> {
        const item = itemByCode(selected, code);

        if (!item) {
            return;
        }

        await apiPatch(`/onboarding-items/${item.id}`, payload);
    }

    async function handleSave(): Promise<void> {
        if (!selected) return;

        setSaving(true);
        setNotification(null);

        try {
            const examesItem = itemByCode(selected, EXAM_CODE);
            if (
                examesItem &&
                ((formState.exames === '' && examesItem.status !== 'pendente') ||
                    (formState.exames !== '' &&
                        (examesItem.status !== 'aprovado' ||
                            (examesItem.notes ?? '') !== formState.exames)))
            ) {
                await patchItem(EXAM_CODE, {
                    status: formState.exames === '' ? 'pendente' : 'aprovado',
                    notes: formState.exames === '' ? null : formState.exames,
                });
            }

            for (const config of DOCUMENT_ITEMS) {
                const current = itemByCode(selected, config.code);
                const target = formState.documentos[config.code]
                    ? 'aprovado'
                    : 'pendente';

                if (current && current.status !== target) {
                    await patchItem(config.code, {
                        status: target,
                        notes: null,
                    });
                }
            }

            for (const config of COURSE_ITEMS) {
                const current = itemByCode(selected, config.code);
                const target = formState.cursos[config.code] ? 'aprovado' : 'pendente';

                if (current && current.status !== target) {
                    await patchItem(config.code, {
                        status: target,
                        notes: null,
                    });
                }
            }

            for (const config of OTHER_ITEMS) {
                const current = itemByCode(selected, config.code);
                const value = formState.outros[config.code];
                const target = value === '' ? 'pendente' : 'aprovado';

                if (
                    current &&
                    (current.status !== target || (current.notes ?? '') !== value)
                ) {
                    await patchItem(config.code, {
                        status: target,
                        notes: value === '' ? null : value,
                    });
                }
            }

            if (canAutoComplete) {
                await apiPost(`/onboardings/${selected.id}/complete`);
                setNotification({
                    message: 'Onboarding concluído e movido para Onboardings anteriores.',
                    variant: 'success',
                });
                await loadLists();
                return;
            }

            setNotification({
                message: 'Onboarding salvo com sucesso.',
                variant: 'success',
            });
            await loadLists(selected.id);
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({ message: error.message, variant: 'error' });
            } else {
                setNotification({
                    message: 'Não foi possível salvar o onboarding.',
                    variant: 'error',
                });
            }
        } finally {
            setSaving(false);
        }
    }

    useEffect(() => {
        void loadLists();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);

    useEffect(() => {
        setWizardStep(0);
    }, [selected?.id]);

    const selectedName = selected ? onboardingDisplayName(selected) : '-';

    return (
        <AdminLayout title="Onboarding" active="onboarding" module="interviews">
            <div className="space-y-6">
                <div className="space-y-1">
                    <h2 className="text-2xl font-semibold">Onboarding</h2>
                    <p className="text-sm text-muted-foreground">
                        Controle simplificado de exames, documentos, cursos e outros.
                    </p>
                </div>

                {notification ? (
                    <Notification
                        message={notification.message}
                        variant={notification.variant}
                    />
                ) : null}

                <Card>
                    <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <p className="inline-flex items-center gap-2 text-sm font-medium">
                                <WandSparkles className="size-4" />
                                Modo guiado de onboarding
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Conduz o preenchimento por etapas para reduzir erros operacionais.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant={guidedMode ? 'default' : 'outline'}
                            onClick={() => setGuidedMode((previous) => !previous)}
                        >
                            {guidedMode ? 'Desativar guia' : 'Ativar guia'}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center">
                            <div className="relative w-full">
                                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    className="pl-9"
                                    placeholder="Buscar colaborador"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void loadLists()}
                            >
                                Buscar
                            </Button>
                            <Button
                                type="button"
                                variant={showHistory ? 'default' : 'outline'}
                                onClick={() => setShowHistory((previous) => !previous)}
                            >
                                Onboardings anteriores
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pendentes</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {loading ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Carregando...
                                </div>
                            ) : pendingItems.length === 0 ? (
                                <div className="flex items-center gap-2 rounded-md border border-muted-foreground/20 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                                    <AlertCircle className="size-4" />
                                    Ainda não há nenhum onboarding.
                                </div>
                            ) : (
                                pendingItems.map((item) => {
                                    const selectedItem = selected?.id === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => void loadDetail(item.id, false)}
                                            className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                                                selectedItem && !selectedFromHistory
                                                    ? 'border-primary bg-primary/10'
                                                    : 'hover:bg-muted/40'
                                            }`}
                                        >
                                            <p className="font-medium">{onboardingDisplayName(item)}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Unidade: {item.colaborador?.unidade_nome ?? '-'}
                                            </p>
                                        </button>
                                    );
                                })
                            )}

                            {showHistory ? (
                                <>
                                    <div className="mt-4 border-t pt-4">
                                        <p className="mb-2 text-sm font-medium">
                                            Onboardings anteriores
                                        </p>
                                        {historyItems.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">
                                                Nenhum onboarding concluído.
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {historyItems.map((item) => {
                                                    const selectedItem =
                                                        selected?.id === item.id &&
                                                        selectedFromHistory;

                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className="rounded-md border p-2"
                                                        >
                                                            <p className="text-sm font-medium">
                                                                {onboardingDisplayName(item)}
                                                            </p>
                                                            <div className="mt-2 flex justify-end">
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant={
                                                                        selectedItem
                                                                            ? 'default'
                                                                            : 'outline'
                                                                    }
                                                                    onClick={() =>
                                                                        void loadDetail(
                                                                            item.id,
                                                                            true,
                                                                        )
                                                                    }
                                                                >
                                                                    Editar
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : null}
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        {!selected ? (
                            <Card>
                                <CardContent className="flex items-center gap-2 pt-6 text-sm text-muted-foreground">
                                    <AlertCircle className="size-4" />
                                    Ainda não há nenhum onboarding.
                                </CardContent>
                            </Card>
                        ) : loadingDetail ? (
                            <Card>
                                <CardContent className="flex items-center gap-2 pt-6 text-sm text-muted-foreground">
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Carregando detalhes...
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>{selectedName}</CardTitle>
                                        <p className="text-sm text-muted-foreground">
                                            Unidade: {selected.colaborador?.unidade_nome ?? '-'}
                                        </p>
                                    </CardHeader>
                                </Card>

                                {guidedMode ? (
                                    <Card>
                                        <CardContent className="space-y-4 pt-6">
                                            <div className="space-y-2">
                                                <p className="text-xs text-muted-foreground uppercase">
                                                    Etapa {wizardStep + 1} de {wizardSteps.length}
                                                </p>
                                                <p className="text-sm font-medium">
                                                    {wizardSteps[wizardStep]}
                                                </p>
                                                <div className="grid grid-cols-5 gap-2">
                                                    {wizardSteps.map((stepLabel, index) => (
                                                        <button
                                                            key={stepLabel}
                                                            type="button"
                                                            className={`h-1.5 rounded-full transition ${
                                                                index <= wizardStep
                                                                    ? 'bg-primary'
                                                                    : 'bg-muted'
                                                            }`}
                                                            onClick={() => setWizardStep(index)}
                                                            aria-label={`Ir para etapa ${stepLabel}`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() =>
                                                        setWizardStep((previous) =>
                                                            Math.max(previous - 1, 0),
                                                        )
                                                    }
                                                    disabled={wizardStep <= 0}
                                                >
                                                    <ChevronLeft className="size-4" />
                                                    Voltar
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() =>
                                                        setWizardStep((previous) =>
                                                            Math.min(
                                                                previous + 1,
                                                                wizardSteps.length - 1,
                                                            ),
                                                        )
                                                    }
                                                    disabled={wizardStep >= wizardSteps.length - 1}
                                                >
                                                    Próxima etapa
                                                    <ChevronRight className="size-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : null}

                                {!guidedMode || wizardStep === 0 ? (
                                    <Card>
                                    <CardHeader>
                                        <CardTitle>Exames</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            <Label>Status</Label>
                                            <Select
                                                value={
                                                    formState.exames === ''
                                                        ? '__empty'
                                                        : formState.exames
                                                }
                                                onValueChange={(value) =>
                                                    setFormState((previous) => ({
                                                        ...previous,
                                                        exames:
                                                            value === '__empty'
                                                                ? ''
                                                                : (value as ExamStatus),
                                                    }))
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__empty">
                                                        Selecione
                                                    </SelectItem>
                                                    <SelectItem value="a_agendar">
                                                        A agendar
                                                    </SelectItem>
                                                    <SelectItem value="agendado">
                                                        Agendado
                                                    </SelectItem>
                                                    <SelectItem value="realizado">
                                                        Realizado
                                                    </SelectItem>
                                                    <SelectItem value="ok">OK</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </CardContent>
                                    </Card>
                                ) : null}

                                {!guidedMode || wizardStep === 1 ? (
                                    <Card>
                                    <CardHeader>
                                        <CardTitle>Documentos</CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid gap-3 md:grid-cols-2">
                                        {DOCUMENT_ITEMS.map((config) => (
                                            <label
                                                key={config.code}
                                                className="flex items-center gap-2 text-sm"
                                            >
                                                <Checkbox
                                                    className="border-2 border-muted-foreground/70 data-[state=checked]:border-primary"
                                                    checked={formState.documentos[config.code]}
                                                    onCheckedChange={(checked) =>
                                                        setFormState((previous) => ({
                                                            ...previous,
                                                            documentos: {
                                                                ...previous.documentos,
                                                                [config.code]:
                                                                    checked === true,
                                                            },
                                                        }))
                                                    }
                                                />
                                                {config.label}
                                            </label>
                                        ))}
                                    </CardContent>
                                    </Card>
                                ) : null}

                                {!guidedMode || wizardStep === 2 ? (
                                    <Card>
                                    <CardHeader>
                                        <CardTitle>Cursos</CardTitle>
                                        <p className="text-sm text-muted-foreground">
                                            Status: {cursosStatus}
                                        </p>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {COURSE_ITEMS.map((config) => (
                                            <label
                                                key={config.code}
                                                className="flex items-center gap-2 text-sm"
                                            >
                                                <Checkbox
                                                    className="border-2 border-muted-foreground/70 data-[state=checked]:border-primary"
                                                    checked={formState.cursos[config.code]}
                                                    onCheckedChange={(checked) =>
                                                        setFormState((previous) => ({
                                                            ...previous,
                                                            cursos: {
                                                                ...previous.cursos,
                                                                [config.code]:
                                                                    checked === true,
                                                            },
                                                        }))
                                                    }
                                                />
                                                {config.label}
                                            </label>
                                        ))}
                                    </CardContent>
                                    </Card>
                                ) : null}

                                {!guidedMode || wizardStep === 3 ? (
                                    <Card>
                                    <CardHeader>
                                        <CardTitle>Outros</CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid gap-4 md:grid-cols-2">
                                        {OTHER_ITEMS.map((config) => (
                                            <div key={config.code} className="space-y-2">
                                                <Label>{config.label}</Label>
                                                <Select
                                                    value={
                                                        formState.outros[config.code] === ''
                                                            ? '__empty'
                                                            : formState.outros[
                                                                  config.code
                                                              ]
                                                    }
                                                    onValueChange={(value) =>
                                                        setFormState((previous) => ({
                                                            ...previous,
                                                            outros: {
                                                                ...previous.outros,
                                                                [config.code]:
                                                                    value === '__empty'
                                                                        ? ''
                                                                        : (value as YesNo),
                                                            },
                                                        }))
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__empty">
                                                            Selecione
                                                        </SelectItem>
                                                        <SelectItem value="sim">
                                                            Sim
                                                        </SelectItem>
                                                        <SelectItem value="nao">
                                                            Não
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ))}
                                    </CardContent>
                                    </Card>
                                ) : null}

                                {guidedMode && wizardStep === 4 ? (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Revisão antes de salvar</CardTitle>
                                        </CardHeader>
                                        <CardContent className="grid gap-3 md:grid-cols-2">
                                            <div className="rounded-md border px-3 py-2">
                                                <p className="text-xs text-muted-foreground uppercase">Exames</p>
                                                <p className="text-sm font-medium">
                                                    {formState.exames === '' ? 'Pendente' : formState.exames}
                                                </p>
                                            </div>
                                            <div className="rounded-md border px-3 py-2">
                                                <p className="text-xs text-muted-foreground uppercase">Documentos aprovados</p>
                                                <p className="text-sm font-medium">
                                                    {Object.values(formState.documentos).filter(Boolean).length} de {DOCUMENT_ITEMS.length}
                                                </p>
                                            </div>
                                            <div className="rounded-md border px-3 py-2">
                                                <p className="text-xs text-muted-foreground uppercase">Cursos concluídos</p>
                                                <p className="text-sm font-medium">
                                                    {Object.values(formState.cursos).filter(Boolean).length} de {COURSE_ITEMS.length}
                                                </p>
                                            </div>
                                            <div className="rounded-md border px-3 py-2">
                                                <p className="text-xs text-muted-foreground uppercase">Outros itens preenchidos</p>
                                                <p className="text-sm font-medium">
                                                    {Object.values(formState.outros).filter((value) => value !== '').length} de {OTHER_ITEMS.length}
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : null}

                                <RecordCommentsPanel
                                    moduleKey="onboarding"
                                    recordId={selected.id}
                                    title="Comentários do onboarding"
                                />

                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        onClick={() => void handleSave()}
                                        disabled={saving || !hasChanges}
                                    >
                                        {saving ? (
                                            <>
                                                <LoaderCircle className="size-4 animate-spin" />
                                                Salvando...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="size-4" />
                                                Salvar onboarding
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
