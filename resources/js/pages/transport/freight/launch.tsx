import { LoaderCircle, Pencil, Trash2, Upload } from 'lucide-react';
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';
import { getAuthToken } from '@/lib/transport-auth';
import {
    decimalThousandsMaskBR,
    formatCurrencyBR,
    formatDateBR,
    formatDecimalBR,
    formatIntegerBR,
    integerThousandsMaskBR,
    moneyMaskBR,
    toNumberSafe,
} from '@/lib/transport-format';
import type { FreightEntry, FreightUnit } from '@/types/freight';

interface WrappedResponse<T> {
    data: T;
}

interface FreightEntryPaginatedResponse {
    data: FreightEntry[];
    current_page: number;
    last_page: number;
    total: number;
}

interface PlacaOption {
    id: number;
    placa: string;
}

interface AviarioOption {
    id: number;
    nome: string;
    cidade: string;
    km: string | number | null;
}

interface CanceledLoadDetailForm {
    placa: string;
    aviario: string;
    valor: string;
    obs: string;
}

interface SpreadsheetPreviewResponse {
    message?: string;
    source_format?: 'kaique' | 'standard';
    prefill?: {
        data?: string;
        unidade_id?: number | string;
        veiculos?: number;
        programado_frete?: number;
        programado_viagens?: number;
        programado_aves?: number;
        programado_km?: number;
        kaique_geral_frete?: number;
        kaique_geral_viagens?: number;
        kaique_geral_aves?: number;
        kaique_geral_km?: number;
        terceiros_frete?: number;
        terceiros_viagens?: number;
        terceiros_aves?: number;
        terceiros_km?: number;
        abatedouro_frete?: number;
        abatedouro_viagens?: number;
        abatedouro_aves?: number;
        abatedouro_km?: number;
        canceladas_sem_escalar_frete?: number;
        canceladas_sem_escalar_viagens?: number;
        canceladas_sem_escalar_aves?: number;
        canceladas_sem_escalar_km?: number;
        canceladas_escaladas_frete?: number;
        canceladas_escaladas_viagens?: number;
        canceladas_escaladas_aves?: number;
        canceladas_escaladas_km?: number;

        frete_total?: number;
        cargas?: number;
        aves?: number;
        km_rodado?: number;
        frete_terceiros?: number;
        viagens_terceiros?: number;
        aves_terceiros?: number;
        km_terceiros?: number;
        frete_liquido?: number;
        cargas_liq?: number;
        aves_liq?: number;
        frete_programado?: number;
        cargas_programadas?: number;
        aves_programadas?: number;
        km_programado?: number;
        nao_escaladas?: number;
        cargas_canceladas_escaladas?: number;
        obs?: string | null;
    };
    cargas_canceladas_detalhes?: Array<{
        placa?: string | null;
        aviario?: string | null;
        valor?: number | null;
        obs?: string | null;
    }>;
    warnings?: string[];
}

interface FormDataState {
    data: string;
    unidade_id: string;
    veiculos: string;
    programado_frete: string;
    programado_viagens: string;
    programado_aves: string;
    programado_km: string;
    kaique_geral_frete: string;
    kaique_geral_viagens: string;
    kaique_geral_aves: string;
    kaique_geral_km: string;
    terceiros_frete: string;
    terceiros_viagens: string;
    terceiros_aves: string;
    terceiros_km: string;
    abatedouro_frete: string;
    abatedouro_viagens: string;
    abatedouro_aves: string;
    abatedouro_km: string;
    canceladas_sem_escalar_frete: string;
    canceladas_sem_escalar_viagens: string;
    canceladas_sem_escalar_aves: string;
    canceladas_sem_escalar_km: string;
    canceladas_escaladas_frete: string;
    canceladas_escaladas_viagens: string;
    canceladas_escaladas_aves: string;
    canceladas_escaladas_km: string;
    obs: string;
}

const emptyForm: FormDataState = {
    data: new Date().toISOString().slice(0, 10),
    unidade_id: '',
    veiculos: '',
    programado_frete: '',
    programado_viagens: '',
    programado_aves: '',
    programado_km: '',
    kaique_geral_frete: '',
    kaique_geral_viagens: '',
    kaique_geral_aves: '',
    kaique_geral_km: '',
    terceiros_frete: '',
    terceiros_viagens: '',
    terceiros_aves: '',
    terceiros_km: '',
    abatedouro_frete: '',
    abatedouro_viagens: '',
    abatedouro_aves: '',
    abatedouro_km: '',
    canceladas_sem_escalar_frete: '',
    canceladas_sem_escalar_viagens: '',
    canceladas_sem_escalar_aves: '',
    canceladas_sem_escalar_km: '',
    canceladas_escaladas_frete: '',
    canceladas_escaladas_viagens: '',
    canceladas_escaladas_aves: '',
    canceladas_escaladas_km: '',
    obs: '',
};

const emptyCanceledLoadDetail = (): CanceledLoadDetailForm => ({
    placa: '',
    aviario: '',
    valor: '',
    obs: '',
});

const moneyFields = new Set([
    'programado_frete',
    'kaique_geral_frete',
    'terceiros_frete',
    'abatedouro_frete',
    'canceladas_sem_escalar_frete',
    'canceladas_escaladas_frete',
]);

const integerThousandsFields = new Set([
    'veiculos',
    'programado_viagens',
    'programado_aves',
    'kaique_geral_viagens',
    'kaique_geral_aves',
    'terceiros_viagens',
    'terceiros_aves',
    'abatedouro_viagens',
    'abatedouro_aves',
    'canceladas_sem_escalar_viagens',
    'canceladas_sem_escalar_aves',
    'canceladas_escaladas_viagens',
    'canceladas_escaladas_aves',
]);

const decimalThousandsFields = new Set([
    'programado_km',
    'kaique_geral_km',
    'terceiros_km',
    'abatedouro_km',
    'canceladas_sem_escalar_km',
    'canceladas_escaladas_km',
]);

function toNumberOrZero(value: string): number {
    return toNumberSafe(value);
}

function toIntegerOrZero(value: string): number {
    const onlyDigits = value.replace(/\D/g, '');

    if (onlyDigits !== '') {
        return Number(onlyDigits);
    }

    const normalized = toNumberSafe(value);

    if (!Number.isFinite(normalized) || normalized <= 0) {
        return 0;
    }

    return Math.trunc(normalized);
}

function toIntegerString(value: number): string {
    return formatIntegerBR(Math.max(0, Math.trunc(value)));
}

function toDecimalString(value: number): string {
    return formatDecimalBR(Math.max(0, value), 2);
}

function StartsWithAutocompleteInput({
    id,
    value,
    placeholder,
    options,
    onChange,
    normalize,
    inputClassName,
}: {
    id: string;
    value: string;
    placeholder?: string;
    options: string[];
    onChange: (value: string) => void;
    normalize?: (value: string) => string;
    inputClassName?: string;
}) {
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number>(-1);

    const normalizedInput = value.trim().toLocaleLowerCase('pt-BR');

    const filtered = useMemo(() => {
        if (!normalizedInput) {
            return options.slice(0, 12);
        }

        return options
            .filter((option) => option.toLocaleLowerCase('pt-BR').startsWith(normalizedInput))
            .slice(0, 12);
    }, [normalizedInput, options]);

    const highlightedIndex =
        open && filtered.length > 0 && activeIndex >= 0 && activeIndex < filtered.length
            ? activeIndex
            : -1;

    function openOptions(): void {
        setOpen(true);
        setActiveIndex(filtered.length > 0 ? 0 : -1);
    }

    function selectOption(option: string): void {
        onChange(option);
        setOpen(false);
        setActiveIndex(-1);
    }

    return (
        <div className="relative">
            <Input
                id={id}
                className={inputClassName}
                value={value}
                placeholder={placeholder}
                autoComplete="off"
                onFocus={openOptions}
                onBlur={() => {
                    window.setTimeout(() => setOpen(false), 140);
                }}
                onKeyDown={(event) => {
                    if (!open || filtered.length === 0) {
                        return;
                    }

                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setActiveIndex((previous) =>
                            previous < filtered.length - 1 ? previous + 1 : 0,
                        );
                        return;
                    }

                    if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setActiveIndex((previous) =>
                            previous > 0 ? previous - 1 : filtered.length - 1,
                        );
                        return;
                    }

                    if (event.key === 'Enter') {
                        if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
                            event.preventDefault();
                            selectOption(filtered[highlightedIndex]);
                        }
                        return;
                    }

                    if (event.key === 'Escape') {
                        event.preventDefault();
                        setOpen(false);
                        setActiveIndex(-1);
                    }
                }}
                onChange={(event) => {
                    const nextValue = normalize ? normalize(event.target.value) : event.target.value;
                    onChange(nextValue);
                    openOptions();
                }}
            />

            {open && filtered.length > 0 ? (
                <div className="bg-popover text-popover-foreground absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border shadow-md">
                    {filtered.map((option) => (
                        <button
                            key={option}
                            type="button"
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                                highlightedIndex >= 0 && filtered[highlightedIndex] === option
                                    ? 'bg-muted'
                                    : ''
                            }`}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                selectOption(option);
                            }}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

export default function TransportFreightLaunchPage() {
    const today = new Date().toISOString().slice(0, 10);
    const currentMonthStart = `${today.slice(0, 8)}01`;

    const [unidades, setUnidades] = useState<FreightUnit[]>([]);
    const [placasOptions, setPlacasOptions] = useState<string[]>([]);
    const [aviariosOptions, setAviariosOptions] = useState<string[]>([]);
    const [form, setForm] = useState<FormDataState>(emptyForm);
    const [canceledLoadDetails, setCanceledLoadDetails] = useState<CanceledLoadDetailForm[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [entriesLoading, setEntriesLoading] = useState(false);
    const [entries, setEntries] = useState<FreightEntry[]>([]);
    const [entriesCurrentPage, setEntriesCurrentPage] = useState(1);
    const [entriesLastPage, setEntriesLastPage] = useState(1);
    const [entriesTotal, setEntriesTotal] = useState(0);
    const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
    const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);
    const [deleteCandidate, setDeleteCandidate] = useState<FreightEntry | null>(null);
    const [filterStartDate, setFilterStartDate] = useState(currentMonthStart);
    const [filterEndDate, setFilterEndDate] = useState(today);
    const [filterUnidadeId, setFilterUnidadeId] = useState('all');
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);
    const [importingSpreadsheet, setImportingSpreadsheet] = useState(false);
    const spreadsheetInputRef = useRef<HTMLInputElement | null>(null);

    const buildEntriesQuery = useCallback(
        (page = 1, customStartDate = filterStartDate, customEndDate = filterEndDate, customUnidadeId = filterUnidadeId): string => {
        const params = new URLSearchParams();
        params.set('per_page', '25');
        params.set('page', String(page));

        if (customStartDate) {
            params.set('start_date', customStartDate);
        }

        if (customEndDate) {
            params.set('end_date', customEndDate);
        }

        if (customUnidadeId !== 'all') {
            params.set('unidade_id', customUnidadeId);
        }

        return params.toString();
    },
    [filterEndDate, filterStartDate, filterUnidadeId],
    );

    const loadEntries = useCallback(async (page = 1): Promise<void> => {
        setEntriesLoading(true);

        try {
            const response = await apiGet<FreightEntryPaginatedResponse>(
                `/freight/entries?${buildEntriesQuery(page)}`,
            );
            setEntries(response.data);
            setEntriesCurrentPage(response.current_page);
            setEntriesLastPage(response.last_page);
            setEntriesTotal(response.total);
        } catch {
            setNotification({
                message: 'Não foi possível carregar a lista de lançamentos de frete.',
                variant: 'error',
            });
        } finally {
            setEntriesLoading(false);
        }
    }, [buildEntriesQuery]);

    useEffect(() => {
        const count = Math.max(0, Math.trunc(toNumberOrZero(form.canceladas_escaladas_viagens)));

        setCanceledLoadDetails((previous) => {
            if (previous.length === count) return previous;

            if (previous.length > count) {
                return previous.slice(0, count);
            }

            const next = [...previous];
            while (next.length < count) {
                next.push(emptyCanceledLoadDetail());
            }

            return next;
        });
    }, [form.canceladas_escaladas_viagens]);

    useEffect(() => {
        Promise.all([
            apiGet<WrappedResponse<FreightUnit[]>>('/registry/unidades'),
            apiGet<WrappedResponse<PlacaOption[]>>('/registry/placas-frota'),
            apiGet<WrappedResponse<AviarioOption[]>>('/registry/aviarios'),
        ])
            .then(([unidadesResponse, placasResponse, aviariosResponse]) => {
                setUnidades(unidadesResponse.data);

                setPlacasOptions(
                    placasResponse.data
                        .map((item) => item.placa)
                        .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })),
                );

                setAviariosOptions(
                    aviariosResponse.data
                        .map((item) => {
                            const kmText =
                                item.km !== null && item.km !== undefined && String(item.km) !== ''
                                    ? ` - ${item.km} km`
                                    : '';

                            return `${item.nome} (${item.cidade})${kmText}`;
                        })
                        .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })),
                );

                if (unidadesResponse.data.length > 0) {
                    setForm((previous) => ({
                        ...previous,
                        unidade_id: previous.unidade_id || String(unidadesResponse.data[0].id),
                    }));
                }

                void loadEntries(1);
            })
            .catch(() => {
                setNotification({
                    message: 'Não foi possível carregar unidades, placas e aviários para lançamento.',
                    variant: 'error',
                });
            })
            .finally(() => setLoading(false));
    }, [loadEntries]);

    useEffect(() => {
        if (typeof window === 'undefined' || entries.length === 0) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const editId = Number(params.get('edit'));

        if (!Number.isFinite(editId) || editId <= 0) {
            return;
        }

        const targetEntry = entries.find((entry) => entry.id === editId);

        if (!targetEntry) {
            return;
        }

        startEdit(targetEntry);
        params.delete('edit');

        const nextSearch = params.toString();
        const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
        window.history.replaceState({}, '', nextUrl);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [entries]);

    async function handleSubmit(): Promise<void> {
        if (!form.data || !form.unidade_id || !form.veiculos) {
            setNotification({
                message: 'Data, unidade e veículos são obrigatórios.',
                variant: 'error',
            });
            return;
        }

        const totalViagens =
            toIntegerOrZero(form.programado_viagens) +
            toIntegerOrZero(form.kaique_geral_viagens) +
            toIntegerOrZero(form.terceiros_viagens) +
            toIntegerOrZero(form.abatedouro_viagens) +
            toIntegerOrZero(form.canceladas_sem_escalar_viagens) +
            toIntegerOrZero(form.canceladas_escaladas_viagens);

        if (totalViagens <= 0) {
            setNotification({
                message: 'Informe pelo menos uma carga/viagem no lançamento.',
                variant: 'error',
            });
            return;
        }

        setSaving(true);
        setNotification(null);

        const payload = {
            data: form.data,
            unidade_id: Number(form.unidade_id),
            veiculos: toIntegerOrZero(form.veiculos),
            programado_frete: toNumberOrZero(form.programado_frete),
            programado_viagens: toIntegerOrZero(form.programado_viagens),
            programado_aves: toIntegerOrZero(form.programado_aves),
            programado_km: toNumberOrZero(form.programado_km),
            kaique_geral_frete: toNumberOrZero(form.kaique_geral_frete),
            kaique_geral_viagens: toIntegerOrZero(form.kaique_geral_viagens),
            kaique_geral_aves: toIntegerOrZero(form.kaique_geral_aves),
            kaique_geral_km: toNumberOrZero(form.kaique_geral_km),
            terceiros_frete: toNumberOrZero(form.terceiros_frete),
            terceiros_viagens: toIntegerOrZero(form.terceiros_viagens),
            terceiros_aves: toIntegerOrZero(form.terceiros_aves),
            terceiros_km: toNumberOrZero(form.terceiros_km),
            abatedouro_frete: toNumberOrZero(form.abatedouro_frete),
            abatedouro_viagens: toIntegerOrZero(form.abatedouro_viagens),
            abatedouro_aves: toIntegerOrZero(form.abatedouro_aves),
            abatedouro_km: toNumberOrZero(form.abatedouro_km),
            canceladas_sem_escalar_frete: toNumberOrZero(form.canceladas_sem_escalar_frete),
            canceladas_sem_escalar_viagens: toIntegerOrZero(form.canceladas_sem_escalar_viagens),
            canceladas_sem_escalar_aves: toIntegerOrZero(form.canceladas_sem_escalar_aves),
            canceladas_sem_escalar_km: toNumberOrZero(form.canceladas_sem_escalar_km),
            canceladas_escaladas_frete: toNumberOrZero(form.canceladas_escaladas_frete),
            canceladas_escaladas_viagens: toIntegerOrZero(form.canceladas_escaladas_viagens),
            canceladas_escaladas_aves: toIntegerOrZero(form.canceladas_escaladas_aves),
            canceladas_escaladas_km: toNumberOrZero(form.canceladas_escaladas_km),
            placas: null,
            obs: form.obs || null,
            cargas_canceladas_detalhes: canceledLoadDetails.map((item) => ({
                placa: item.placa,
                aviario: item.aviario,
                valor: toNumberOrZero(item.valor),
                obs: item.obs || null,
            })),
        };

        try {
            const response = editingEntryId
                ? await apiPut<WrappedResponse<FreightEntry>>(`/freight/entries/${editingEntryId}`, payload)
                : await apiPost<WrappedResponse<FreightEntry>>('/freight/entries', payload);

            setNotification({
                message: editingEntryId
                    ? `Lançamento #${response.data.id} atualizado com sucesso.`
                    : `Lançamento salvo com sucesso para ${response.data.unidade?.nome ?? 'a unidade selecionada'}.`,
                variant: 'success',
            });

            setForm((previous) => ({
                ...emptyForm,
                unidade_id: previous.unidade_id,
                data: new Date().toISOString().slice(0, 10),
            }));
            setCanceledLoadDetails([]);
            setEditingEntryId(null);
            await loadEntries(entriesCurrentPage);
        } catch (error) {
            if (error instanceof ApiError) {
                const firstError = error.errors ? Object.values(error.errors)[0]?.[0] : null;
                setNotification({
                    message: firstError ?? error.message,
                    variant: 'error',
                });
            } else {
                setNotification({
                    message: 'Não foi possível salvar o lançamento.',
                    variant: 'error',
                });
            }
        } finally {
            setSaving(false);
        }
    }

    function startEdit(entry: FreightEntry): void {
        const programadoFrete = Number((entry as Partial<FreightEntry>).programado_frete ?? entry.frete_programado ?? 0);
        const programadoViagens = Number((entry as Partial<FreightEntry>).programado_viagens ?? entry.cargas_programadas ?? 0);
        const programadoAves = Number((entry as Partial<FreightEntry>).programado_aves ?? entry.aves_programadas ?? 0);
        const programadoKm = Number((entry as Partial<FreightEntry>).programado_km ?? entry.km_programado ?? entry.km_rodado ?? 0);

        const kaiqueFrete = Number((entry as Partial<FreightEntry>).kaique_geral_frete ?? entry.frete_total ?? 0);
        const kaiqueViagens = Number((entry as Partial<FreightEntry>).kaique_geral_viagens ?? entry.cargas ?? 0);
        const kaiqueAves = Number((entry as Partial<FreightEntry>).kaique_geral_aves ?? entry.aves ?? 0);
        const kaiqueKm = Number((entry as Partial<FreightEntry>).kaique_geral_km ?? entry.km_rodado ?? 0);

        const terceirosFrete = Number((entry as Partial<FreightEntry>).terceiros_frete ?? entry.frete_terceiros ?? 0);
        const terceirosViagens = Number((entry as Partial<FreightEntry>).terceiros_viagens ?? entry.viagens_terceiros ?? 0);
        const terceirosAves = Number((entry as Partial<FreightEntry>).terceiros_aves ?? entry.aves_terceiros ?? 0);
        const terceirosKm = Number((entry as Partial<FreightEntry>).terceiros_km ?? entry.km_terceiros ?? 0);

        const abatedouroFrete = Number((entry as Partial<FreightEntry>).abatedouro_frete ?? entry.frete_liquido ?? 0);
        const abatedouroViagens = Number((entry as Partial<FreightEntry>).abatedouro_viagens ?? entry.cargas_liq ?? 0);
        const abatedouroAves = Number((entry as Partial<FreightEntry>).abatedouro_aves ?? entry.aves_liq ?? 0);
        const abatedouroKm = Number((entry as Partial<FreightEntry>).abatedouro_km ?? 0);

        const canceladasSemEscalarFrete = Number((entry as Partial<FreightEntry>).canceladas_sem_escalar_frete ?? 0);
        const canceladasSemEscalarViagens = Number((entry as Partial<FreightEntry>).canceladas_sem_escalar_viagens ?? entry.nao_escaladas ?? 0);
        const canceladasSemEscalarAves = Number((entry as Partial<FreightEntry>).canceladas_sem_escalar_aves ?? 0);
        const canceladasSemEscalarKm = Number((entry as Partial<FreightEntry>).canceladas_sem_escalar_km ?? 0);

        const canceladasEscaladasFrete = Number((entry as Partial<FreightEntry>).canceladas_escaladas_frete ?? 0);
        const canceladasEscaladasViagens = Number((entry as Partial<FreightEntry>).canceladas_escaladas_viagens ?? entry.cargas_canceladas_escaladas ?? 0);
        const canceladasEscaladasAves = Number((entry as Partial<FreightEntry>).canceladas_escaladas_aves ?? 0);
        const canceladasEscaladasKm = Number((entry as Partial<FreightEntry>).canceladas_escaladas_km ?? 0);

        setEditingEntryId(entry.id);
        setForm({
            data: entry.data.slice(0, 10),
            unidade_id: String(entry.unidade_id),
            veiculos: toIntegerString(Number(entry.veiculos ?? 0)),
            programado_frete: toDecimalString(programadoFrete),
            programado_viagens: toIntegerString(programadoViagens),
            programado_aves: toIntegerString(programadoAves),
            programado_km: toDecimalString(programadoKm),
            kaique_geral_frete: toDecimalString(kaiqueFrete),
            kaique_geral_viagens: toIntegerString(kaiqueViagens),
            kaique_geral_aves: toIntegerString(kaiqueAves),
            kaique_geral_km: toDecimalString(kaiqueKm),
            terceiros_frete: toDecimalString(terceirosFrete),
            terceiros_viagens: toIntegerString(terceirosViagens),
            terceiros_aves: toIntegerString(terceirosAves),
            terceiros_km: toDecimalString(terceirosKm),
            abatedouro_frete: toDecimalString(abatedouroFrete),
            abatedouro_viagens: toIntegerString(abatedouroViagens),
            abatedouro_aves: toIntegerString(abatedouroAves),
            abatedouro_km: toDecimalString(abatedouroKm),
            canceladas_sem_escalar_frete: toDecimalString(canceladasSemEscalarFrete),
            canceladas_sem_escalar_viagens: toIntegerString(canceladasSemEscalarViagens),
            canceladas_sem_escalar_aves: toIntegerString(canceladasSemEscalarAves),
            canceladas_sem_escalar_km: toDecimalString(canceladasSemEscalarKm),
            canceladas_escaladas_frete: toDecimalString(canceladasEscaladasFrete),
            canceladas_escaladas_viagens: toIntegerString(canceladasEscaladasViagens),
            canceladas_escaladas_aves: toIntegerString(canceladasEscaladasAves),
            canceladas_escaladas_km: toDecimalString(canceladasEscaladasKm),
            obs: entry.obs ?? '',
        });
        setCanceledLoadDetails([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function handleDelete(entry: FreightEntry): Promise<void> {
        setDeletingEntryId(entry.id);

        try {
            await apiDelete(`/freight/entries/${entry.id}`);

            if (editingEntryId === entry.id) {
                setEditingEntryId(null);
                setForm((previous) => ({
                    ...emptyForm,
                    unidade_id: previous.unidade_id,
                    data: new Date().toISOString().slice(0, 10),
                }));
                setCanceledLoadDetails([]);
            }

            setNotification({
                message: `Lançamento #${entry.id} excluído com sucesso.`,
                variant: 'success',
            });

            await loadEntries(entriesCurrentPage);
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({ message: error.message, variant: 'error' });
            } else {
                setNotification({
                    message: 'Não foi possível excluir o lançamento.',
                    variant: 'error',
                });
            }
        } finally {
            setDeletingEntryId(null);
        }
    }

    function requestDelete(entry: FreightEntry): void {
        setDeleteCandidate(entry);
    }

    function handleImportSpreadsheetClick(): void {
        spreadsheetInputRef.current?.click();
    }

    function applySpreadsheetPrefill(data: SpreadsheetPreviewResponse): void {
        const prefill = data.prefill;

        if (!prefill) {
            throw new Error('Não foi possível interpretar os dados da planilha para pré-preenchimento.');
        }

        setEditingEntryId(null);

        setForm((previous) => ({
            ...previous,
            data: prefill.data?.slice(0, 10) || previous.data,
            unidade_id:
                prefill.unidade_id !== undefined && prefill.unidade_id !== null
                    ? String(prefill.unidade_id)
                    : previous.unidade_id,
            veiculos: toIntegerString(Number(prefill.veiculos ?? 0)),
            programado_frete: toDecimalString(Number(prefill.programado_frete ?? prefill.frete_programado ?? 0)),
            programado_viagens: toIntegerString(Number(prefill.programado_viagens ?? prefill.cargas_programadas ?? 0)),
            programado_aves: toIntegerString(Number(prefill.programado_aves ?? prefill.aves_programadas ?? 0)),
            programado_km: toDecimalString(Number(prefill.programado_km ?? prefill.km_programado ?? 0)),
            kaique_geral_frete: toDecimalString(Number(prefill.kaique_geral_frete ?? prefill.frete_total ?? 0)),
            kaique_geral_viagens: toIntegerString(Number(prefill.kaique_geral_viagens ?? prefill.cargas ?? 0)),
            kaique_geral_aves: toIntegerString(Number(prefill.kaique_geral_aves ?? prefill.aves ?? 0)),
            kaique_geral_km: toDecimalString(Number(prefill.kaique_geral_km ?? prefill.km_rodado ?? 0)),
            terceiros_frete: toDecimalString(Number(prefill.terceiros_frete ?? prefill.frete_terceiros ?? 0)),
            terceiros_viagens: toIntegerString(Number(prefill.terceiros_viagens ?? prefill.viagens_terceiros ?? 0)),
            terceiros_aves: toIntegerString(Number(prefill.terceiros_aves ?? prefill.aves_terceiros ?? 0)),
            terceiros_km: toDecimalString(Number(prefill.terceiros_km ?? prefill.km_terceiros ?? 0)),
            abatedouro_frete: toDecimalString(Number(prefill.abatedouro_frete ?? prefill.frete_liquido ?? 0)),
            abatedouro_viagens: toIntegerString(Number(prefill.abatedouro_viagens ?? prefill.cargas_liq ?? 0)),
            abatedouro_aves: toIntegerString(Number(prefill.abatedouro_aves ?? prefill.aves_liq ?? 0)),
            abatedouro_km: toDecimalString(Number(prefill.abatedouro_km ?? 0)),
            canceladas_sem_escalar_frete: toDecimalString(Number(prefill.canceladas_sem_escalar_frete ?? 0)),
            canceladas_sem_escalar_viagens: toIntegerString(Number(prefill.canceladas_sem_escalar_viagens ?? prefill.nao_escaladas ?? 0)),
            canceladas_sem_escalar_aves: toIntegerString(Number(prefill.canceladas_sem_escalar_aves ?? 0)),
            canceladas_sem_escalar_km: toDecimalString(Number(prefill.canceladas_sem_escalar_km ?? 0)),
            canceladas_escaladas_frete: toDecimalString(Number(prefill.canceladas_escaladas_frete ?? 0)),
            canceladas_escaladas_viagens: toIntegerString(Number(prefill.canceladas_escaladas_viagens ?? prefill.cargas_canceladas_escaladas ?? 0)),
            canceladas_escaladas_aves: toIntegerString(Number(prefill.canceladas_escaladas_aves ?? 0)),
            canceladas_escaladas_km: toDecimalString(Number(prefill.canceladas_escaladas_km ?? 0)),
            obs: String(prefill.obs ?? ''),
        }));

        setCanceledLoadDetails(
            (data.cargas_canceladas_detalhes ?? []).map((item) => ({
                placa: String(item.placa ?? ''),
                aviario: String(item.aviario ?? ''),
                valor:
                    item.valor !== null && item.valor !== undefined
                        ? toDecimalString(Number(item.valor))
                        : '',
                obs: String(item.obs ?? ''),
            })),
        );

    }

    async function handleSpreadsheetSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
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

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/freight/entries/import-spreadsheet-preview', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            const json = (await response.json().catch(() => ({}))) as SpreadsheetPreviewResponse;

            if (!response.ok) {
                throw new Error(json.message ?? 'Não foi possível importar a planilha JBS.');
            }

            applySpreadsheetPrefill(json);

            setNotification({
                message:
                    (json.warnings?.length ?? 0) > 0
                        ? `Planilha carregada para conferência com avisos: ${json.warnings?.join(' | ')}`
                        : (json.message ?? 'Planilha carregada para conferência. Revise e clique em Salvar lançamento.'),
                variant: (json.warnings?.length ?? 0) > 0 ? 'info' : 'success',
            });
        } catch (error) {
            setNotification({
                message:
                    error instanceof Error
                        ? error.message
                        : 'Não foi possível importar a planilha JBS.',
                variant: 'error',
            });
        } finally {
            setImportingSpreadsheet(false);
        }
    }

    const sections = [
        {
            title: 'Dados base',
            fields: [
                ['data', 'Data', 'date'],
                ['unidade_id', 'Unidade', 'select'],
                ['veiculos', 'Veículos', 'number'],
            ],
        },
        {
            title: 'Programado',
            fields: [
                ['programado_frete', 'Frete', 'number'],
                ['programado_viagens', 'Viagens', 'number'],
                ['programado_aves', 'Aves', 'number'],
                ['programado_km', 'Km', 'number'],
            ],
        },
        {
            title: 'Kaique geral',
            fields: [
                ['kaique_geral_frete', 'Frete', 'number'],
                ['kaique_geral_viagens', 'Viagens', 'number'],
                ['kaique_geral_aves', 'Aves', 'number'],
                ['kaique_geral_km', 'Km', 'number'],
            ],
        },
        {
            title: 'Terceiros',
            fields: [
                ['terceiros_frete', 'Frete', 'number'],
                ['terceiros_viagens', 'Viagens', 'number'],
                ['terceiros_aves', 'Aves', 'number'],
                ['terceiros_km', 'Km', 'number'],
            ],
        },
        {
            title: 'Abatedouro',
            fields: [
                ['abatedouro_frete', 'Frete', 'number'],
                ['abatedouro_viagens', 'Viagens', 'number'],
                ['abatedouro_aves', 'Aves', 'number'],
                ['abatedouro_km', 'Km', 'number'],
            ],
        },
        {
            title: 'Canceladas sem escalar',
            fields: [
                ['canceladas_sem_escalar_frete', 'Frete', 'number'],
                ['canceladas_sem_escalar_viagens', 'Viagens', 'number'],
                ['canceladas_sem_escalar_aves', 'Aves', 'number'],
                ['canceladas_sem_escalar_km', 'Km', 'number'],
            ],
        },
        {
            title: 'Canceladas escaladas',
            fields: [
                ['canceladas_escaladas_frete', 'Frete', 'number'],
                ['canceladas_escaladas_viagens', 'Viagens', 'number'],
                ['canceladas_escaladas_aves', 'Aves', 'number'],
                ['canceladas_escaladas_km', 'Km', 'number'],
            ],
        },
    ] as const;

    function fieldInputClass(field: string): string {
        const highlight = 'border-2 bg-muted/20 font-medium';
        if (field === 'unidade_id') return `max-w-xs ${highlight}`;
        if (field === 'data') return `max-w-[220px] ${highlight}`;
        if (moneyFields.has(field)) return `max-w-[220px] ${highlight}`;
        if (decimalThousandsFields.has(field)) return `max-w-[190px] ${highlight}`;
        if (integerThousandsFields.has(field)) return `max-w-[170px] ${highlight}`;
        return `max-w-[220px] ${highlight}`;
    }

    return (
        <AdminLayout title="Gestão de Fretes - Lançar" active="freight-launch" module="freight">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Lançar Fretes</h2>
                    <p className="text-sm text-muted-foreground">
                        Um único lançamento para alimentar visão diária, mensal, dashboard e linha do tempo.
                    </p>
                </div>

                <div className="flex justify-end">
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
                                Lendo planilha JBS...
                            </>
                        ) : (
                            <>
                                <Upload className="size-4" />
                                Pré-preencher via planilha JBS (XLSX)
                            </>
                        )}
                    </Button>
                </div>

                {notification ? <Notification message={notification.message} variant={notification.variant} /> : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Lançamento diário por unidade</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando formulário...
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {sections.map((section, sectionIndex) => (
                                    <div key={sectionIndex} className="space-y-3 rounded-md border p-3">
                                        <p className="text-sm font-semibold">{section.title}</p>
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                            {section.fields.map(([field, label, type]) => (
                                            <div key={field} className="space-y-2">
                                                <Label htmlFor={field}>{label}</Label>
                                                {type === 'select' ? (
                                                    <Select
                                                        value={form.unidade_id}
                                                        onValueChange={(value) =>
                                                            setForm((previous) => ({
                                                                ...previous,
                                                                unidade_id: value,
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger id={field} className={fieldInputClass(field)}>
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
                                                ) : (
                                                    <Input
                                                        id={field}
                                                        className={fieldInputClass(field)}
                                                        type={moneyFields.has(field) || integerThousandsFields.has(field) || decimalThousandsFields.has(field) ? 'text' : type}
                                                        inputMode={moneyFields.has(field) || decimalThousandsFields.has(field) ? 'decimal' : type === 'number' || integerThousandsFields.has(field) ? 'numeric' : undefined}
                                                        step={type === 'number' ? '0.01' : undefined}
                                                        value={form[field as keyof FormDataState]}
                                                        onChange={(event) => {
                                                            const value =
                                                                moneyFields.has(field)
                                                                    ? moneyMaskBR(event.target.value)
                                                                                                                                            : integerThousandsFields.has(field)
                                                                                                                                            ? integerThousandsMaskBR(event.target.value)
                                                                                                                                                : decimalThousandsFields.has(field)
                                                                                                                                                ? decimalThousandsMaskBR(event.target.value)
                                                                    : event.target.value;

                                                            setForm((previous) => ({
                                                                ...previous,
                                                                [field]: value,
                                                            }));
                                                        }}
                                                    />
                                                )}
                                            </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {canceledLoadDetails.length > 0 ? (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Cargas Canceladas Escaladas</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {canceledLoadDetails.map((item, index) => (
                                                <div key={index} className="space-y-3 rounded-md border p-3">
                                                    <p className="text-sm font-medium">Carga Cancelada {index + 1}</p>
                                                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor={`cancelada-placa-${index}`}>Placa</Label>
                                                            <StartsWithAutocompleteInput
                                                                id={`cancelada-placa-${index}`}
                                                                value={item.placa}
                                                                options={placasOptions}
                                                                inputClassName="border-2 bg-muted/20 font-medium"
                                                                normalize={(nextValue) => nextValue.toUpperCase()}
                                                                onChange={(nextValue) =>
                                                                    setCanceledLoadDetails((previous) => {
                                                                        const next = [...previous];
                                                                        next[index] = { ...next[index], placa: nextValue };
                                                                        return next;
                                                                    })
                                                                }
                                                                placeholder="ABC1D23"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor={`cancelada-aviario-${index}`}>Aviário</Label>
                                                            <StartsWithAutocompleteInput
                                                                id={`cancelada-aviario-${index}`}
                                                                value={item.aviario}
                                                                options={aviariosOptions}
                                                                inputClassName="border-2 bg-muted/20 font-medium"
                                                                onChange={(nextValue) =>
                                                                    setCanceledLoadDetails((previous) => {
                                                                        const next = [...previous];
                                                                        next[index] = { ...next[index], aviario: nextValue };
                                                                        return next;
                                                                    })
                                                                }
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor={`cancelada-valor-${index}`}>Valor</Label>
                                                            <Input
                                                                id={`cancelada-valor-${index}`}
                                                                className="border-2 bg-muted/20 font-medium"
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={item.valor}
                                                                onChange={(event) =>
                                                                    setCanceledLoadDetails((previous) => {
                                                                        const next = [...previous];
                                                                        next[index] = { ...next[index], valor: moneyMaskBR(event.target.value) };
                                                                        return next;
                                                                    })
                                                                }
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor={`cancelada-obs-${index}`}>Obs.</Label>
                                                            <Input
                                                                id={`cancelada-obs-${index}`}
                                                                className="border-2 bg-muted/20 font-medium"
                                                                value={item.obs}
                                                                onChange={(event) =>
                                                                    setCanceledLoadDetails((previous) => {
                                                                        const next = [...previous];
                                                                        next[index] = { ...next[index], obs: event.target.value };
                                                                        return next;
                                                                    })
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                ) : null}

                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="space-y-2 md:col-span-3">
                                        <Label htmlFor="obs">Obs.</Label>
                                        <textarea
                                            id="obs"
                                            value={form.obs}
                                            className="flex min-h-16 w-full rounded-md border-2 border-input bg-muted/20 px-3 py-2 text-base font-medium shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                                            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    obs: event.target.value,
                                                }))
                                            }
                                            rows={2}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <div className="flex gap-2">
                                        {editingEntryId ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => {
                                                    setEditingEntryId(null);
                                                    setForm((previous) => ({
                                                        ...emptyForm,
                                                        unidade_id: previous.unidade_id,
                                                        data: new Date().toISOString().slice(0, 10),
                                                    }));
                                                    setCanceledLoadDetails([]);
                                                }}
                                                disabled={saving}
                                            >
                                                Cancelar edição
                                            </Button>
                                        ) : null}
                                        <Button 
                                            type="button" 
                                            onClick={() => void handleSubmit()} 
                                            disabled={saving}
                                            data-save-action="true"
                                        >
                                            {saving ? (
                                                <>
                                                    <LoaderCircle className="size-4 animate-spin" />
                                                    Salvando...
                                                </>
                                            ) : (
                                                editingEntryId ? 'Salvar alterações' : 'Salvar lançamento'
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Lançamentos principais</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-4">
                            <div className="space-y-2">
                                <Label htmlFor="filter-start-date">Data inicial</Label>
                                <Input
                                    id="filter-start-date"
                                    type="date"
                                    value={filterStartDate}
                                    onChange={(event) => setFilterStartDate(event.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="filter-end-date">Data final</Label>
                                <Input
                                    id="filter-end-date"
                                    type="date"
                                    value={filterEndDate}
                                    onChange={(event) => setFilterEndDate(event.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Unidade</Label>
                                <Select
                                    value={filterUnidadeId}
                                    onValueChange={setFilterUnidadeId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        {unidades.map((unidade) => (
                                            <SelectItem key={unidade.id} value={String(unidade.id)}>
                                                {unidade.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setFilterStartDate(currentMonthStart);
                                        setFilterEndDate(today);
                                        setFilterUnidadeId('all');
                                        window.setTimeout(() => {
                                            void loadEntries(1);
                                        }, 0);
                                    }}
                                    disabled={entriesLoading}
                                >
                                    Limpar
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => void loadEntries(1)}
                                    disabled={entriesLoading}
                                >
                                    {entriesLoading ? (
                                        <>
                                            <LoaderCircle className="size-4 animate-spin" />
                                            Carregando...
                                        </>
                                    ) : (
                                        'Filtrar'
                                    )}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-3 md:hidden">
                            {entriesLoading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 4 }).map((_, index) => (
                                        <div key={`mobile-entry-skeleton-${index}`} className="rounded-md border p-3">
                                            <Skeleton className="mb-2 h-4 w-48" />
                                            <Skeleton className="mb-2 h-3 w-full" />
                                            <Skeleton className="h-3 w-2/3" />
                                        </div>
                                    ))}
                                </div>
                            ) : entries.length === 0 ? (
                                <div className="rounded-md border px-3 py-6 text-center text-sm text-muted-foreground">
                                    Nenhum lançamento encontrado para os filtros informados.
                                </div>
                            ) : (
                                entries.map((entry) => (
                                    <div key={`mobile-${entry.id}`} className="space-y-2 rounded-md border p-3 transition-colors hover:bg-muted/30">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold">{entry.unidade?.nome ?? `#${entry.unidade_id}`}</p>
                                                <p className="text-xs text-muted-foreground">{formatDateBR(entry.data, entry.data)}</p>
                                            </div>
                                            <p className="text-sm font-semibold">{formatCurrencyBR(Number((entry as Partial<FreightEntry>).kaique_geral_frete ?? entry.frete_total ?? 0))}</p>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                                            <div>
                                                <p className="font-medium text-foreground">{toIntegerString(Number((entry as Partial<FreightEntry>).kaique_geral_viagens ?? entry.cargas ?? 0))}</p>
                                                <p>Cargas</p>
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground">{toIntegerString(Number((entry as Partial<FreightEntry>).kaique_geral_aves ?? entry.aves ?? 0))}</p>
                                                <p>Aves</p>
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground">{toIntegerString(Number((entry as Partial<FreightEntry>).kaique_geral_km ?? entry.km_rodado ?? 0))}</p>
                                                <p>Km</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => startEdit(entry)}
                                            >
                                                <Pencil className="size-4" />
                                                Editar
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => requestDelete(entry)}
                                                disabled={deletingEntryId === entry.id}
                                            >
                                                {deletingEntryId === entry.id ? (
                                                    <LoaderCircle className="size-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="size-4" />
                                                )}
                                                Excluir
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="hidden overflow-x-auto rounded-md border md:block">
                            <table className="min-w-full text-sm">
                                <thead className="bg-muted/40 text-left">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">Data</th>
                                        <th className="px-3 py-2 font-medium">Unidade</th>
                                        <th className="px-3 py-2 font-medium">Frete</th>
                                        <th className="px-3 py-2 font-medium">Cargas</th>
                                        <th className="px-3 py-2 font-medium">Aves</th>
                                        <th className="px-3 py-2 font-medium">Km</th>
                                        <th className="px-3 py-2 font-medium">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entriesLoading ? (
                                        Array.from({ length: 6 }).map((_, index) => (
                                            <tr key={`desktop-entry-skeleton-${index}`} className="border-t">
                                                <td className="px-3 py-2" colSpan={7}>
                                                    <Skeleton className="h-6 w-full" />
                                                </td>
                                            </tr>
                                        ))
                                    ) : entries.length === 0 ? (
                                        <tr>
                                            <td className="px-3 py-6 text-center text-muted-foreground" colSpan={7}>
                                                Nenhum lançamento encontrado para os filtros informados.
                                            </td>
                                        </tr>
                                    ) : (
                                        entries.map((entry) => (
                                            <tr key={entry.id} className="border-t hover:bg-muted/30">
                                                <td className="px-3 py-2">{formatDateBR(entry.data, entry.data)}</td>
                                                <td className="px-3 py-2">{entry.unidade?.nome ?? `#${entry.unidade_id}`}</td>
                                                <td className="px-3 py-2">{formatCurrencyBR(Number((entry as Partial<FreightEntry>).kaique_geral_frete ?? entry.frete_total ?? 0))}</td>
                                                <td className="px-3 py-2">{toIntegerString(Number((entry as Partial<FreightEntry>).kaique_geral_viagens ?? entry.cargas ?? 0))}</td>
                                                <td className="px-3 py-2">{toIntegerString(Number((entry as Partial<FreightEntry>).kaique_geral_aves ?? entry.aves ?? 0))}</td>
                                                <td className="px-3 py-2">{toIntegerString(Number((entry as Partial<FreightEntry>).kaique_geral_km ?? entry.km_rodado ?? 0))}</td>
                                                <td className="px-3 py-2">
                                                    <div className="flex gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            title="Editar"
                                                            aria-label="Editar"
                                                            onClick={() => startEdit(entry)}
                                                        >
                                                            <Pencil className="size-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive hover:text-destructive"
                                                            title={deletingEntryId === entry.id ? 'Excluindo...' : 'Excluir'}
                                                            aria-label={deletingEntryId === entry.id ? 'Excluindo' : 'Excluir'}
                                                            onClick={() => requestDelete(entry)}
                                                            disabled={deletingEntryId === entry.id}
                                                        >
                                                            {deletingEntryId === entry.id ? (
                                                                <LoaderCircle className="size-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="size-4" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <p className="text-sm text-muted-foreground">
                                Página {entriesCurrentPage} de {entriesLastPage} · {entriesTotal} lançamento(s)
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void loadEntries(entriesCurrentPage - 1)}
                                    disabled={entriesLoading || entriesCurrentPage <= 1}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void loadEntries(entriesCurrentPage + 1)}
                                    disabled={entriesLoading || entriesCurrentPage >= entriesLastPage}
                                >
                                    Próxima
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog
                open={Boolean(deleteCandidate)}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteCandidate(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir lançamento</DialogTitle>
                        <DialogDescription>
                            {deleteCandidate
                                ? `Deseja excluir o lançamento #${deleteCandidate.id} da data ${formatDateBR(deleteCandidate.data, deleteCandidate.data)}?`
                                : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDeleteCandidate(null)}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                                if (!deleteCandidate) return;
                                void handleDelete(deleteCandidate).finally(() => setDeleteCandidate(null));
                            }}
                            disabled={!deleteCandidate || deletingEntryId === deleteCandidate.id}
                        >
                            {deleteCandidate && deletingEntryId === deleteCandidate.id ? 'Excluindo...' : 'Confirmar exclusão'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </AdminLayout>
    );
}
