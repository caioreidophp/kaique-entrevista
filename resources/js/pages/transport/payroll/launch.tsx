import { ArrowDownAZ, ArrowUpAZ, LoaderCircle } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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
import { ApiError, apiGet, apiPost } from '@/lib/api-client';
import { compareTextPtBr } from '@/lib/transport-text';
import { formatCurrencyBR, formatDateTimeBR } from '@/lib/transport-format';

interface Unidade {
    id: number;
    nome: string;
}

interface PensaoLaunchItem {
    id: number;
    nome_beneficiaria: string;
    cpf_beneficiaria?: string | null;
    nome_banco?: string | null;
    numero_agencia?: string | null;
    tipo_conta?: string | null;
    numero_conta?: string | null;
    tipo_chave_pix?: string | null;
    chave_pix?: string | null;
}

interface LaunchCandidate {
    id: number;
    nome: string;
    cpf: string;
    adiantamento_salarial: boolean;
    unidade?: Unidade;
    pagamentos_existentes_por_tipo: Record<
        string,
        {
            id: number;
            valor: number;
            dias_uteis?: number | null;
        }
    >;
    pensoes: PensaoLaunchItem[];
}

interface LaunchResponse {
    data_pagamento: string;
    data: LaunchCandidate[];
}

interface WrappedResponse<T> {
    data: T;
}

interface TipoPagamento {
    id: number;
    nome: string;
    gera_encargos: boolean;
    categoria: 'salario' | 'beneficios' | 'extras';
    forma_pagamento: 'deposito' | 'cartao_vr' | 'cartao_va' | 'dinheiro';
}

interface LaunchDraftSnapshot {
    version: number;
    updatedAt: string;
    data: {
        descricao: string;
        dataPagamento: string;
        unidadeId: string;
        selectedTipoIds: number[];
        candidates: LaunchCandidate[];
        selectedCollaborators: Record<number, boolean>;
        values: Record<string, string>;
        pensionValues: Record<string, string>;
        defaultWorkDays?: string;
        defaultVrDaily?: string;
        defaultVtDaily?: string;
        defaultCestaBasica?: string;
        workDaysByCollaborator?: Record<number, string>;
    };
}

const PAYROLL_LAUNCH_DRAFT_STORAGE_KEY = 'transport:payroll:launch-draft:v1';

function parseMoneyInput(value: string): number {
    const raw = value.trim().replace(/\s/g, '');

    if (!raw) return 0;

    const direct = Number(raw);
    if (Number.isFinite(direct)) return direct;

    const ptBr = Number(raw.replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(ptBr)) return ptBr;

    const usStyle = Number(raw.replace(/,/g, ''));
    if (Number.isFinite(usStyle)) return usStyle;

    return 0;
}

function isLaunchDraftSnapshot(value: unknown): value is LaunchDraftSnapshot {
    if (!value || typeof value !== 'object') return false;

    const draft = value as Partial<LaunchDraftSnapshot>;

    return Boolean(
        typeof draft.version === 'number' &&
            typeof draft.updatedAt === 'string' &&
            draft.data &&
            typeof draft.data === 'object',
    );
}

function formatDraftDate(value: string): string {
    return formatDateTimeBR(value, value);
}

function normalizePaymentName(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function parseWorkDaysInput(value: string): number {
    const parsed = Number((value ?? '').replace(/\D/g, ''));

    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 0;
    }

    return Math.max(0, Math.round(parsed));
}

export default function TransportPayrollLaunchPage() {
    const [descricao, setDescricao] = useState('');
    const [dataPagamento, setDataPagamento] = useState(
        new Date().toISOString().slice(0, 10),
    );
    const [unidadeId, setUnidadeId] = useState('');

    const [unidades, setUnidades] = useState<Unidade[]>([]);
    const [tiposPagamento, setTiposPagamento] = useState<TipoPagamento[]>([]);
    const [selectedTipoIds, setSelectedTipoIds] = useState<number[]>([]);
    const [candidates, setCandidates] = useState<LaunchCandidate[]>([]);
    const [selectedCollaborators, setSelectedCollaborators] = useState<
        Record<number, boolean>
    >({});
    const [values, setValues] = useState<Record<string, string>>({});
    const [pensionValues, setPensionValues] = useState<Record<string, string>>({});
    const [, setEditablePaymentIds] = useState<number[]>([]);
    const [defaultWorkDays, setDefaultWorkDays] = useState('0');
    const [defaultVrDaily, setDefaultVrDaily] = useState('0');
    const [defaultVtDaily, setDefaultVtDaily] = useState('0');
    const [defaultCestaBasica, setDefaultCestaBasica] = useState('0');
    const [workDaysByCollaborator, setWorkDaysByCollaborator] = useState<Record<number, string>>({});
    const [nameSortDirection, setNameSortDirection] = useState<'asc' | 'desc'>('asc');
    const [benefitAutoFillTouched, setBenefitAutoFillTouched] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingCandidates, setLoadingCandidates] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);
    const [draftSnapshot, setDraftSnapshot] =
        useState<LaunchDraftSnapshot | null>(null);
    const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
    const [draftResolved, setDraftResolved] = useState(false);
    const [skipNextAutoLoad, setSkipNextAutoLoad] = useState(false);
    const valueInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const selectedTipos = useMemo(
        () =>
            tiposPagamento.filter((tipo) => selectedTipoIds.includes(tipo.id)),
        [selectedTipoIds, tiposPagamento],
    );

    const hasSalaryTypeSelected = useMemo(
        () => selectedTipos.some((tipo) => tipo.categoria === 'salario'),
        [selectedTipos],
    );

    const hasSalaryAdvanceTypeSelected = useMemo(
        () => selectedTipos.some((tipo) => normalizePaymentName(tipo.nome).includes('adiantamento')),
        [selectedTipos],
    );

    const selectedValeRefeicaoTypeIds = useMemo(
        () =>
            selectedTipos
                .filter((tipo) => normalizePaymentName(tipo.nome).includes('vale refeicao'))
                .map((tipo) => tipo.id),
        [selectedTipos],
    );

    const selectedValeTransporteTypeIds = useMemo(
        () =>
            selectedTipos
                .filter((tipo) => normalizePaymentName(tipo.nome).includes('vale transporte'))
                .map((tipo) => tipo.id),
        [selectedTipos],
    );

    const selectedCestaBasicaTypeIds = useMemo(
        () =>
            selectedTipos
                .filter((tipo) => normalizePaymentName(tipo.nome).includes('cesta basica'))
                .map((tipo) => tipo.id),
        [selectedTipos],
    );

    const salaryLikeTypeIds = useMemo(
        () =>
            tiposPagamento
                .filter((tipo) => {
                    const normalizedName = normalizePaymentName(tipo.nome);

                    return normalizedName.includes('adiantamento')
                        || normalizedName.includes('decimo terceiro')
                        || normalizedName.includes('salario mensal');
                })
                .map((tipo) => tipo.id),
        [tiposPagamento],
    );

    const salaryLikeTypeSet = useMemo(
        () => new Set(salaryLikeTypeIds),
        [salaryLikeTypeIds],
    );

    const hasSalaryLikeTypeSelected = useMemo(
        () => selectedTipoIds.some((id) => salaryLikeTypeSet.has(id)),
        [salaryLikeTypeSet, selectedTipoIds],
    );

    const hasOtherTypeSelected = useMemo(
        () => selectedTipoIds.some((id) => !salaryLikeTypeSet.has(id)),
        [salaryLikeTypeSet, selectedTipoIds],
    );

    const hasValeRefeicaoSelected = selectedValeRefeicaoTypeIds.length > 0;
    const hasValeTransporteSelected = selectedValeTransporteTypeIds.length > 0;
    const hasBenefitDailyAutoFill = hasValeRefeicaoSelected || hasValeTransporteSelected;
    const hasCestaBasicaAutoFill = selectedCestaBasicaTypeIds.length > 0;
    const hasGlobalTopAutoFill = hasBenefitDailyAutoFill || hasCestaBasicaAutoFill;

    const allChecked =
        candidates.length > 0 &&
        candidates.every((candidate) => selectedCollaborators[candidate.id]);

    const sortedCandidates = useMemo(() => {
        const items = [...candidates];
        items.sort((first, second) => {
            const comparison = compareTextPtBr(first.nome, second.nome);

            if (comparison === 0) {
                return nameSortDirection === 'asc'
                    ? first.id - second.id
                    : second.id - first.id;
            }

            return nameSortDirection === 'asc' ? comparison : -comparison;
        });

        return items;
    }, [candidates, nameSortDirection]);

    const columnTotalsByTipo = useMemo(() => {
        const totals: Record<number, number> = {};

        selectedTipoIds.forEach((tipoId) => {
            totals[tipoId] = 0;
        });

        candidates.forEach((candidate) => {
            if (!selectedCollaborators[candidate.id]) {
                return;
            }

            selectedTipoIds.forEach((tipoId) => {
                const key = valueKey(candidate.id, tipoId);
                totals[tipoId] = (totals[tipoId] ?? 0) + parseMoneyInput(values[key] ?? '0');
            });
        });

        return totals;
    }, [candidates, selectedCollaborators, selectedTipoIds, values]);

    async function loadUnidades(): Promise<void> {
        setLoading(true);
        try {
            const [unidadesResponse, tiposResponse] = await Promise.all([
                apiGet<WrappedResponse<Unidade[]>>('/registry/unidades'),
                apiGet<WrappedResponse<TipoPagamento[]>>('/registry/tipos-pagamento'),
            ]);

            const response = unidadesResponse;
            setUnidades(response.data);
            setTiposPagamento(tiposResponse.data);
            if (!unidadeId && response.data.length > 0) {
                setUnidadeId(String(response.data[0].id));
            }
        } catch {
            setNotification({
                message: 'Não foi possível carregar as unidades.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    async function loadCandidates(): Promise<void> {
        if (!unidadeId || selectedTipoIds.length === 0 || !dataPagamento) {
            setCandidates([]);
            setSelectedCollaborators({});
            setValues({});
            setPensionValues({});
            return;
        }

        setLoadingCandidates(true);
        setNotification(null);

        try {
            const params = new URLSearchParams();
            params.set('unidade_id', unidadeId);
            params.set('descricao', descricao.trim());
            params.set('data_pagamento', dataPagamento);
            selectedTipoIds.forEach((id) => {
                params.append('tipo_pagamento_ids[]', String(id));
            });

            const response = await apiGet<LaunchResponse>(
                `/payroll/launch-candidates?${params.toString()}`,
            );
            setCandidates(response.data);
            setSelectedCollaborators({});
            setValues({});
            setPensionValues({});
            setEditablePaymentIds([]);
            setWorkDaysByCollaborator(
                Object.fromEntries(
                    response.data.map((item) => [item.id, defaultWorkDays]),
                ),
            );
            setBenefitAutoFillTouched(false);
        } catch {
            setNotification({
                message:
                    'Não foi possível carregar os colaboradores da unidade.',
                variant: 'error',
            });
        } finally {
            setLoadingCandidates(false);
        }
    }

    useEffect(() => {
        if (typeof window === 'undefined') {
            setDraftResolved(true);
            return;
        }

        const raw = window.localStorage.getItem(PAYROLL_LAUNCH_DRAFT_STORAGE_KEY);

        if (!raw) {
            setDraftResolved(true);
            return;
        }

        try {
            const parsed = JSON.parse(raw) as unknown;

            if (!isLaunchDraftSnapshot(parsed)) {
                window.localStorage.removeItem(PAYROLL_LAUNCH_DRAFT_STORAGE_KEY);
                setDraftResolved(true);
                return;
            }

            setDraftSnapshot(parsed);
            setResumeDialogOpen(true);
        } catch {
            window.localStorage.removeItem(PAYROLL_LAUNCH_DRAFT_STORAGE_KEY);
            setDraftResolved(true);
        }
    }, []);

    useEffect(() => {
        loadUnidades();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (skipNextAutoLoad) {
            setSkipNextAutoLoad(false);
            return;
        }

        if (unidadeId && selectedTipoIds.length > 0 && dataPagamento) {
            void loadCandidates();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unidadeId, dataPagamento]);

    useEffect(() => {
        if (!draftResolved || typeof window === 'undefined') {
            return;
        }

        const hasContent =
            Object.values(values).some((value) => value.trim() !== '') ||
            Object.values(pensionValues).some((value) => value.trim() !== '') ||
            Object.values(selectedCollaborators).some(Boolean);

        if (!hasContent) {
            window.localStorage.removeItem(PAYROLL_LAUNCH_DRAFT_STORAGE_KEY);
            return;
        }

        const snapshot: LaunchDraftSnapshot = {
            version: 1,
            updatedAt: new Date().toISOString(),
            data: {
                descricao,
                dataPagamento,
                unidadeId,
                selectedTipoIds,
                candidates,
                selectedCollaborators,
                values,
                pensionValues,
                defaultWorkDays,
                defaultVrDaily,
                defaultVtDaily,
                defaultCestaBasica,
                workDaysByCollaborator,
            },
        };

        window.localStorage.setItem(
            PAYROLL_LAUNCH_DRAFT_STORAGE_KEY,
            JSON.stringify(snapshot),
        );
    }, [
        candidates,
        dataPagamento,
        descricao,
        draftResolved,
        defaultVrDaily,
        defaultVtDaily,
        defaultCestaBasica,
        defaultWorkDays,
        selectedCollaborators,
        selectedTipoIds,
        unidadeId,
        values,
        pensionValues,
        workDaysByCollaborator,
    ]);

    function handleResumeDraft(): void {
        if (!draftSnapshot) {
            setDraftResolved(true);
            setResumeDialogOpen(false);
            return;
        }

        setSkipNextAutoLoad(true);
        setDescricao(draftSnapshot.data.descricao);
        setDataPagamento(draftSnapshot.data.dataPagamento);
        setUnidadeId(draftSnapshot.data.unidadeId);
        setSelectedTipoIds(draftSnapshot.data.selectedTipoIds);
        setCandidates(draftSnapshot.data.candidates);
        setSelectedCollaborators(draftSnapshot.data.selectedCollaborators);
        setValues(draftSnapshot.data.values);
        setPensionValues(draftSnapshot.data.pensionValues ?? {});
        setDefaultWorkDays('0');
        setDefaultVrDaily('0');
        setDefaultVtDaily('0');
        setDefaultCestaBasica(draftSnapshot.data.defaultCestaBasica ?? '0');
        setEditablePaymentIds(
            draftSnapshot.data.candidates.flatMap((candidate) =>
                Object.values(candidate.pagamentos_existentes_por_tipo ?? {})
                    .map((entry) => Number(entry.id ?? 0))
                    .filter((id) => id > 0),
            ),
        );
        setWorkDaysByCollaborator(
            draftSnapshot.data.workDaysByCollaborator
                ? Object.fromEntries(
                      draftSnapshot.data.candidates.map((item) => [
                          item.id,
                          draftSnapshot.data.workDaysByCollaborator?.[item.id] ?? '0',
                      ]),
                  )
                : Object.fromEntries(
                      draftSnapshot.data.candidates.map((item) => [item.id, '0']),
                  ),
        );
        setBenefitAutoFillTouched(false);
        setDraftResolved(true);
        setResumeDialogOpen(false);
    }

    function handleDiscardDraft(): void {
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(PAYROLL_LAUNCH_DRAFT_STORAGE_KEY);
        }

        setDraftSnapshot(null);
        setEditablePaymentIds([]);
        setDraftResolved(true);
        setResumeDialogOpen(false);
    }

    function isTipoBlocked(tipoId: number): boolean {
        if (selectedTipoIds.includes(tipoId)) {
            return false;
        }

        const isSalaryLikeType = salaryLikeTypeSet.has(tipoId);

        if (hasSalaryLikeTypeSelected && !isSalaryLikeType) {
            return true;
        }

        if (hasOtherTypeSelected && isSalaryLikeType) {
            return true;
        }

        return false;
    }

    function toggleTipo(tipoId: number, checked: boolean): void {
        if (checked && isTipoBlocked(tipoId)) {
            return;
        }

        setSelectedTipoIds((previous) => {
            if (checked) {
                if (previous.includes(tipoId)) return previous;
                return [...previous, tipoId];
            }

            return previous.filter((id) => id !== tipoId);
        });
    }

    function setAllCollaborators(checked: boolean): void {
        const next: Record<number, boolean> = {};
        candidates.forEach((candidate) => {
            next[candidate.id] = checked;
        });
        setSelectedCollaborators(next);
    }

    function setCollaboratorSelected(id: number, checked: boolean): void {
        setSelectedCollaborators((previous) => {
            if (previous[id] === checked) {
                return previous;
            }

            return {
                ...previous,
                [id]: checked,
            };
        });
    }

    function valueKey(colaboradorId: number, tipoId: number): string {
        return `${colaboradorId}:${tipoId}`;
    }

    function setValue(colaboradorId: number, tipoId: number, value: string): void {
        setValues((previous) => {
            const key = valueKey(colaboradorId, tipoId);

            if (previous[key] === value) {
                return previous;
            }

            return {
                ...previous,
                [key]: value,
            };
        });
    }

    function pensionValueKey(colaboradorId: number, pensaoId: number): string {
        return `${colaboradorId}:${pensaoId}`;
    }

    function pensionInputKey(colaboradorId: number, pensaoId: number): string {
        return `p:${colaboradorId}:${pensaoId}`;
    }

    function setPensionValue(colaboradorId: number, pensaoId: number, value: string): void {
        setPensionValues((previous) => {
            const key = pensionValueKey(colaboradorId, pensaoId);

            if (previous[key] === value) {
                return previous;
            }

            return {
                ...previous,
                [key]: value,
            };
        });
    }

    function focusAdjacentLaunchInput(currentKey: string, direction: 1 | -1): void {
        const orderedKeys: string[] = [];

        sortedCandidates.forEach((candidate) => {
            selectedTipos.forEach((tipo) => {
                orderedKeys.push(valueKey(candidate.id, tipo.id));
            });

            if (hasSalaryTypeSelected && candidate.pensoes.length > 0) {
                candidate.pensoes.forEach((pensao) => {
                    orderedKeys.push(pensionInputKey(candidate.id, pensao.id));
                });
            }
        });

        const enabledKeys = orderedKeys.filter((key) => {
            const element = valueInputRefs.current[key];
            return Boolean(element) && !element?.disabled;
        });

        const currentIndex = enabledKeys.indexOf(currentKey);

        if (currentIndex === -1) return;

        const nextKey = enabledKeys[currentIndex + direction];

        if (!nextKey) return;

        const target = valueInputRefs.current[nextKey];

        if (target && !target.disabled) {
            target.focus();
        }
    }

    function buildInputGrid(): string[][] {
        const rows: string[][] = [];

        sortedCandidates.forEach((candidate) => {
            const paymentRow = selectedTipos.map((tipo) => valueKey(candidate.id, tipo.id));

            if (paymentRow.length > 0) {
                rows.push(paymentRow);
            }

            if (hasSalaryTypeSelected && candidate.pensoes.length > 0) {
                candidate.pensoes.forEach((pensao) => {
                    rows.push([pensionInputKey(candidate.id, pensao.id)]);
                });
            }
        });

        return rows;
    }

    function focusDirectionalLaunchInput(
        currentKey: string,
        direction: 'left' | 'right' | 'up' | 'down',
    ): void {
        const grid = buildInputGrid();
        const rowIndex = grid.findIndex((row) => row.includes(currentKey));

        if (rowIndex < 0) return;

        const colIndex = grid[rowIndex]?.indexOf(currentKey) ?? -1;

        if (colIndex < 0) return;

        const focusKey = (key?: string): boolean => {
            if (!key) return false;

            const target = valueInputRefs.current[key];

            if (!target || target.disabled) {
                return false;
            }

            target.focus();
            return true;
        };

        if (direction === 'left') {
            void focusKey(grid[rowIndex]?.[colIndex - 1]);
            return;
        }

        if (direction === 'right') {
            void focusKey(grid[rowIndex]?.[colIndex + 1]);
            return;
        }

        if (direction === 'up') {
            for (let index = rowIndex - 1; index >= 0; index -= 1) {
                if (focusKey(grid[index]?.[colIndex])) return;
                if (focusKey(grid[index]?.[0])) return;
            }
            return;
        }

        for (let index = rowIndex + 1; index < grid.length; index += 1) {
            if (focusKey(grid[index]?.[colIndex])) return;
            if (focusKey(grid[index]?.[0])) return;
        }
    }

    function handleArrowNavigation(
        event: { key: string; preventDefault: () => void },
        currentKey: string,
    ): void {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            focusDirectionalLaunchInput(currentKey, 'left');
            return;
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            focusDirectionalLaunchInput(currentKey, 'right');
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            focusDirectionalLaunchInput(currentKey, 'up');
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusDirectionalLaunchInput(currentKey, 'down');
        }
    }

    function setAllCollaboratorWorkDays(value: string): void {
        setWorkDaysByCollaborator((previous) => {
            if (candidates.length === 0) {
                return previous;
            }

            const allAlreadySameValue = candidates.every(
                (candidate) => previous[candidate.id] === value,
            );

            if (allAlreadySameValue) {
                return previous;
            }

            return Object.fromEntries(candidates.map((candidate) => [candidate.id, value]));
        });
    }

    useEffect(() => {
        if (
            !benefitAutoFillTouched ||
            !hasBenefitDailyAutoFill ||
            selectedTipoIds.length === 0 ||
            candidates.length === 0
        ) {
            return;
        }

        const vrDaily = parseMoneyInput(defaultVrDaily);
        const vtDaily = parseMoneyInput(defaultVtDaily);

        setValues((previous) => {
            const next = { ...previous };
            let changed = false;

            candidates.forEach((candidate) => {
                const days = parseWorkDaysInput(
                    workDaysByCollaborator[candidate.id] ?? defaultWorkDays,
                );

                selectedValeRefeicaoTypeIds.forEach((tipoId) => {
                    const amount = (days * vrDaily).toFixed(2);
                    const key = valueKey(candidate.id, tipoId);

                    if (next[key] !== amount) {
                        next[key] = amount;
                        changed = true;
                    }
                });

                selectedValeTransporteTypeIds.forEach((tipoId) => {
                    const total = days * vtDaily;
                    const roundedUpToFive = total > 0
                        ? Math.ceil(total / 5) * 5
                        : 0;
                    const amount = roundedUpToFive.toFixed(2);
                    const key = valueKey(candidate.id, tipoId);

                    if (next[key] !== amount) {
                        next[key] = amount;
                        changed = true;
                    }
                });
            });

            return changed ? next : previous;
        });
    }, [
        candidates,
        defaultVtDaily,
        defaultVrDaily,
        defaultWorkDays,
        benefitAutoFillTouched,
        hasBenefitDailyAutoFill,
        selectedTipoIds.length,
        selectedValeRefeicaoTypeIds,
        selectedValeTransporteTypeIds,
        workDaysByCollaborator,
    ]);

    useEffect(() => {
        if (
            !benefitAutoFillTouched
            || !hasCestaBasicaAutoFill
            || selectedTipoIds.length === 0
            || candidates.length === 0
        ) {
            return;
        }

        const cestaValue = parseMoneyInput(defaultCestaBasica).toFixed(2);

        setValues((previous) => {
            const next = { ...previous };
            let changed = false;

            candidates.forEach((candidate) => {
                if (!selectedCollaborators[candidate.id]) {
                    return;
                }

                selectedCestaBasicaTypeIds.forEach((tipoId) => {
                    const key = valueKey(candidate.id, tipoId);

                    if (next[key] !== cestaValue) {
                        next[key] = cestaValue;
                        changed = true;
                    }
                });
            });

            return changed ? next : previous;
        });
    }, [
        benefitAutoFillTouched,
        candidates,
        defaultCestaBasica,
        hasCestaBasicaAutoFill,
        selectedCollaborators,
        selectedCestaBasicaTypeIds,
        selectedTipoIds.length,
    ]);

    useEffect(() => {
        if (!hasSalaryAdvanceTypeSelected || candidates.length === 0) {
            return;
        }

        let hasAnySalaryAdvance = false;

        setSelectedCollaborators((previous) => {
            const next = { ...previous };

            candidates.forEach((candidate) => {
                if (candidate.adiantamento_salarial) {
                    hasAnySalaryAdvance = true;
                    next[candidate.id] = true;
                } else if (!(candidate.id in next)) {
                    next[candidate.id] = false;
                }
            });

            return next;
        });

        if (hasAnySalaryAdvance) {
            setNotification({
                message: 'Adiantamento selecionado: colaboradores com Adiantamento Salarial = S foram marcados automaticamente.',
                variant: 'info',
            });
        }
    }, [hasSalaryAdvanceTypeSelected, candidates]);

    async function handleLaunch(): Promise<void> {
        const pagamentos = candidates.map((item) => {
            const valoresPorTipo: Record<string, string> = {};
            const valoresPensao: Record<string, string> = {};

            selectedTipoIds.forEach((tipoId) => {
                valoresPorTipo[String(tipoId)] =
                    values[valueKey(item.id, tipoId)] ?? '0';
            });

            item.pensoes.forEach((pensao) => {
                valoresPensao[String(pensao.id)] =
                    pensionValues[pensionValueKey(item.id, pensao.id)] ?? '0';
            });

            return {
                colaborador_id: item.id,
                selected: Boolean(selectedCollaborators[item.id]),
                dias_uteis: parseWorkDaysInput(
                    workDaysByCollaborator[item.id] ?? defaultWorkDays,
                ),
                valores_por_tipo: valoresPorTipo,
                valores_pensao: valoresPensao,
                pagamentos_existentes_por_tipo:
                    item.pagamentos_existentes_por_tipo ?? {},
            };
        });

        const selectedWithPositive = pagamentos.filter((item) => {
            if (!item.selected) return false;

            const hasTipoValue = Object.values(item.valores_por_tipo).some(
                (value) => parseMoneyInput(value) > 0,
            );
            const hasPensionValue = Object.values(item.valores_pensao).some(
                (value) => parseMoneyInput(value) > 0,
            );

            return hasTipoValue || hasPensionValue;
        });

        const selectedWithoutPositive = pagamentos.filter((item) => {
            if (!item.selected) return false;

            const hasTipoValue = Object.values(item.valores_por_tipo).some(
                (value) => parseMoneyInput(value) > 0,
            );
            const hasPensionValue = Object.values(item.valores_pensao).some(
                (value) => parseMoneyInput(value) > 0,
            );

            return !hasTipoValue && !hasPensionValue;
        });

        if (selectedWithPositive.length === 0) {
            const firstSelectedId = selectedWithoutPositive[0]?.colaborador_id;

            if (firstSelectedId) {
                const firstTipoId = selectedTipoIds[0];
                const firstInputKey = firstTipoId
                    ? valueKey(firstSelectedId, firstTipoId)
                    : null;

                if (firstInputKey) {
                    const target = valueInputRefs.current[firstInputKey];
                    if (target && !target.disabled) {
                        target.focus();
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }

            setNotification({
                message:
                    'Os colaboradores selecionados estão com valor zerado. Informe ao menos um valor maior que zero para lançar pagamento.',
                variant: 'info',
            });
            return;
        }

        setSaving(true);
        setNotification(null);

        try {
            const response = await apiPost<{ created_count: number }>(
                '/payroll/launch-batch',
                {
                    unidade_id: Number(unidadeId),
                    descricao: descricao.trim(),
                    data_pagamento: dataPagamento,
                    tipo_pagamento_ids: selectedTipoIds,
                    pagamentos,
                },
            );

            setNotification({
                message: `${response.created_count} pagamento(s) lançado(s) com sucesso.`,
                variant: 'success',
            });

            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(PAYROLL_LAUNCH_DRAFT_STORAGE_KEY);
            }
            setDraftSnapshot(null);

            await loadCandidates();
        } catch (error) {
            if (error instanceof ApiError) {
                const firstError = error.errors
                    ? Object.values(error.errors)[0]?.[0]
                    : null;
                setNotification({
                    message: firstError ?? error.message ?? 'Não foi possível lançar os pagamentos.',
                    variant: 'error',
                });
            } else {
                setNotification({
                    message: 'Não foi possível lançar os pagamentos.',
                    variant: 'error',
                });
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminLayout
            title="Pagamentos - Lançar Pagamentos"
            active="payroll-launch"
            module="payroll"
        >
            <div className="space-y-6">
                <Dialog
                    open={resumeDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) {
                            handleDiscardDraft();
                        }
                    }}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Retomar lançamento em andamento?</DialogTitle>
                            <DialogDescription>
                                Encontramos um rascunho não finalizado do cadastro de pagamento.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
                            <p>
                                <span className="font-medium">Descrição:</span>{' '}
                                {draftSnapshot?.data.descricao?.trim() || 'Sem descrição'}
                            </p>
                            <p>
                                <span className="font-medium">Última edição:</span>{' '}
                                {draftSnapshot ? formatDraftDate(draftSnapshot.updatedAt) : '-'}
                            </p>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={handleDiscardDraft}>
                                Não, começar do zero
                            </Button>
                            <Button type="button" onClick={handleResumeDraft}>
                                Sim, retomar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {!draftResolved ? (
                    <p className="text-sm text-muted-foreground">Carregando rascunho...</p>
                ) : null}

                <div>
                    <h2 className="text-2xl font-semibold">
                        Lançar Pagamentos
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Informe descrição, unidade, tipos e data para lançar pagamentos em lote.
                    </p>
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
                                <Label htmlFor="descricao">Descrição</Label>
                                <Input
                                    id="descricao"
                                    value={descricao}
                                    onChange={(event) =>
                                        setDescricao(event.target.value)
                                    }
                                    placeholder="Ex.: Pagamento quinzenal"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Unidade</Label>
                                <Select
                                    value={unidadeId}
                                    onValueChange={setUnidadeId}
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
                                <Label htmlFor="data-pagamento">
                                    Data do pagamento
                                </Label>
                                <Input
                                    id="data-pagamento"
                                    type="date"
                                    value={dataPagamento}
                                    onChange={(event) =>
                                        setDataPagamento(event.target.value)
                                    }
                                />
                            </div>
                        </div>

                        <div className="mt-4 space-y-2">
                            <Label>Tipo de pagamento (pode escolher mais de um)</Label>
                            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                                {tiposPagamento.map((tipo) => (
                                    <label
                                        key={tipo.id}
                                        className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                                            isTipoBlocked(tipo.id)
                                                ? 'cursor-not-allowed bg-muted/60 opacity-60'
                                                : ''
                                        }`}
                                    >
                                        <Checkbox
                                            checked={selectedTipoIds.includes(tipo.id)}
                                            onCheckedChange={(checked) =>
                                                toggleTipo(tipo.id, Boolean(checked))
                                            }
                                            disabled={isTipoBlocked(tipo.id)}
                                        />
                                        <span className="text-sm">{tipo.nome}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void loadCandidates()}
                                disabled={!unidadeId || selectedTipoIds.length === 0 || !dataPagamento}
                            >
                                Carregar colaboradores
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Colaboradores Ativos da Unidade</CardTitle>
                        {hasSalaryTypeSelected ? (
                            <p className="text-xs text-muted-foreground">
                                Para tipos de salário, informe também os valores de pensão do mês em linhas "Colaborador - Pensão".
                            </p>
                        ) : null}
                    </CardHeader>
                    <CardContent>
                        {loading || loadingCandidates ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando colaboradores...
                            </div>
                        ) : candidates.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Nenhum colaborador ativo encontrado para os filtros.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                <div className="overflow-x-auto rounded-md border">
                                    <table className="w-full min-w-[760px] text-sm">
                                        <thead className="bg-muted/40">
                                            {hasGlobalTopAutoFill ? (
                                                <tr>
                                                    <th className="w-[40px] px-2 py-2 text-left" />
                                                    <th className="px-2 py-2 text-left" />
                                                    {hasBenefitDailyAutoFill ? (
                                                        <th className="px-2 py-2 text-left">
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="1"
                                                                className="font-normal"
                                                                title="Dias úteis padrão para auto preenchimento de benefícios."
                                                                value={defaultWorkDays}
                                                                onChange={(event) => {
                                                                    const nextValue = event.target.value;
                                                                    setDefaultWorkDays(nextValue);
                                                                    setAllCollaboratorWorkDays(nextValue);
                                                                    setBenefitAutoFillTouched(true);
                                                                }}
                                                            />
                                                        </th>
                                                    ) : null}
                                                    <th className="px-2 py-2 text-left" />
                                                    {selectedTipos.map((tipo) => {
                                                        const normalizedTipoName = normalizePaymentName(tipo.nome);
                                                        const isVr = normalizedTipoName.includes('vale refeicao');
                                                        const isVt = normalizedTipoName.includes('vale transporte');
                                                        const isCestaBasica = normalizedTipoName.includes('cesta basica');

                                                        return (
                                                            <th key={`global-field-${tipo.id}`} className="px-2 py-2 text-left">
                                                                {isVr ? (
                                                                    <Input
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        className="font-normal"
                                                                        title="Valor diário de Vale Refeição aplicado automaticamente enquanto não houver edição manual por colaborador."
                                                                        value={defaultVrDaily}
                                                                        onChange={(event) => {
                                                                            setDefaultVrDaily(event.target.value);
                                                                            setBenefitAutoFillTouched(true);
                                                                        }}
                                                                    />
                                                                ) : null}
                                                                {isVt ? (
                                                                    <Input
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        className="font-normal"
                                                                        title="Valor diário de Vale Transporte com arredondamento para cima em múltiplos de 5 no total mensal."
                                                                        value={defaultVtDaily}
                                                                        onChange={(event) => {
                                                                            setDefaultVtDaily(event.target.value);
                                                                            setBenefitAutoFillTouched(true);
                                                                        }}
                                                                    />
                                                                ) : null}
                                                                {isCestaBasica ? (
                                                                    <Input
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        className="font-normal"
                                                                        title="Valor fixo de Cesta Básica para todos os colaboradores marcados."
                                                                        value={defaultCestaBasica}
                                                                        onChange={(event) => {
                                                                            setDefaultCestaBasica(event.target.value);
                                                                            setBenefitAutoFillTouched(true);
                                                                        }}
                                                                    />
                                                                ) : null}
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            ) : null}

                                            <tr>
                                                <th className="w-[40px] px-2 py-2 text-left">
                                                    <Checkbox
                                                        checked={allChecked}
                                                        onCheckedChange={(checked) =>
                                                            setAllCollaborators(
                                                                Boolean(checked),
                                                            )
                                                        }
                                                    />
                                                </th>
                                                <th className="px-2 py-2 text-left font-medium">
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center gap-1"
                                                        onClick={() =>
                                                            setNameSortDirection((previous) =>
                                                                previous === 'asc' ? 'desc' : 'asc',
                                                            )
                                                        }
                                                    >
                                                        Nome
                                                        {nameSortDirection === 'asc' ? (
                                                            <ArrowUpAZ className="size-4" />
                                                        ) : (
                                                            <ArrowDownAZ className="size-4" />
                                                        )}
                                                    </button>
                                                </th>
                                                {hasBenefitDailyAutoFill ? (
                                                    <th className="px-2 py-2 text-left font-medium">
                                                        Dias úteis
                                                    </th>
                                                ) : null}
                                                <th className="px-2 py-2 text-left font-medium">
                                                    Unidade
                                                </th>
                                                {selectedTipos.map((tipo) => (
                                                    <th
                                                        key={tipo.id}
                                                        className="px-2 py-2 text-left font-medium"
                                                    >
                                                        {tipo.nome}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedCandidates.map((item) => (
                                                <Fragment key={item.id}>
                                                    <tr className="border-t">
                                                        <td className="px-2 py-2">
                                                            <Checkbox
                                                                checked={Boolean(selectedCollaborators[item.id])}
                                                                onCheckedChange={(checked) =>
                                                                    setCollaboratorSelected(item.id, Boolean(checked))
                                                                }
                                                            />
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            <p className="font-medium">{item.nome}</p>
                                                            <p className="text-xs text-muted-foreground">CPF: {item.cpf}</p>
                                                            <p className="text-xs text-muted-foreground">Adiantamento Salarial: {item.adiantamento_salarial ? 'S' : 'N'}</p>
                                                        </td>
                                                        {hasBenefitDailyAutoFill ? (
                                                            <td className="px-2 py-2">
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    step="1"
                                                                    title="Dias úteis do colaborador para cálculo automático de benefícios."
                                                                    value={workDaysByCollaborator[item.id] ?? defaultWorkDays}
                                                                    onChange={(event) =>
                                                                        setWorkDaysByCollaborator((previous) => {
                                                                            const nextValue = event.target.value;

                                                                            if (previous[item.id] === nextValue) {
                                                                                return previous;
                                                                            }

                                                                            setBenefitAutoFillTouched(true);

                                                                            return {
                                                                                ...previous,
                                                                                [item.id]: nextValue,
                                                                            };
                                                                        })
                                                                    }
                                                                />
                                                            </td>
                                                        ) : null}
                                                        <td className="px-2 py-2">{item.unidade?.nome ?? '-'}</td>
                                                        {selectedTipos.map((tipo) => {
                                                            const key = valueKey(item.id, tipo.id);

                                                            return (
                                                                <td key={`${item.id}-${tipo.id}`} className="px-2 py-2">
                                                                    <Input
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        title="Use Enter/Tab/setas para navegar entre células."
                                                                        value={values[key] ?? ''}
                                                                        onChange={(event) =>
                                                                            setValue(item.id, tipo.id, event.target.value)
                                                                        }
                                                                        ref={(element) => {
                                                                            valueInputRefs.current[key] = element;
                                                                        }}
                                                                        onKeyDown={(event) => {
                                                                            if (event.key === 'Enter') {
                                                                                event.preventDefault();
                                                                                focusAdjacentLaunchInput(key, 1);
                                                                                return;
                                                                            }

                                                                            if (event.key === 'Tab') {
                                                                                event.preventDefault();
                                                                                focusAdjacentLaunchInput(key, event.shiftKey ? -1 : 1);
                                                                                return;
                                                                            }

                                                                            handleArrowNavigation(event, key);
                                                                        }}
                                                                        disabled={
                                                                            !selectedCollaborators[item.id]
                                                                        }
                                                                        placeholder="0,00"
                                                                    />
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>

                                                    {hasSalaryTypeSelected && item.pensoes.length > 0
                                                        ? item.pensoes.map((pensao) => (
                                                              <tr key={`${item.id}-pensao-${pensao.id}`} className="border-t bg-muted/20">
                                                                  <td className="px-2 py-2">
                                                                      <Checkbox
                                                                          checked={Boolean(selectedCollaborators[item.id])}
                                                                          onCheckedChange={(checked) =>
                                                                              setCollaboratorSelected(item.id, Boolean(checked))
                                                                          }
                                                                      />
                                                                  </td>
                                                                  <td className="px-2 py-2">
                                                                      <p className="font-medium">{item.nome} - Pensão</p>
                                                                      <p className="text-xs text-muted-foreground">
                                                                          Beneficiária: {pensao.nome_beneficiaria}
                                                                      </p>
                                                                  </td>
                                                                  {hasBenefitDailyAutoFill ? (
                                                                      <td className="px-2 py-2">-</td>
                                                                  ) : null}
                                                                  <td className="px-2 py-2">{item.unidade?.nome ?? '-'}</td>
                                                                  <td className="px-2 py-2" colSpan={selectedTipos.length}>
                                                                      <Input
                                                                          type="text"
                                                                          inputMode="decimal"
                                                                          placeholder="0,00"
                                                                          value={
                                                                              pensionValues[pensionValueKey(item.id, pensao.id)] ?? ''
                                                                          }
                                                                          onChange={(event) =>
                                                                              setPensionValue(item.id, pensao.id, event.target.value)
                                                                          }
                                                                          ref={(element) => {
                                                                              valueInputRefs.current[pensionInputKey(item.id, pensao.id)] = element;
                                                                          }}
                                                                          onKeyDown={(event) => {
                                                                              const key = pensionInputKey(item.id, pensao.id);

                                                                              if (event.key === 'Enter') {
                                                                                  event.preventDefault();
                                                                                  focusAdjacentLaunchInput(key, 1);
                                                                                  return;
                                                                              }

                                                                              if (event.key === 'Tab') {
                                                                                  event.preventDefault();
                                                                                  focusAdjacentLaunchInput(key, event.shiftKey ? -1 : 1);
                                                                                  return;
                                                                              }

                                                                              handleArrowNavigation(event, key);
                                                                          }}
                                                                          disabled={!selectedCollaborators[item.id]}
                                                                      />
                                                                  </td>
                                                              </tr>
                                                          ))
                                                        : null}
                                                </Fragment>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t bg-muted/35 font-semibold">
                                                <td className="px-2 py-2" />
                                                <td className="px-2 py-2">Total da coluna</td>
                                                {hasBenefitDailyAutoFill ? <td className="px-2 py-2" /> : null}
                                                <td className="px-2 py-2" />
                                                {selectedTipos.map((tipo) => (
                                                    <td key={`total-col-${tipo.id}`} className="px-2 py-2 font-semibold">
                                                        {formatCurrencyBR(columnTotalsByTipo[tipo.id] ?? 0)}
                                                    </td>
                                                ))}
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        onClick={() => void handleLaunch()}
                                        disabled={saving || selectedTipoIds.length === 0}
                                    >
                                        {saving ? (
                                            <>
                                                <LoaderCircle className="size-4 animate-spin" />
                                                Salvando pagamentos...
                                            </>
                                        ) : (
                                            'Salvar pagamentos'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
