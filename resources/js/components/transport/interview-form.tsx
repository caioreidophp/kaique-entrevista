import { LoaderCircle, Save } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IMaskInput } from 'react-imask';
import { FormStepper } from '@/components/transport/form-stepper';
import { Notification } from '@/components/transport/notification';
import { ObservationsWidget } from '@/components/transport/observations-widget';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api-client';
import type {
    DriverInterview,
    DriverInterviewFormData,
} from '@/types/driver-interview';

interface InterviewFormProps {
    mode: 'create' | 'edit';
    initialData?: DriverInterview;
    initialDraftData?: Partial<DriverInterviewFormData>;
    initialStep?: number;
    draftStorageKey?: string;
    hiringUnitOptions?: Array<{ id: number; nome: string }>;
    cityOptions?: Array<{ value: string; label: string }>;
    onProgressChange?: (progress: { fullName: string; step: number }) => void;
    onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}

const textAreaClassName =
    'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive min-h-[90px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50';

const maskedInputClassName =
    'border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive';

const CITY_ROW_HEIGHT = 36;
const CITY_VIEWPORT_HEIGHT = 288;
const CITY_OVERSCAN = 6;

const maritalStatusOptions = [
    'Casado(a)',
    'Solteiro(a)',
    'Amasiado(a)',
    'Divorciado(a)',
    'Viúvo(a)',
];

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
    return value
        .toUpperCase()
        .replace(/[^0-9A-Z]/g, '')
        .slice(0, 30);
}

function formatRg(value: string): string {
    return sanitizeRg(value);
}

function toCurrencyDigits(value: string): string {
    return value.replace(/\D/g, '');
}

function formatCurrencyInput(value: string): string {
    const digits = toCurrencyDigits(value);

    if (!digits) {
        return '';
    }

    return (Number(digits) / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
}

function currencyInputToNumber(value: string): number {
    const digits = toCurrencyDigits(value);

    if (!digits) {
        return 0;
    }

    return Number(digits) / 100;
}

function sanitizeCnhNumber(value: string): string {
    return value.replace(/\D/g, '').slice(0, 11);
}

function sanitizeCnhCategory(value: string): string {
    return value
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 2);
}

function hasText(value: string): boolean {
    return value.trim().length > 0;
}

function normalizeSearchText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function hasAnyProfessionalExperience(data: DriverInterviewFormData): boolean {
    return Boolean(
        data.last_company ||
        data.last_role ||
        data.last_city ||
        data.last_period_start ||
        data.last_period_end ||
        data.last_exit_type ||
        data.last_exit_reason ||
        data.last_company_observation ||
        data.previous_company ||
        data.previous_role ||
        data.previous_city ||
        data.previous_period_start ||
        data.previous_period_end ||
        data.previous_exit_type ||
        data.previous_exit_reason ||
        data.previous_company_observation ||
        data.other_company ||
        data.other_role ||
        data.other_city ||
        data.other_period_start ||
        data.other_period_end ||
        data.other_exit_reason,
    );
}

function dateToIso(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function normalizeDraftComparableValue(value: unknown): unknown {
    if (typeof value === 'string') {
        return value.trim();
    }

    return value;
}

function defaultFormData(
    initialData?: DriverInterview,
    initialDraftData?: Partial<DriverInterviewFormData>,
): DriverInterviewFormData {
    const base: DriverInterviewFormData = {
        full_name: initialData?.full_name ?? '',
        preferred_name: initialData?.preferred_name ?? '',
        phone: formatPhone(initialData?.phone ?? ''),
        email: initialData?.email ?? '',
        city: initialData?.city ?? '',
        cargo_pretendido: initialData?.cargo_pretendido ?? '',
        hiring_unidade_id: initialData?.hiring_unidade_id
            ? String(initialData.hiring_unidade_id)
            : '',
        marital_status: initialData?.marital_status ?? '',
        has_children: initialData?.has_children ?? false,
        children_situation: initialData?.children_situation ?? '',
        cpf: formatCpf(initialData?.cpf ?? ''),
        rg: sanitizeRg(initialData?.rg ?? ''),
        cnh_number: sanitizeCnhNumber(initialData?.cnh_number ?? ''),
        cnh_category: sanitizeCnhCategory(initialData?.cnh_category ?? ''),
        cnh_expiration_date: initialData?.cnh_expiration_date ?? '',
        ear: initialData?.ear ?? false,
        last_company: initialData?.last_company ?? '',
        last_role: initialData?.last_role ?? '',
        last_city: initialData?.last_city ?? '',
        last_period_start: initialData?.last_period_start ?? '',
        last_period_end: initialData?.last_period_end ?? '',
        last_exit_type: initialData?.last_exit_type ?? '',
        last_exit_reason: initialData?.last_exit_reason ?? '',
        last_company_observation: initialData?.last_company_observation ?? '',
        previous_company: initialData?.previous_company ?? '',
        previous_role: initialData?.previous_role ?? '',
        previous_city: initialData?.previous_city ?? '',
        previous_period_start: initialData?.previous_period_start ?? '',
        previous_period_end: initialData?.previous_period_end ?? '',
        previous_exit_type: initialData?.previous_exit_type ?? '',
        previous_exit_reason: initialData?.previous_exit_reason ?? '',
        previous_company_observation:
            initialData?.previous_company_observation ?? '',
        other_company: initialData?.other_company ?? '',
        other_role: initialData?.other_role ?? '',
        other_city: initialData?.other_city ?? '',
        other_period_start: initialData?.other_period_start ?? '',
        other_period_end: initialData?.other_period_end ?? '',
        other_exit_reason: initialData?.other_exit_reason ?? '',
        relevant_experience: initialData?.relevant_experience ?? '',
        truck_types_operated: initialData?.truck_types_operated ?? '',
        night_shift_experience: initialData?.night_shift_experience ?? false,
        live_animals_transport_experience:
            initialData?.live_animals_transport_experience ?? false,
        accident_history: initialData?.accident_history ?? false,
        accident_details: initialData?.accident_details ?? '',
        schedule_availability: initialData?.schedule_availability ?? '',
        start_availability_date: initialData?.start_availability_date ?? '',
        start_availability_note: initialData?.start_availability_note ?? '',
        knows_company_contact: initialData?.knows_company_contact ?? false,
        contact_name: initialData?.contact_name ?? '',
        expectations_about_company:
            initialData?.expectations_about_company ?? '',
        last_salary: formatCurrencyInput(String(initialData?.last_salary ?? '')),
        salary_expectation: formatCurrencyInput(
            String(initialData?.salary_expectation ?? ''),
        ),
        salary_observation: initialData?.salary_observation ?? '',
        posture_communication: initialData?.posture_communication ?? '',
        perceived_experience: initialData?.perceived_experience ?? '',
        general_observations: initialData?.general_observations ?? '',
        candidate_interest: initialData?.candidate_interest ?? 'medio',
        availability_matches: initialData?.availability_matches ?? true,
        overall_score: String(initialData?.overall_score ?? ''),
        hr_status: initialData?.hr_status ?? 'aguardando_vaga',
        hr_rejection_reason: initialData?.hr_rejection_reason ?? '',
        guep_status: initialData?.guep_status ?? 'aguardando',
    };

    return {
        ...base,
        ...initialDraftData,
    };
}

export function hasMeaningfulInterviewDraftData(
    data: Partial<DriverInterviewFormData>,
    baseline: DriverInterviewFormData = defaultFormData(),
): boolean {
    const fields = Object.keys(baseline) as Array<keyof DriverInterviewFormData>;

    return fields.some((field) => {
        return (
            normalizeDraftComparableValue(data[field]) !==
            normalizeDraftComparableValue(baseline[field])
        );
    });
}

function FormField({
    label,
    error,
    children,
}: {
    label: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            {children}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
    );
}

function BooleanSelect({
    value,
    onChange,
}: {
    value: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <Select
            value={String(value)}
            onValueChange={(selected) => onChange(selected === 'true')}
        >
            <SelectTrigger>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="true">Sim</SelectItem>
                <SelectItem value="false">Não</SelectItem>
            </SelectContent>
        </Select>
    );
}

function CityAutocompleteField({
    label,
    error,
    value,
    onChange,
    cityOptions,
}: {
    label: string;
    error?: string;
    value: string;
    onChange: (next: string) => void;
    cityOptions: Array<{ value: string; label: string }>;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [scrollTop, setScrollTop] = useState(0);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const listRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const filteredOptions = useMemo(() => {
        const term = normalizeSearchText(value);

        if (!term) {
            return cityOptions;
        }

        return cityOptions.filter((option) =>
            normalizeSearchText(option.label).includes(term),
        );
    }, [cityOptions, value]);

    const visibleRange = useMemo(() => {
        const visibleCount = Math.ceil(CITY_VIEWPORT_HEIGHT / CITY_ROW_HEIGHT);
        const start = Math.max(
            0,
            Math.floor(scrollTop / CITY_ROW_HEIGHT) - CITY_OVERSCAN,
        );
        const end = Math.min(
            filteredOptions.length,
            start + visibleCount + CITY_OVERSCAN * 2,
        );

        return { start, end };
    }, [filteredOptions.length, scrollTop]);

    const visibleOptions = useMemo(
        () => filteredOptions.slice(visibleRange.start, visibleRange.end),
        [filteredOptions, visibleRange.end, visibleRange.start],
    );
    const effectiveHighlightedIndex =
        filteredOptions.length === 0
            ? -1
            : Math.min(
                  Math.max(highlightedIndex, 0),
                  filteredOptions.length - 1,
              );

    function openOptions(): void {
        setIsOpen(true);
        setScrollTop(0);
        setHighlightedIndex(filteredOptions.length > 0 ? 0 : -1);

        if (listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }

    function scrollOptionIntoView(index: number): void {
        const listElement = listRef.current;

        if (!listElement || index < 0) {
            return;
        }

        const optionTop = index * CITY_ROW_HEIGHT;
        const optionBottom = optionTop + CITY_ROW_HEIGHT;
        const viewTop = listElement.scrollTop;
        const viewBottom = viewTop + listElement.clientHeight;

        if (optionTop < viewTop) {
            listElement.scrollTop = optionTop;
        } else if (optionBottom > viewBottom) {
            listElement.scrollTop = optionBottom - listElement.clientHeight;
        }
    }

    return (
        <FormField label={label} error={error}>
            <div className="relative">
                <Input
                    ref={inputRef}
                    value={value}
                    onFocus={openOptions}
                    onBlur={() => {
                        window.setTimeout(() => {
                            setIsOpen(false);
                            setHighlightedIndex(-1);
                        }, 120);
                    }}
                    onChange={(event) => {
                        onChange(event.target.value);
                        openOptions();
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            setIsOpen(false);
                            setHighlightedIndex(-1);
                            return;
                        }

                        if (
                            event.key !== 'ArrowDown' &&
                            event.key !== 'ArrowUp' &&
                            event.key !== 'Enter'
                        ) {
                            return;
                        }

                        if (!isOpen) {
                            openOptions();
                        }

                        if (filteredOptions.length === 0) {
                            return;
                        }

                        if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            const nextIndex = Math.min(
                                filteredOptions.length - 1,
                                effectiveHighlightedIndex < 0
                                    ? 0
                                    : effectiveHighlightedIndex + 1,
                            );
                            setHighlightedIndex(nextIndex);
                            scrollOptionIntoView(nextIndex);
                            return;
                        }

                        if (event.key === 'ArrowUp') {
                            event.preventDefault();
                            const previousIndex = Math.max(
                                0,
                                effectiveHighlightedIndex < 0
                                    ? 0
                                    : effectiveHighlightedIndex - 1,
                            );
                            setHighlightedIndex(previousIndex);
                            scrollOptionIntoView(previousIndex);
                            return;
                        }

                        if (
                            event.key === 'Enter' &&
                            effectiveHighlightedIndex >= 0
                        ) {
                            event.preventDefault();
                            onChange(
                                filteredOptions[effectiveHighlightedIndex]
                                    ?.value ?? value,
                            );
                            setIsOpen(false);
                            setHighlightedIndex(-1);
                        }
                    }}
                    placeholder="Digite para buscar cidade"
                />
                {isOpen && filteredOptions.length > 0 ? (
                    <div
                        ref={listRef}
                        className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border shadow-md"
                        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
                    >
                        <div
                            style={{
                                height: filteredOptions.length * CITY_ROW_HEIGHT,
                                position: 'relative',
                            }}
                        >
                            {visibleOptions.map((option, index) => {
                                const absoluteIndex = visibleRange.start + index;

                                return (
                                    <button
                                        key={`${label}-${option.value}-${absoluteIndex}`}
                                        type="button"
                                        className={`absolute right-0 left-0 px-3 py-2 text-left text-sm ${
                                            effectiveHighlightedIndex ===
                                            absoluteIndex
                                                ? 'bg-muted'
                                                : 'hover:bg-muted'
                                        }`}
                                        style={{
                                            top: absoluteIndex * CITY_ROW_HEIGHT,
                                            height: CITY_ROW_HEIGHT,
                                        }}
                                        onMouseEnter={() =>
                                            setHighlightedIndex(absoluteIndex)
                                        }
                                        onMouseDown={(event) => {
                                            event.preventDefault();
                                            onChange(option.value);
                                            setIsOpen(false);
                                            setHighlightedIndex(-1);
                                            inputRef.current?.focus();
                                        }}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : null}
            </div>
        </FormField>
    );
}

export function InterviewForm({
    mode,
    initialData,
    initialDraftData,
    initialStep,
    draftStorageKey,
    hiringUnitOptions = [],
    cityOptions = [],
    onProgressChange,
    onSubmit,
}: InterviewFormProps) {
    const initialFormData = useMemo(
        () => defaultFormData(initialData, initialDraftData),
        [initialData, initialDraftData],
    );
    const emptyCreateFormData = useMemo(() => defaultFormData(), []);
    const [formData, setFormData] =
        useState<DriverInterviewFormData>(initialFormData);
    const [step, setStep] = useState(initialStep ?? 0);
    const [submitting, setSubmitting] = useState(false);
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [hasProfessionalExperience, setHasProfessionalExperience] = useState(
        hasAnyProfessionalExperience(initialFormData),
    );
    const [showPreviousCompany, setShowPreviousCompany] = useState(
        Boolean(
            initialFormData.previous_company ||
            initialFormData.previous_role ||
            initialFormData.previous_city ||
            initialFormData.previous_period_start ||
            initialFormData.previous_period_end ||
            initialFormData.previous_exit_type ||
            initialFormData.previous_exit_reason ||
            initialFormData.previous_company_observation ||
            initialFormData.other_company ||
            initialFormData.other_role ||
            initialFormData.other_city ||
            initialFormData.other_period_start ||
            initialFormData.other_period_end ||
            initialFormData.other_exit_reason,
        ),
    );
    const [showOtherCompany, setShowOtherCompany] = useState(
        Boolean(
            initialFormData.other_company ||
            initialFormData.other_role ||
            initialFormData.other_city ||
            initialFormData.other_period_start ||
            initialFormData.other_period_end ||
            initialFormData.other_exit_reason,
        ),
    );
    const hasExistingInterview = mode === 'edit' && Boolean(initialData?.id);
    const isHrReproved = formData.hr_status === 'reprovado';
    const startAvailabilitySelectValue =
        formData.start_availability_note === 'ira_retornar'
            ? 'ira_retornar'
            : formData.start_availability_date || undefined;

    const startAvailabilityOptions = useMemo(() => {
        const baseDate = new Date();
        const addDays = (days: number) => {
            const d = new Date(baseDate);
            d.setDate(d.getDate() + days);
            return dateToIso(d);
        };

        const options = [
            { value: addDays(0), label: 'Imediato' },
            { value: addDays(7), label: '1 semana' },
            { value: addDays(15), label: '15 dias' },
            { value: addDays(30), label: '30 dias' },
            { value: 'ira_retornar', label: 'Irá retornar' },
        ];

        if (
            formData.start_availability_date &&
            !options.some(
                (item) => item.value === formData.start_availability_date,
            )
        ) {
            options.push({
                value: formData.start_availability_date,
                label: `Data registrada (${formData.start_availability_date})`,
            });
        }

        return options;
    }, [formData.start_availability_date]);

    const overallScoreOptions = useMemo(
        () =>
            Array.from({ length: 21 }, (_, index) =>
                (index / 2).toFixed(1).replace('.0', ''),
            ),
        [],
    );

    useEffect(() => {
        if (isHrReproved && formData.guep_status !== 'nao_fazer') {
            setFormData((prev) => ({ ...prev, guep_status: 'nao_fazer' }));
        }
    }, [formData.guep_status, isHrReproved]);

    useEffect(() => {
        onProgressChange?.({
            fullName: formData.full_name,
            step,
        });
    }, [formData.full_name, onProgressChange, step]);

    useEffect(() => {
        if (
            mode !== 'create' ||
            !draftStorageKey ||
            typeof window === 'undefined'
        ) {
            return;
        }

        if (!hasMeaningfulInterviewDraftData(formData, emptyCreateFormData)) {
            window.localStorage.removeItem(draftStorageKey);
            return;
        }

        const timeoutId = window.setTimeout(() => {
            const draftPayload = {
                version: 1,
                updatedAt: new Date().toISOString(),
                step,
                data: formData,
            };

            window.localStorage.setItem(
                draftStorageKey,
                JSON.stringify(draftPayload),
            );
        }, 450);

        return () => window.clearTimeout(timeoutId);
    }, [draftStorageKey, emptyCreateFormData, formData, mode, step]);

    const sections = useMemo(() => {
        const baseSteps = [
            'Qual unidade?',
            'Dados Pessoais',
            'Documentos',
            'Experiência Profissional',
            'Vivência na Função',
            'Disponibilidade',
            'Salário',
            'Avaliação Final',
        ];

        if (hasExistingInterview) {
            baseSteps.push('GUEP');
        }

        return baseSteps;
    }, [hasExistingInterview]);

    const stepRequiredCompletion = useMemo(() => {
        const completion: boolean[] = [
            hasText(formData.hiring_unidade_id),

            hasText(formData.full_name) &&
                hasText(formData.preferred_name) &&
                sanitizePhone(formData.phone).length === 11 &&
                hasText(formData.email) &&
                hasText(formData.city) &&
                hasText(formData.cargo_pretendido) &&
                hasText(formData.marital_status),

            sanitizeCpf(formData.cpf).length === 11 &&
                sanitizeRg(formData.rg).length >= 3 &&
                sanitizeCnhNumber(formData.cnh_number).length === 11 &&
                sanitizeCnhCategory(formData.cnh_category).length >= 1 &&
                hasText(formData.cnh_expiration_date),

            true,

            hasText(formData.night_shift_experience ? '1' : '0') &&
                hasText(
                    formData.live_animals_transport_experience ? '1' : '0',
                ) &&
                hasText(formData.accident_history ? '1' : '0') &&
                (!formData.accident_history || hasText(formData.accident_details)),

            hasText(formData.schedule_availability) &&
                hasText(formData.knows_company_contact ? '1' : '0') &&
                (!formData.knows_company_contact || hasText(formData.contact_name)),

            hasText(formData.last_salary) && hasText(formData.salary_expectation),

            hasText(formData.candidate_interest) &&
                hasText(formData.availability_matches ? '1' : '0') &&
                hasText(formData.overall_score) &&
                (!isHrReproved || hasText(formData.hr_rejection_reason)) &&
                hasText(formData.hr_status),

            true,
        ];

        return completion;
    }, [formData, isHrReproved]);

    const stepStates = useMemo(
        () =>
            sections.map((_, index) => {
                if (index >= step) {
                    return 'pending' as const;
                }

                return stepRequiredCompletion[index] ? 'complete' : 'warning';
            }),
        [sections, step, stepRequiredCompletion],
    );

    function updateField<K extends keyof DriverInterviewFormData>(
        field: K,
        value: DriverInterviewFormData[K],
    ): void {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: '' }));
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setStatusMessage(null);

        const sanitizedCpf = sanitizeCpf(formData.cpf);
        const sanitizedRg = sanitizeRg(formData.rg);
        const sanitizedPhone = sanitizePhone(formData.phone);
        const sanitizedCnhNumber = sanitizeCnhNumber(formData.cnh_number);
        const sanitizedCnhCategory = sanitizeCnhCategory(formData.cnh_category);
        const clientErrors: Record<string, string> = {};

        if (!/^\d{11}$/.test(sanitizedCpf)) {
            clientErrors.cpf = 'CPF deve conter exatamente 11 números.';
        }

        if (!/^\d{11}$/.test(sanitizedPhone)) {
            clientErrors.phone = 'Telefone deve conter exatamente 11 números.';
        }

        if (!/^[0-9A-Z]{3,30}$/.test(sanitizedRg)) {
            clientErrors.rg =
                'RG deve conter de 3 a 30 caracteres alfanuméricos.';
        }

        if (!/^\d{11}$/.test(sanitizedCnhNumber)) {
            clientErrors.cnh_number = 'CNH deve conter exatamente 11 números.';
        }

        if (!/^[A-Z]{1,2}$/.test(sanitizedCnhCategory)) {
            clientErrors.cnh_category = 'Categoria deve conter 1 ou 2 letras.';
        }

        if (Object.keys(clientErrors).length > 0) {
            setErrors((previous) => ({ ...previous, ...clientErrors }));
            setStatusMessage(
                'Revise os campos de CPF, RG, Telefone, CNH e Categoria.',
            );
            setSubmitting(false);

            return;
        }

        const payloadBase: Record<string, unknown> = {
            ...formData,
            phone: sanitizedPhone,
            cpf: sanitizedCpf,
            rg: sanitizedRg,
            cnh_number: sanitizedCnhNumber,
            cnh_category: sanitizedCnhCategory,
            hiring_unidade_id:
                formData.hiring_unidade_id === ''
                    ? null
                    : Number(formData.hiring_unidade_id),
            last_company: hasProfessionalExperience
                ? formData.last_company.trim() || null
                : null,
            last_role: hasProfessionalExperience
                ? formData.last_role.trim() || null
                : null,
            last_city: hasProfessionalExperience
                ? formData.last_city.trim() || null
                : null,
            last_period_start: hasProfessionalExperience
                ? formData.last_period_start || null
                : null,
            last_period_end: hasProfessionalExperience
                ? formData.last_period_end || null
                : null,
            last_exit_type: hasProfessionalExperience
                ? formData.last_exit_type || null
                : null,
            last_exit_reason: hasProfessionalExperience
                ? formData.last_exit_reason.trim() || null
                : null,
            last_company_observation: hasProfessionalExperience
                ? formData.last_company_observation.trim() || null
                : null,
            previous_company:
                hasProfessionalExperience && showPreviousCompany
                    ? formData.previous_company.trim() || null
                    : null,
            previous_role:
                hasProfessionalExperience && showPreviousCompany
                    ? formData.previous_role.trim() || null
                    : null,
            previous_city:
                hasProfessionalExperience && showPreviousCompany
                    ? formData.previous_city.trim() || null
                    : null,
            previous_period_start:
                hasProfessionalExperience && showPreviousCompany
                    ? formData.previous_period_start || null
                    : null,
            previous_period_end:
                hasProfessionalExperience && showPreviousCompany
                    ? formData.previous_period_end || null
                    : null,
            previous_exit_type:
                hasProfessionalExperience && showPreviousCompany
                    ? formData.previous_exit_type || null
                    : null,
            previous_exit_reason:
                hasProfessionalExperience && showPreviousCompany
                    ? formData.previous_exit_reason.trim() || null
                    : null,
            previous_company_observation:
                hasProfessionalExperience && showPreviousCompany
                    ? formData.previous_company_observation.trim() || null
                    : null,
            other_company:
                hasProfessionalExperience && showOtherCompany
                    ? formData.other_company.trim() || null
                    : null,
            other_role:
                hasProfessionalExperience && showOtherCompany
                    ? formData.other_role.trim() || null
                    : null,
            other_city:
                hasProfessionalExperience && showOtherCompany
                    ? formData.other_city.trim() || null
                    : null,
            other_period_start:
                hasProfessionalExperience && showOtherCompany
                    ? formData.other_period_start || null
                    : null,
            other_period_end:
                hasProfessionalExperience && showOtherCompany
                    ? formData.other_period_end || null
                    : null,
            other_exit_reason:
                hasProfessionalExperience && showOtherCompany
                    ? formData.other_exit_reason.trim() || null
                    : null,
            relevant_experience: formData.relevant_experience.trim() || null,
            truck_types_operated: formData.truck_types_operated.trim() || null,
            last_salary: currencyInputToNumber(formData.last_salary),
            salary_expectation: currencyInputToNumber(formData.salary_expectation),
            salary_observation: formData.salary_observation.trim() || null,
            overall_score:
                formData.overall_score === ''
                    ? null
                    : Number(formData.overall_score),
            start_availability_date:
                formData.start_availability_note === 'ira_retornar'
                    ? null
                    : formData.start_availability_date || null,
            start_availability_note: formData.start_availability_note || null,
            accident_details: formData.accident_history
                ? formData.accident_details || null
                : null,
            contact_name: formData.knows_company_contact
                ? formData.contact_name.trim() || null
                : null,
            hr_rejection_reason:
                formData.hr_status === 'reprovado'
                    ? formData.hr_rejection_reason.trim() || null
                    : null,
            cargo_pretendido: formData.cargo_pretendido.trim() || null,
            expectations_about_company:
                formData.expectations_about_company.trim() || null,
            children_situation: formData.has_children
                ? formData.children_situation.trim() || null
                : null,
            posture_communication:
                formData.posture_communication.trim() || null,
            perceived_experience: formData.perceived_experience.trim() || null,
            general_observations: formData.general_observations.trim() || null,
        };

        const payload: Record<string, unknown> = hasExistingInterview
            ? payloadBase
            : Object.fromEntries(
                  Object.entries(payloadBase).filter(
                      ([key]) => key !== 'guep_status',
                  ),
              );

        try {
            await onSubmit(payload);

            if (
                mode === 'create' &&
                draftStorageKey &&
                typeof window !== 'undefined'
            ) {
                window.localStorage.removeItem(draftStorageKey);
            }
        } catch (error) {
            if (error instanceof ApiError) {
                const flattenedErrors: Record<string, string> = {};

                if (error.errors) {
                    Object.entries(error.errors).forEach(([field, list]) => {
                        flattenedErrors[field] = list[0] ?? 'Campo inválido.';
                    });
                }

                setErrors(flattenedErrors);
                setStatusMessage(
                    Object.keys(flattenedErrors).length > 0
                        ? 'Existem campos obrigatórios pendentes. Revise os campos destacados.'
                        : error.message,
                );
            } else {
                setStatusMessage('Não foi possível salvar a entrevista.');
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form className="space-y-6" onSubmit={handleSubmit}>
            {statusMessage ? (
                <Notification message={statusMessage} variant="error" />
            ) : null}

            <FormStepper
                steps={sections}
                currentStep={step}
                onStepClick={setStep}
                stepStates={stepStates}
                emphasizeWarnings={submitAttempted}
            />

            {step === 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>1. Qual unidade?</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <p className="text-sm text-muted-foreground">
                            Selecione a unidade responsável pela contratação
                            antes de preencher os dados da entrevista.
                        </p>
                        <FormField
                            label="Qual unidade?"
                            error={errors.hiring_unidade_id}
                        >
                            <Select
                                value={formData.hiring_unidade_id || '__none'}
                                onValueChange={(value) => {
                                    if (value === '__none') {
                                        updateField('hiring_unidade_id', '');
                                        return;
                                    }

                                    updateField('hiring_unidade_id', value);
                                }}
                            >
                                <SelectTrigger className="h-12 text-base">
                                    <SelectValue placeholder="Selecione a unidade" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none">
                                        Não definido
                                    </SelectItem>
                                    {hiringUnitOptions.map((unit) => (
                                        <SelectItem
                                            key={unit.id}
                                            value={String(unit.id)}
                                        >
                                            {unit.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>
                    </CardContent>
                </Card>
            ) : null}

            {step === 1 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>2. Dados Pessoais</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <FormField
                            label="Nome completo"
                            error={errors.full_name}
                        >
                            <Input
                                value={formData.full_name}
                                onChange={(event) =>
                                    updateField('full_name', event.target.value)
                                }
                            />
                        </FormField>
                        <FormField
                            label="Como prefere ser chamado"
                            error={errors.preferred_name}
                        >
                            <Input
                                value={formData.preferred_name}
                                onChange={(event) =>
                                    updateField(
                                        'preferred_name',
                                        event.target.value,
                                    )
                                }
                            />
                        </FormField>
                        <FormField
                            label="Telefone / WhatsApp"
                            error={errors.phone}
                        >
                            <IMaskInput
                                mask="(00)00000-0000"
                                value={formData.phone}
                                className={maskedInputClassName}
                                inputMode="numeric"
                                overwrite
                                unmask={false}
                                onAccept={(value) =>
                                    updateField('phone', String(value))
                                }
                            />
                        </FormField>
                        <FormField label="E-mail" error={errors.email}>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={(event) =>
                                    updateField('email', event.target.value)
                                }
                            />
                        </FormField>
                        <CityAutocompleteField
                            label="Cidade"
                            error={errors.city}
                            value={formData.city}
                            onChange={(value) => updateField('city', value)}
                            cityOptions={cityOptions}
                        />
                        <FormField
                            label="Cargo pretendido"
                            error={errors.cargo_pretendido}
                        >
                            <Input
                                value={formData.cargo_pretendido}
                                onChange={(event) =>
                                    updateField(
                                        'cargo_pretendido',
                                        event.target.value,
                                    )
                                }
                            />
                        </FormField>
                        <FormField
                            label="Estado civil"
                            error={errors.marital_status}
                        >
                            <Select
                                value={formData.marital_status || undefined}
                                onValueChange={(value) =>
                                    updateField('marital_status', value)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {maritalStatusOptions.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>
                        <FormField
                            label="Possui filhos?"
                            error={errors.has_children}
                        >
                            <BooleanSelect
                                value={formData.has_children}
                                onChange={(value) =>
                                    updateField('has_children', value)
                                }
                            />
                        </FormField>
                        {formData.has_children ? (
                            <div className="md:col-span-2">
                                <FormField
                                    label="Situação dos filhos (opcional)"
                                    error={errors.children_situation}
                                >
                                    <textarea
                                        value={formData.children_situation}
                                        onChange={(event) =>
                                            updateField(
                                                'children_situation',
                                                event.target.value,
                                            )
                                        }
                                        className={textAreaClassName}
                                        placeholder="Ex.: quantidade de filhos, idades, rotina, observações relevantes..."
                                    />
                                </FormField>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            ) : null}

            {step === 2 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>3. Documentos e Habilitação</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <FormField label="CPF" error={errors.cpf}>
                            <IMaskInput
                                mask="000.000.000-00"
                                value={formData.cpf}
                                className={maskedInputClassName}
                                inputMode="numeric"
                                overwrite
                                unmask={false}
                                onAccept={(value) =>
                                    updateField('cpf', String(value))
                                }
                            />
                        </FormField>
                        <FormField label="RG" error={errors.rg}>
                            <Input
                                value={formData.rg}
                                onChange={(event) =>
                                    updateField(
                                        'rg',
                                        formatRg(event.target.value),
                                    )
                                }
                            />
                        </FormField>
                        <FormField label="CNH" error={errors.cnh_number}>
                            <IMaskInput
                                mask="00000000000"
                                value={formData.cnh_number}
                                className={maskedInputClassName}
                                inputMode="numeric"
                                overwrite
                                unmask={false}
                                onAccept={(value) =>
                                    updateField('cnh_number', String(value))
                                }
                            />
                        </FormField>
                        <FormField
                            label="Categoria"
                            error={errors.cnh_category}
                        >
                            <Input
                                value={formData.cnh_category}
                                maxLength={2}
                                onChange={(event) =>
                                    updateField(
                                        'cnh_category',
                                        sanitizeCnhCategory(event.target.value),
                                    )
                                }
                            />
                        </FormField>
                        <FormField
                            label="Validade da CNH"
                            error={errors.cnh_expiration_date}
                        >
                            <Input
                                type="date"
                                value={formData.cnh_expiration_date}
                                onChange={(event) =>
                                    updateField(
                                        'cnh_expiration_date',
                                        event.target.value,
                                    )
                                }
                            />
                        </FormField>
                        <FormField label="EAR" error={errors.ear}>
                            <BooleanSelect
                                value={formData.ear}
                                onChange={(value) => updateField('ear', value)}
                            />
                        </FormField>
                    </CardContent>
                </Card>
            ) : null}

            {step === 3 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>4. Experiência Profissional</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField label="Tem experiência profissional?">
                            <BooleanSelect
                                value={hasProfessionalExperience}
                                onChange={(value) => {
                                    setHasProfessionalExperience(value);

                                    if (!value) {
                                        setShowPreviousCompany(false);
                                        setShowOtherCompany(false);

                                        setFormData((prev) => ({
                                            ...prev,
                                            last_company: '',
                                            last_role: '',
                                            last_city: '',
                                            last_period_start: '',
                                            last_period_end: '',
                                            last_exit_type: '',
                                            last_exit_reason: '',
                                            last_company_observation: '',
                                            previous_company: '',
                                            previous_role: '',
                                            previous_city: '',
                                            previous_period_start: '',
                                            previous_period_end: '',
                                            previous_exit_type: '',
                                            previous_exit_reason: '',
                                            previous_company_observation: '',
                                            other_company: '',
                                            other_role: '',
                                            other_city: '',
                                            other_period_start: '',
                                            other_period_end: '',
                                            other_exit_reason: '',
                                        }));

                                        setErrors((prev) => ({
                                            ...prev,
                                            last_company: '',
                                            last_role: '',
                                            last_city: '',
                                            last_period_start: '',
                                            last_period_end: '',
                                            last_exit_type: '',
                                            last_exit_reason: '',
                                            last_company_observation: '',
                                            previous_company: '',
                                            previous_role: '',
                                            previous_city: '',
                                            previous_period_start: '',
                                            previous_period_end: '',
                                            previous_exit_type: '',
                                            previous_exit_reason: '',
                                            previous_company_observation: '',
                                            other_company: '',
                                            other_role: '',
                                            other_city: '',
                                            other_period_start: '',
                                            other_period_end: '',
                                            other_exit_reason: '',
                                        }));
                                    }
                                }}
                            />
                        </FormField>

                        {hasProfessionalExperience ? (
                            <>
                                <div className="grid gap-4 md:grid-cols-10">
                                    <div className="md:col-span-3">
                                        <FormField
                                            label="Última empresa"
                                            error={errors.last_company}
                                        >
                                            <Input
                                                value={formData.last_company}
                                                onChange={(event) =>
                                                    updateField(
                                                        'last_company',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </FormField>
                                    </div>
                                    <div className="md:col-span-3">
                                        <CityAutocompleteField
                                            label="Cidade"
                                            error={errors.last_city}
                                            value={formData.last_city}
                                            onChange={(value) =>
                                                updateField('last_city', value)
                                            }
                                            cityOptions={cityOptions}
                                        />
                                    </div>
                                    <div className="md:col-span-4">
                                        <FormField
                                            label="Função"
                                            error={errors.last_role}
                                        >
                                            <Input
                                                value={formData.last_role}
                                                onChange={(event) =>
                                                    updateField(
                                                        'last_role',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </FormField>
                                    </div>
                                </div>
                                <div className="grid gap-4 md:grid-cols-6">
                                    <FormField
                                        label="Tipo da saída"
                                        error={errors.last_exit_type}
                                    >
                                        <Select
                                            value={
                                                formData.last_exit_type ||
                                                undefined
                                            }
                                            onValueChange={(value) =>
                                                updateField(
                                                    'last_exit_type',
                                                    value,
                                                )
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="pedido">
                                                    Pedido
                                                </SelectItem>
                                                <SelectItem value="despensa">
                                                    Despensa
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormField>
                                    <div className="md:col-span-5">
                                        <FormField
                                            label="Motivo da saída"
                                            error={errors.last_exit_reason}
                                        >
                                            <Input
                                                value={formData.last_exit_reason}
                                                onChange={(event) =>
                                                    updateField(
                                                        'last_exit_reason',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </FormField>
                                    </div>
                                </div>
                                <div className="grid gap-4 md:grid-cols-6">
                                    <div className="md:col-span-3">
                                        <FormField
                                            label="Período início"
                                            error={errors.last_period_start}
                                        >
                                            <Input
                                                type="date"
                                                value={formData.last_period_start}
                                                onChange={(event) =>
                                                    updateField(
                                                        'last_period_start',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </FormField>
                                    </div>
                                    <div className="md:col-span-3">
                                        <FormField
                                            label="Período fim"
                                            error={errors.last_period_end}
                                        >
                                            <Input
                                                type="date"
                                                value={formData.last_period_end}
                                                onChange={(event) =>
                                                    updateField(
                                                        'last_period_end',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </FormField>
                                    </div>
                                </div>
                                <div className="md:max-w-2xl">
                                    <FormField
                                        label="Observação da última empresa (opcional)"
                                        error={errors.last_company_observation}
                                    >
                                        <textarea
                                            className={textAreaClassName}
                                            value={formData.last_company_observation}
                                            onChange={(event) =>
                                                updateField(
                                                    'last_company_observation',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </FormField>
                                </div>

                                {showPreviousCompany ? (
                                    <>
                                        <div className="grid gap-4 md:grid-cols-10">
                                            <div className="md:col-span-3">
                                                <FormField
                                                    label="Penúltima empresa"
                                                    error={errors.previous_company}
                                                >
                                                    <Input
                                                        value={
                                                            formData.previous_company
                                                        }
                                                        onChange={(event) =>
                                                            updateField(
                                                                'previous_company',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                </FormField>
                                            </div>
                                            <div className="md:col-span-3">
                                                <CityAutocompleteField
                                                    label="Cidade"
                                                    error={errors.previous_city}
                                                    value={
                                                        formData.previous_city
                                                    }
                                                    onChange={(value) =>
                                                        updateField(
                                                            'previous_city',
                                                            value,
                                                        )
                                                    }
                                                    cityOptions={cityOptions}
                                                />
                                            </div>
                                            <div className="md:col-span-4">
                                                <FormField
                                                    label="Função"
                                                    error={errors.previous_role}
                                                >
                                                    <Input
                                                        value={
                                                            formData.previous_role
                                                        }
                                                        onChange={(event) =>
                                                            updateField(
                                                                'previous_role',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                </FormField>
                                            </div>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-6">
                                            <FormField
                                                label="Tipo da saída"
                                                error={errors.previous_exit_type}
                                            >
                                                <Select
                                                    value={
                                                        formData.previous_exit_type ||
                                                        undefined
                                                    }
                                                    onValueChange={(value) =>
                                                        updateField(
                                                            'previous_exit_type',
                                                            value,
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pedido">
                                                            Pedido
                                                        </SelectItem>
                                                        <SelectItem value="despensa">
                                                            Despensa
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormField>
                                            <div className="md:col-span-5">
                                                <FormField
                                                    label="Motivo da saída"
                                                    error={
                                                        errors.previous_exit_reason
                                                    }
                                                >
                                                    <Input
                                                        value={
                                                            formData.previous_exit_reason
                                                        }
                                                        onChange={(event) =>
                                                            updateField(
                                                                'previous_exit_reason',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                </FormField>
                                            </div>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-6">
                                            <div className="md:col-span-3">
                                                <FormField
                                                    label="Período início"
                                                    error={
                                                        errors.previous_period_start
                                                    }
                                                >
                                                    <Input
                                                        type="date"
                                                        value={
                                                            formData.previous_period_start
                                                        }
                                                        onChange={(event) =>
                                                            updateField(
                                                                'previous_period_start',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                </FormField>
                                            </div>
                                            <div className="md:col-span-3">
                                                <FormField
                                                    label="Período fim"
                                                    error={
                                                        errors.previous_period_end
                                                    }
                                                >
                                                    <Input
                                                        type="date"
                                                        value={
                                                            formData.previous_period_end
                                                        }
                                                        onChange={(event) =>
                                                            updateField(
                                                                'previous_period_end',
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                </FormField>
                                            </div>
                                        </div>
                                        <div className="md:max-w-2xl">
                                            <FormField
                                                label="Observação da penúltima empresa (opcional)"
                                                error={
                                                    errors.previous_company_observation
                                                }
                                            >
                                                <textarea
                                                    className={textAreaClassName}
                                                    value={
                                                        formData.previous_company_observation
                                                    }
                                                    onChange={(event) =>
                                                        updateField(
                                                            'previous_company_observation',
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                            </FormField>
                                        </div>

                                        {showOtherCompany ? (
                                            <>
                                                <div className="grid gap-4 md:grid-cols-10">
                                                    <div className="md:col-span-3">
                                                        <FormField
                                                            label="Outra empresa"
                                                            error={
                                                                errors.other_company
                                                            }
                                                        >
                                                            <Input
                                                                value={
                                                                    formData.other_company
                                                                }
                                                                onChange={(event) =>
                                                                    updateField(
                                                                        'other_company',
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    )
                                                                }
                                                            />
                                                        </FormField>
                                                    </div>
                                                    <div className="md:col-span-3">
                                                        <CityAutocompleteField
                                                            label="Cidade"
                                                            error={errors.other_city}
                                                            value={
                                                                formData.other_city
                                                            }
                                                            onChange={(value) =>
                                                                updateField(
                                                                    'other_city',
                                                                    value,
                                                                )
                                                            }
                                                            cityOptions={cityOptions}
                                                        />
                                                    </div>
                                                    <div className="md:col-span-4">
                                                        <FormField
                                                            label="Função"
                                                            error={errors.other_role}
                                                        >
                                                            <Input
                                                                value={
                                                                    formData.other_role
                                                                }
                                                                onChange={(event) =>
                                                                    updateField(
                                                                        'other_role',
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    )
                                                                }
                                                            />
                                                        </FormField>
                                                    </div>
                                                </div>
                                                <div className="grid gap-4 md:grid-cols-6">
                                                    <div className="md:col-span-6">
                                                        <FormField
                                                            label="Motivo da saída"
                                                            error={
                                                                errors.other_exit_reason
                                                            }
                                                        >
                                                            <Input
                                                                value={
                                                                    formData.other_exit_reason
                                                                }
                                                                onChange={(event) =>
                                                                    updateField(
                                                                        'other_exit_reason',
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    )
                                                                }
                                                            />
                                                        </FormField>
                                                    </div>
                                                </div>
                                                <div className="grid gap-4 md:grid-cols-6">
                                                    <div className="md:col-span-3">
                                                        <FormField
                                                            label="Período início"
                                                            error={
                                                                errors.other_period_start
                                                            }
                                                        >
                                                            <Input
                                                                type="date"
                                                                value={
                                                                    formData.other_period_start
                                                                }
                                                                onChange={(event) =>
                                                                    updateField(
                                                                        'other_period_start',
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    )
                                                                }
                                                            />
                                                        </FormField>
                                                    </div>
                                                    <div className="md:col-span-3">
                                                        <FormField
                                                            label="Período fim"
                                                            error={
                                                                errors.other_period_end
                                                            }
                                                        >
                                                            <Input
                                                                type="date"
                                                                value={
                                                                    formData.other_period_end
                                                                }
                                                                onChange={(event) =>
                                                                    updateField(
                                                                        'other_period_end',
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    )
                                                                }
                                                            />
                                                        </FormField>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() =>
                                                    setShowOtherCompany(true)
                                                }
                                            >
                                                + Outra Empresa
                                            </Button>
                                        )}
                                    </>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            setShowPreviousCompany(true)
                                        }
                                    >
                                        + Penúltima Empresa
                                    </Button>
                                )}
                            </>
                        ) : null}

                        <FormField
                            label="Experiências anteriores relevantes"
                            error={errors.relevant_experience}
                        >
                            <textarea
                                className={textAreaClassName}
                                value={formData.relevant_experience}
                                onChange={(event) =>
                                    updateField(
                                        'relevant_experience',
                                        event.target.value,
                                    )
                                }
                            />
                        </FormField>
                    </CardContent>
                </Card>
            ) : null}

            {step === 4 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>5. Vivência na Função</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            label="Tipos de caminhão que já operou"
                            error={errors.truck_types_operated}
                        >
                            <textarea
                                className={textAreaClassName}
                                value={formData.truck_types_operated}
                                onChange={(event) =>
                                    updateField(
                                        'truck_types_operated',
                                        event.target.value,
                                    )
                                }
                            />
                        </FormField>
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                label="Experiência em trabalho noturno"
                                error={errors.night_shift_experience}
                            >
                                <BooleanSelect
                                    value={formData.night_shift_experience}
                                    onChange={(value) =>
                                        updateField(
                                            'night_shift_experience',
                                            value,
                                        )
                                    }
                                />
                            </FormField>
                            <FormField
                                label="Experiência com transporte de aves vivas"
                                error={errors.live_animals_transport_experience}
                            >
                                <BooleanSelect
                                    value={
                                        formData.live_animals_transport_experience
                                    }
                                    onChange={(value) =>
                                        updateField(
                                            'live_animals_transport_experience',
                                            value,
                                        )
                                    }
                                />
                            </FormField>
                            <FormField
                                label="Histórico de acidente"
                                error={errors.accident_history}
                            >
                                <BooleanSelect
                                    value={formData.accident_history}
                                    onChange={(value) =>
                                        updateField('accident_history', value)
                                    }
                                />
                            </FormField>
                        </div>
                        <FormField
                            label="Detalhes do acidente"
                            error={errors.accident_details}
                        >
                            <textarea
                                disabled={!formData.accident_history}
                                className={textAreaClassName}
                                value={formData.accident_details}
                                onChange={(event) =>
                                    updateField(
                                        'accident_details',
                                        event.target.value,
                                    )
                                }
                            />
                        </FormField>
                    </CardContent>
                </Card>
            ) : null}

            {step === 5 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>6. Disponibilidade e Alinhamento</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                label="Disponibilidade de horário/escala"
                                error={errors.schedule_availability}
                            >
                                <Input
                                    value={formData.schedule_availability}
                                    onChange={(event) =>
                                        updateField(
                                            'schedule_availability',
                                            event.target.value,
                                        )
                                    }
                                />
                            </FormField>
                            <FormField
                                label="Pode iniciar quando"
                                error={errors.start_availability_date}
                            >
                                <Select
                                    value={startAvailabilitySelectValue}
                                    onValueChange={(value) => {
                                        if (value === 'ira_retornar') {
                                            updateField(
                                                'start_availability_note',
                                                'ira_retornar',
                                            );
                                            updateField(
                                                'start_availability_date',
                                                '',
                                            );
                                            return;
                                        }

                                        updateField(
                                            'start_availability_note',
                                            '',
                                        );
                                        updateField(
                                            'start_availability_date',
                                            value,
                                        );
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {startAvailabilityOptions.map(
                                            (item) => (
                                                <SelectItem
                                                    key={item.value}
                                                    value={item.value}
                                                >
                                                    {item.label}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </FormField>
                            <FormField
                                label="Conhece alguém na empresa"
                                error={errors.knows_company_contact}
                            >
                                <BooleanSelect
                                    value={formData.knows_company_contact}
                                    onChange={(value) =>
                                        updateField(
                                            'knows_company_contact',
                                            value,
                                        )
                                    }
                                />
                            </FormField>
                            <FormField label="Quem" error={errors.contact_name}>
                                <Input
                                    disabled={!formData.knows_company_contact}
                                    value={formData.contact_name}
                                    onChange={(event) =>
                                        updateField(
                                            'contact_name',
                                            event.target.value,
                                        )
                                    }
                                />
                            </FormField>
                        </div>
                        <FormField
                            label="O que espera de uma empresa de transporte"
                            error={errors.expectations_about_company}
                        >
                            <textarea
                                className={textAreaClassName}
                                value={formData.expectations_about_company}
                                onChange={(event) =>
                                    updateField(
                                        'expectations_about_company',
                                        event.target.value,
                                    )
                                }
                            />
                        </FormField>
                    </CardContent>
                </Card>
            ) : null}

            {step === 6 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>7. Informações Salariais</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <FormField
                            label="Última remuneração"
                            error={errors.last_salary}
                        >
                            <Input
                                inputMode="numeric"
                                placeholder="R$ 0,00"
                                value={formData.last_salary}
                                onChange={(event) =>
                                    updateField(
                                        'last_salary',
                                        formatCurrencyInput(event.target.value),
                                    )
                                }
                            />
                        </FormField>
                        <FormField
                            label="Pretensão salarial"
                            error={errors.salary_expectation}
                        >
                            <Input
                                inputMode="numeric"
                                placeholder="R$ 0,00"
                                value={formData.salary_expectation}
                                onChange={(event) =>
                                    updateField(
                                        'salary_expectation',
                                        formatCurrencyInput(event.target.value),
                                    )
                                }
                            />
                        </FormField>
                        <div className="md:col-span-2">
                            <FormField
                                label="Observação salarial (opcional)"
                                error={errors.salary_observation}
                            >
                                <textarea
                                    className={textAreaClassName}
                                    value={formData.salary_observation}
                                    onChange={(event) =>
                                        updateField(
                                            'salary_observation',
                                            event.target.value,
                                        )
                                    }
                                />
                            </FormField>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {step === 7 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>8. Avaliação Final</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                label="Interesse do candidato"
                                error={errors.candidate_interest}
                            >
                                <Select
                                    value={formData.candidate_interest}
                                    onValueChange={(value) =>
                                        updateField(
                                            'candidate_interest',
                                            value as DriverInterviewFormData['candidate_interest'],
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="baixo">
                                            Baixo
                                        </SelectItem>
                                        <SelectItem value="medio">
                                            Médio
                                        </SelectItem>
                                        <SelectItem value="alto">
                                            Alto
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormField>
                            <FormField
                                label="Disponibilidade atende a vaga"
                                error={errors.availability_matches}
                            >
                                <BooleanSelect
                                    value={formData.availability_matches}
                                    onChange={(value) =>
                                        updateField(
                                            'availability_matches',
                                            value,
                                        )
                                    }
                                />
                            </FormField>
                            <FormField
                                label="Nota geral (0 a 10, de 0,5 em 0,5)"
                                error={errors.overall_score}
                            >
                                <Select
                                    value={formData.overall_score || undefined}
                                    onValueChange={(value) =>
                                        updateField('overall_score', value)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {overallScoreOptions.map((score) => (
                                            <SelectItem
                                                key={score}
                                                value={score}
                                            >
                                                {score}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormField>
                            <FormField label="Parecer" error={errors.hr_status}>
                                <Select
                                    value={formData.hr_status}
                                    onValueChange={(value) =>
                                        updateField(
                                            'hr_status',
                                            value as DriverInterviewFormData['hr_status'],
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="aprovado">
                                            Aprovado
                                        </SelectItem>
                                        <SelectItem value="reprovado">
                                            Reprovado
                                        </SelectItem>
                                        <SelectItem value="em_analise">
                                            Em análise
                                        </SelectItem>
                                        <SelectItem value="aguardando_vaga">
                                            Aguardando vaga
                                        </SelectItem>
                                        <SelectItem value="guep">
                                            GUEP
                                        </SelectItem>
                                        <SelectItem value="teste_pratico">
                                            Teste prático
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormField>
                            {formData.hr_status === 'reprovado' ? (
                                <div className="md:col-span-2">
                                    <FormField
                                        label="Motivo da reprovação"
                                        error={errors.hr_rejection_reason}
                                    >
                                        <textarea
                                            className={textAreaClassName}
                                            value={formData.hr_rejection_reason}
                                            onChange={(event) =>
                                                updateField(
                                                    'hr_rejection_reason',
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="Descreva o motivo da reprovação"
                                        />
                                    </FormField>
                                </div>
                            ) : null}
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {hasExistingInterview && step === 8 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>9. GUEP</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            label="Status GUEP"
                            error={errors.guep_status}
                        >
                            <Select
                                value={formData.guep_status}
                                onValueChange={(value) =>
                                    updateField(
                                        'guep_status',
                                        value as DriverInterviewFormData['guep_status'],
                                    )
                                }
                                disabled={isHrReproved}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="nao_fazer">
                                        Não fazer
                                    </SelectItem>
                                    <SelectItem value="a_fazer">
                                        A fazer
                                    </SelectItem>
                                    <SelectItem value="aprovado">
                                        Aprovado
                                    </SelectItem>
                                    <SelectItem value="reprovado">
                                        Reprovado
                                    </SelectItem>
                                    <SelectItem value="aguardando">
                                        Aguardando
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </FormField>

                        {isHrReproved ? (
                            <p className="text-xs text-muted-foreground">
                                Com RH em reprovado, GUEP é definido
                                automaticamente como não fazer.
                            </p>
                        ) : null}
                    </CardContent>
                </Card>
            ) : null}

            <div className="flex items-center justify-between border-t pt-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                        setStep((current) => Math.max(current - 1, 0))
                    }
                    disabled={step === 0 || submitting}
                >
                    Voltar
                </Button>

                <div className="flex items-center gap-2">
                    {step < sections.length - 1 ? (
                        <Button
                            type="button"
                            onClick={() =>
                                setStep((current) =>
                                    Math.min(current + 1, sections.length - 1),
                                )
                            }
                            disabled={submitting || !stepRequiredCompletion[step]}
                        >
                            Próxima etapa
                        </Button>
                    ) : mode === 'create' ? (
                        <Button
                            type="submit"
                            onClick={() => setSubmitAttempted(true)}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <>
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                'Salvar entrevista'
                            )}
                        </Button>
                    ) : null}
                </div>
            </div>

            {mode === 'edit' ? (
                <div className="fixed bottom-4 left-4 z-40 print:hidden">
                    <Button
                        type="submit"
                        onClick={() => setSubmitAttempted(true)}
                        size="lg"
                        className="shadow-lg"
                        disabled={submitting}
                    >
                        {submitting ? (
                            <>
                                <LoaderCircle className="size-4 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Save className="size-4" />
                                Salvar alterações
                            </>
                        )}
                    </Button>
                </div>
            ) : null}

            <ObservationsWidget
                postureCommunication={formData.posture_communication}
                perceivedExperience={formData.perceived_experience}
                generalObservations={formData.general_observations}
                onChange={updateField}
                errors={errors}
            />
        </form>
    );
}
