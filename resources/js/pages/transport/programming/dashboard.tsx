import {
    AlertTriangle,
    CalendarDays,
    CheckCircle2,
    FileSpreadsheet,
    GripVertical,
    LoaderCircle,
    Search,
    Truck,
    Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ApiError, apiGet, apiPost } from '@/lib/api-client';
import { formatDateBR, formatDecimalBR, formatIntegerBR } from '@/lib/transport-format';

type NoticeVariant = 'success' | 'error' | 'info';
type DragType = 'driver' | 'truck';
type DriverFilter = 'all' | 'available' | 'started';
type TruckFilter = 'all' | 'available' | 'started';
type ResourceStatus = 'available' | 'started' | 'closed';
type FloatingPanelKey = 'drivers' | 'trucks';

interface UnitItem {
    id: number;
    nome: string;
}

interface DriverItem {
    id: number;
    nome: string;
    funcao_nome: string;
    unidade_id: number;
    cnh: string;
    is_habilitado: boolean;
    is_assigned_today: boolean;
    is_available_today: boolean;
    horas_trabalhadas_dia: number;
    horas_extra_dia: number;
    tem_alerta_interjornada: boolean;
}

interface TruckItem {
    id: number;
    placa: string;
    unidade_id: number;
    is_assigned_today: boolean;
    is_available_today: boolean;
}

interface InterjornadaAlert {
    is_violated: boolean;
    descanso_horas: number | null;
    mensagem: string | null;
    ultimo_fim: string | null;
}

interface TripScaleItem {
    id: number;
    colaborador_id: number;
    colaborador_nome: string;
    placa_frota_id: number;
    placa: string;
    observacoes: string | null;
}

interface TripItem {
    id: number;
    ordem_no_dia?: number | null;
    data_viagem: string;
    data_saida_operacional?: string | null;
    saida_dia_anterior?: boolean;
    unidade_id: number;
    unidade_nome: string;
    codigo_viagem: string | null;
    origem: string | null;
    destino: string | null;
    aviario: string | null;
    cidade: string | null;
    distancia_km: number;
    equipe: string | null;
    aves: number;
    numero_carga: string | null;
    hora_inicio_prevista: string | null;
    hora_carregamento_prevista: string | null;
    hora_fim_prevista: string | null;
    jornada_horas_prevista: number;
    observacoes: string | null;
    interjornada_alert: InterjornadaAlert | null;
    escala: TripScaleItem | null;
}

interface JornadaItem {
    colaborador_id: number;
    nome: string;
    horas_trabalhadas_dia: number;
    horas_extra_dia: number;
    ocupacao_percentual: number;
}

interface ProgrammingDashboardResponse {
    unidades: UnitItem[];
    filters: {
        unidade_id: number | null;
        data: string;
    };
    drivers: DriverItem[];
    trucks: TruckItem[];
    trips: TripItem[];
    jornada: JornadaItem[];
    summary: {
        trips_total: number;
        trips_assigned?: number;
        trips_unassigned: number;
        assignment_rate?: number;
        drivers_available: number;
        drivers_started?: number;
        trucks_available: number;
        trucks_started?: number;
        interjornada_alerts?: number;
        trips_previous_day_start?: number;
        overloaded_drivers_count?: number;
    };
    driver_overload?: Array<DriverItem>;
    operation_alerts?: Array<{
        level: 'warning' | 'info';
        title: string;
        detail: string;
    }>;
}

interface AssignmentDraft {
    colaborador_id: string;
    placa_frota_id: string;
    hora_inicio_prevista: string;
    hora_carregamento_prevista: string;
    hora_fim_prevista: string;
}

interface DragPayload {
    type: DragType;
    id: number;
}

interface ImportPreviewResponse {
    total_lidas: number;
    total_validas: number;
    total_erros: number;
    total_ignoradas?: number;
    preview: Array<Record<string, unknown>>;
    erros: Array<{
        linha: number;
        erro: string;
    }>;
    ignoradas?: Array<{
        linha: number;
        motivo: string;
    }>;
}

interface ResourceUsageMeta {
    assignedCount: number;
    totalHours: number;
    status: ResourceStatus;
    labels: string[];
}

interface FloatingPanelState {
    x: number;
    y: number;
    width: number;
    height: number;
    z: number;
}

interface DragPanelState {
    panel: FloatingPanelKey;
    offsetX: number;
    offsetY: number;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof ApiError && error.message.trim() !== '') {
        return error.message;
    }

    return fallback;
}

function parseDropPayload(raw: string): DragPayload | null {
    const [type, idRaw] = raw.split(':');

    if ((type !== 'driver' && type !== 'truck') || !idRaw) {
        return null;
    }

    const id = Number(idRaw);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return {
        type,
        id,
    };
}

function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function resolveResourceStatus(assignedCount: number, totalHours: number): ResourceStatus {
    if (assignedCount >= 2 || totalHours >= 8) {
        return 'closed';
    }

    if (assignedCount >= 1) {
        return 'started';
    }

    return 'available';
}

function statusBadgeClass(status: ResourceStatus): string {
    if (status === 'started') {
        return 'transport-status-badge transport-status-warning';
    }

    if (status === 'closed') {
        return 'transport-status-badge transport-status-danger';
    }

    return 'transport-status-badge transport-status-success';
}

function statusLabel(status: ResourceStatus): string {
    if (status === 'started') {
        return 'Viagem Iniciada';
    }

    if (status === 'closed') {
        return 'Encerrado';
    }

    return 'Disponível';
}

function clamp(value: number, min: number, max: number): number {
    if (value < min) {
        return min;
    }

    if (value > max) {
        return max;
    }

    return value;
}

function buildDraftSignature(draft: AssignmentDraft | null | undefined): string {
    if (!draft) {
        return '';
    }

    return [
        draft.colaborador_id,
        draft.placa_frota_id,
        draft.hora_inicio_prevista,
        draft.hora_carregamento_prevista,
        draft.hora_fim_prevista,
    ].join('|');
}

function hasRequiredAssignment(draft: AssignmentDraft | null | undefined): boolean {
    if (!draft) {
        return false;
    }

    return draft.colaborador_id !== 'none' && draft.placa_frota_id !== 'none';
}

function findBestDriverMatch(query: string, drivers: DriverItem[]): DriverItem | null {
    const normalizedQuery = normalizeText(query);

    if (!normalizedQuery) {
        return null;
    }

    const exact = drivers.find((item) => normalizeText(item.nome) === normalizedQuery);

    if (exact) {
        return exact;
    }

    const startsWith = drivers.find((item) => normalizeText(item.nome).startsWith(normalizedQuery));

    if (startsWith) {
        return startsWith;
    }

    return drivers.find((item) => normalizeText(item.nome).includes(normalizedQuery)) ?? null;
}

function findBestTruckMatch(query: string, trucks: TruckItem[]): TruckItem | null {
    const normalizedQuery = normalizeText(query);

    if (!normalizedQuery) {
        return null;
    }

    const exact = trucks.find((item) => normalizeText(item.placa) === normalizedQuery);

    if (exact) {
        return exact;
    }

    const startsWith = trucks.find((item) => normalizeText(item.placa).startsWith(normalizedQuery));

    if (startsWith) {
        return startsWith;
    }

    return trucks.find((item) => normalizeText(item.placa).includes(normalizedQuery)) ?? null;
}

function defaultPanelStates(): Record<FloatingPanelKey, FloatingPanelState> {
    return {
        drivers: {
            x: 0,
            y: 0,
            width: 340,
            height: 500,
            z: 20,
        },
        trucks: {
            x: 0,
            y: 520,
            width: 340,
            height: 360,
            z: 21,
        },
    };
}

export default function TransportProgrammingDashboardPage() {
    const [data, setData] = useState<ProgrammingDashboardResponse | null>(null);
    const [selectedUnitId, setSelectedUnitId] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [assignmentDraft, setAssignmentDraft] = useState<Record<number, AssignmentDraft>>({});
    const [driverInputByTrip, setDriverInputByTrip] = useState<Record<number, string>>({});
    const [truckInputByTrip, setTruckInputByTrip] = useState<Record<number, string>>({});
    const [dragging, setDragging] = useState<DragPayload | null>(null);
    const [dragOverZone, setDragOverZone] = useState<string | null>(null);
    const [driverQuery, setDriverQuery] = useState('');
    const [truckQuery, setTruckQuery] = useState('');
    const [driverFilter, setDriverFilter] = useState<DriverFilter>('all');
    const [truckFilter, setTruckFilter] = useState<TruckFilter>('all');

    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [clearingDay, setClearingDay] = useState(false);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState<boolean>(
        typeof window !== 'undefined' ? window.innerWidth >= 1280 : false,
    );
    const [panelStates, setPanelStates] = useState<Record<FloatingPanelKey, FloatingPanelState>>(defaultPanelStates());
    const [dragPanelState, setDragPanelState] = useState<DragPanelState | null>(null);

    const [autoSavingTripIds, setAutoSavingTripIds] = useState<Record<number, boolean>>({});
    const [autoSavedAtByTrip, setAutoSavedAtByTrip] = useState<Record<number, number>>({});
    const [tripSaveErrors, setTripSaveErrors] = useState<Record<number, string>>({});

    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ message: string; variant: NoticeVariant } | null>(null);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importPreview, setImportPreview] = useState<ImportPreviewResponse | null>(null);
    const [previewing, setPreviewing] = useState(false);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const dashboardRequestSeqRef = useRef(0);
    const assignmentDraftRef = useRef<Record<number, AssignmentDraft>>({});
    const tripsRef = useRef<TripItem[]>([]);
    const autoSaveTimersRef = useRef<Record<number, number>>({});
    const lastSavedSignatureRef = useRef<Record<number, string>>({});
    const workspaceRef = useRef<HTMLDivElement | null>(null);
    const panelRefs = useRef<Record<FloatingPanelKey, HTMLDivElement | null>>({
        drivers: null,
        trucks: null,
    });
    const driverInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
    const truckInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    const units = data?.unidades ?? [];
    const trips = data?.trips ?? [];
    const drivers = data?.drivers ?? [];
    const trucks = data?.trucks ?? [];

    const driversById = useMemo(
        () => new Map(drivers.map((item) => [item.id, item] as const)),
        [drivers],
    );

    const trucksById = useMemo(
        () => new Map(trucks.map((item) => [item.id, item] as const)),
        [trucks],
    );

    useEffect(() => {
        assignmentDraftRef.current = assignmentDraft;
    }, [assignmentDraft]);

    useEffect(() => {
        tripsRef.current = trips;
    }, [trips]);

    useEffect(() => {
        const onResize = (): void => {
            setIsDesktop(window.innerWidth >= 1280);
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('resize', onResize);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('resize', onResize);
            }
        };
    }, []);

    useEffect(() => {
        if (!dragPanelState) {
            return;
        }

        const onMove = (event: MouseEvent): void => {
            const workspace = workspaceRef.current;

            if (!workspace) {
                return;
            }

            const workspaceRect = workspace.getBoundingClientRect();

            setPanelStates((previous) => {
                const current = previous[dragPanelState.panel];
                const nextX = clamp(
                    event.clientX - workspaceRect.left - dragPanelState.offsetX,
                    0,
                    Math.max(0, workspaceRect.width - current.width),
                );
                const nextY = clamp(
                    event.clientY - workspaceRect.top - dragPanelState.offsetY,
                    0,
                    Math.max(0, workspaceRect.height - 80),
                );

                return {
                    ...previous,
                    [dragPanelState.panel]: {
                        ...current,
                        x: Math.round(nextX),
                        y: Math.round(nextY),
                    },
                };
            });
        };

        const onUp = (): void => {
            setDragPanelState(null);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);

        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [dragPanelState]);

    useEffect(() => {
        return () => {
            Object.values(autoSaveTimersRef.current).forEach((timeoutId) => {
                window.clearTimeout(timeoutId);
            });
        };
    }, []);

    const orderedTripIds = useMemo(() => trips.map((trip) => trip.id), [trips]);

    const driverUsageMetaMap = useMemo(() => {
        const map = new Map<number, ResourceUsageMeta>();

        drivers.forEach((driver) => {
            map.set(driver.id, {
                assignedCount: 0,
                totalHours: 0,
                status: 'available',
                labels: [],
            });
        });

        trips.forEach((trip) => {
            const draft = assignmentDraft[trip.id];

            if (!draft || draft.colaborador_id === 'none') {
                return;
            }

            const driverId = Number(draft.colaborador_id);
            const meta = map.get(driverId);

            if (!meta) {
                return;
            }

            meta.assignedCount += 1;
            meta.totalHours += Number(trip.jornada_horas_prevista ?? 0);

            if (meta.labels.length < 3) {
                meta.labels.push(`#${trip.ordem_no_dia ?? trip.id}`);
            }
        });

        map.forEach((meta) => {
            meta.totalHours = Number(meta.totalHours.toFixed(2));
            meta.status = resolveResourceStatus(meta.assignedCount, meta.totalHours);
        });

        return map;
    }, [drivers, trips, assignmentDraft]);

    const truckUsageMetaMap = useMemo(() => {
        const map = new Map<number, ResourceUsageMeta>();

        trucks.forEach((truck) => {
            map.set(truck.id, {
                assignedCount: 0,
                totalHours: 0,
                status: 'available',
                labels: [],
            });
        });

        trips.forEach((trip) => {
            const draft = assignmentDraft[trip.id];

            if (!draft || draft.placa_frota_id === 'none') {
                return;
            }

            const truckId = Number(draft.placa_frota_id);
            const meta = map.get(truckId);

            if (!meta) {
                return;
            }

            meta.assignedCount += 1;
            meta.totalHours += Number(trip.jornada_horas_prevista ?? 0);

            if (meta.labels.length < 3) {
                meta.labels.push(`#${trip.ordem_no_dia ?? trip.id}`);
            }
        });

        map.forEach((meta) => {
            meta.totalHours = Number(meta.totalHours.toFixed(2));
            meta.status = resolveResourceStatus(meta.assignedCount, meta.totalHours);
        });

        return map;
    }, [trucks, trips, assignmentDraft]);

    const normalizedDriverQuery = driverQuery.trim().toLowerCase();
    const normalizedTruckQuery = truckQuery.trim().toLowerCase();

    const filteredDrivers = useMemo(() => {
        return drivers.filter((driver) => {
            const meta = driverUsageMetaMap.get(driver.id);
            const status = meta?.status ?? 'available';

            if (driverFilter === 'available' && status !== 'available') {
                return false;
            }

            if (driverFilter === 'started' && status !== 'started') {
                return false;
            }

            if (normalizedDriverQuery === '') {
                return true;
            }

            const haystack = `${driver.nome} ${driver.funcao_nome}`.toLowerCase();
            return haystack.includes(normalizedDriverQuery);
        });
    }, [drivers, driverUsageMetaMap, driverFilter, normalizedDriverQuery]);

    const filteredTrucks = useMemo(() => {
        return trucks.filter((truck) => {
            const meta = truckUsageMetaMap.get(truck.id);
            const status = meta?.status ?? 'available';

            if (truckFilter === 'available' && status !== 'available') {
                return false;
            }

            if (truckFilter === 'started' && status !== 'started') {
                return false;
            }

            if (normalizedTruckQuery === '') {
                return true;
            }

            return truck.placa.toLowerCase().includes(normalizedTruckQuery);
        });
    }, [trucks, truckUsageMetaMap, truckFilter, normalizedTruckQuery]);

    const driverCounters = useMemo(() => {
        let available = 0;
        let started = 0;

        drivers.forEach((driver) => {
            const status = driverUsageMetaMap.get(driver.id)?.status ?? 'available';

            if (status === 'available') {
                available += 1;
            }

            if (status === 'started') {
                started += 1;
            }
        });

        return {
            all: drivers.length,
            available,
            started,
        };
    }, [drivers, driverUsageMetaMap]);

    const truckCounters = useMemo(() => {
        let available = 0;
        let started = 0;

        trucks.forEach((truck) => {
            const status = truckUsageMetaMap.get(truck.id)?.status ?? 'available';

            if (status === 'available') {
                available += 1;
            }

            if (status === 'started') {
                started += 1;
            }
        });

        return {
            all: trucks.length,
            available,
            started,
        };
    }, [trucks, truckUsageMetaMap]);

    const summaryCards = useMemo(() => {
        const summary = data?.summary;

        if (!summary) {
            return [] as Array<{ label: string; value: string }>;
        }

        return [
            {
                label: 'Viagens no dia',
                value: formatIntegerBR(summary.trips_total),
            },
            {
                label: 'Viagens escaladas',
                value: formatIntegerBR(summary.trips_assigned ?? 0),
            },
            {
                label: 'Viagens sem escala completa',
                value: formatIntegerBR(summary.trips_unassigned),
            },
            {
                label: 'Motoristas disponíveis',
                value: formatIntegerBR(driverCounters.available),
            },
            {
                label: 'Alertas interjornada',
                value: formatIntegerBR(summary.interjornada_alerts ?? 0),
            },
            {
                label: 'Saida no dia anterior',
                value: formatIntegerBR(summary.trips_previous_day_start ?? 0),
            },
            {
                label: 'Motoristas em carga alta',
                value: formatIntegerBR(summary.overloaded_drivers_count ?? 0),
            },
        ];
    }, [data, driverCounters.available]);

    async function loadDashboard(unitId: string, date: string, keepLoading = false): Promise<void> {
        const requestId = dashboardRequestSeqRef.current + 1;
        dashboardRequestSeqRef.current = requestId;

        if (!keepLoading) {
            setLoading(true);
        }

        if (requestId === dashboardRequestSeqRef.current) {
            setError(null);
        }

        const params = new URLSearchParams();

        if (unitId !== '') {
            params.set('unidade_id', unitId);
        }

        if (date !== '') {
            params.set('data', date);
        }

        const path =
            params.toString() === ''
                ? '/programming/dashboard'
                : `/programming/dashboard?${params.toString()}`;

        try {
            const response = await apiGet<ProgrammingDashboardResponse>(path);

            if (requestId !== dashboardRequestSeqRef.current) {
                return;
            }

            const draft: Record<number, AssignmentDraft> = {};
            const driverInputs: Record<number, string> = {};
            const truckInputs: Record<number, string> = {};
            const signatures: Record<number, string> = {};

            response.trips.forEach((trip) => {
                const draftItem: AssignmentDraft = {
                    colaborador_id: trip.escala ? String(trip.escala.colaborador_id) : 'none',
                    placa_frota_id: trip.escala ? String(trip.escala.placa_frota_id) : 'none',
                    hora_inicio_prevista: trip.hora_inicio_prevista ?? '',
                    hora_carregamento_prevista: trip.hora_carregamento_prevista ?? '',
                    hora_fim_prevista: trip.hora_fim_prevista ?? '',
                };

                draft[trip.id] = draftItem;
                driverInputs[trip.id] = trip.escala?.colaborador_nome ?? '';
                truckInputs[trip.id] = trip.escala?.placa ?? '';
                signatures[trip.id] = buildDraftSignature(draftItem);
            });

            lastSavedSignatureRef.current = signatures;
            setData(response);
            setAssignmentDraft(draft);
            setDriverInputByTrip(driverInputs);
            setTruckInputByTrip(truckInputs);
            setTripSaveErrors({});
            setAutoSavingTripIds({});
            setAutoSavedAtByTrip({});

            const resolvedUnit = response.filters.unidade_id
                ? String(response.filters.unidade_id)
                : '';

            if (resolvedUnit !== selectedUnitId) {
                setSelectedUnitId(resolvedUnit);
            }

            if (response.filters.data !== selectedDate) {
                setSelectedDate(response.filters.data);
            }
        } catch (loadError) {
            if (requestId !== dashboardRequestSeqRef.current) {
                return;
            }

            setError(getErrorMessage(loadError, 'Não foi possível carregar o painel de programação.'));
        } finally {
            if (requestId === dashboardRequestSeqRef.current) {
                setLoading(false);
            }
        }
    }

    useEffect(() => {
        void loadDashboard('', selectedDate);
    }, []);

    async function handleUnitChange(value: string): Promise<void> {
        setSelectedUnitId(value);
        await loadDashboard(value, selectedDate);
    }

    async function handleDateChange(value: string): Promise<void> {
        setSelectedDate(value);

        if (value !== '') {
            await loadDashboard(selectedUnitId, value);
        }
    }

    function updateTripDraft(
        tripId: number,
        updater: (current: AssignmentDraft) => AssignmentDraft,
    ): void {
        setAssignmentDraft((previous) => {
            const current =
                previous[tripId] ??
                {
                    colaborador_id: 'none',
                    placa_frota_id: 'none',
                    hora_inicio_prevista: '',
                    hora_carregamento_prevista: '',
                    hora_fim_prevista: '',
                };

            return {
                ...previous,
                [tripId]: updater(current),
            };
        });
    }

    function setTripDriver(tripId: number, driverId: string, driverName: string): void {
        updateTripDraft(tripId, (current) => ({
            ...current,
            colaborador_id: driverId,
        }));

        setDriverInputByTrip((previous) => ({
            ...previous,
            [tripId]: driverName,
        }));

        setTripSaveErrors((previous) => {
            const next = { ...previous };
            delete next[tripId];
            return next;
        });

        queueAutoSaveTrip(tripId);
    }

    function setTripTruck(tripId: number, truckId: string, plate: string): void {
        updateTripDraft(tripId, (current) => ({
            ...current,
            placa_frota_id: truckId,
        }));

        setTruckInputByTrip((previous) => ({
            ...previous,
            [tripId]: plate,
        }));

        setTripSaveErrors((previous) => {
            const next = { ...previous };
            delete next[tripId];
            return next;
        });

        queueAutoSaveTrip(tripId);
    }

    function queueAutoSaveTrip(tripId: number): void {
        const previousTimeout = autoSaveTimersRef.current[tripId];

        if (previousTimeout) {
            window.clearTimeout(previousTimeout);
        }

        autoSaveTimersRef.current[tripId] = window.setTimeout(() => {
            void persistTripScale(tripId);
        }, 180);
    }

    async function persistTripScale(tripId: number): Promise<void> {
        const trip = tripsRef.current.find((item) => item.id === tripId);
        const draft = assignmentDraftRef.current[tripId];

        if (!trip || !draft || !hasRequiredAssignment(draft)) {
            return;
        }

        const signature = buildDraftSignature(draft);

        if (lastSavedSignatureRef.current[tripId] === signature) {
            return;
        }

        setAutoSavingTripIds((previous) => ({
            ...previous,
            [tripId]: true,
        }));

        try {
            const response = await apiPost<{
                message: string;
                data: {
                    id: number;
                    programacao_viagem_id: number;
                    colaborador_id: number;
                    colaborador_nome: string;
                    placa_frota_id: number;
                    placa: string;
                    hora_inicio_prevista: string | null;
                    hora_carregamento_prevista: string | null;
                    hora_fim_prevista: string | null;
                    observacoes: string | null;
                };
            }>('/programming/assignments', {
                programacao_viagem_id: tripId,
                colaborador_id: Number(draft.colaborador_id),
                placa_frota_id: Number(draft.placa_frota_id),
                hora_inicio_prevista: draft.hora_inicio_prevista || null,
                hora_carregamento_prevista: draft.hora_carregamento_prevista || null,
                hora_fim_prevista: draft.hora_fim_prevista || null,
            });

            lastSavedSignatureRef.current[tripId] = signature;
            setAutoSavedAtByTrip((previous) => ({
                ...previous,
                [tripId]: Date.now(),
            }));

            setTripSaveErrors((previous) => {
                const next = { ...previous };
                delete next[tripId];
                return next;
            });

            setData((previous) => {
                if (!previous) {
                    return previous;
                }

                const nextTrips = previous.trips.map((item) => {
                    if (item.id !== tripId) {
                        return item;
                    }

                    return {
                        ...item,
                        hora_inicio_prevista: response.data.hora_inicio_prevista,
                        hora_carregamento_prevista: response.data.hora_carregamento_prevista,
                        hora_fim_prevista: response.data.hora_fim_prevista,
                        escala: {
                            id: response.data.id,
                            colaborador_id: response.data.colaborador_id,
                            colaborador_nome: response.data.colaborador_nome,
                            placa_frota_id: response.data.placa_frota_id,
                            placa: response.data.placa,
                            observacoes: response.data.observacoes,
                        },
                    } satisfies TripItem;
                });

                return {
                    ...previous,
                    trips: nextTrips,
                };
            });
        } catch (saveError) {
            const message = getErrorMessage(saveError, 'Não foi possível salvar a escala automaticamente.');

            setTripSaveErrors((previous) => ({
                ...previous,
                [tripId]: message,
            }));
        } finally {
            setAutoSavingTripIds((previous) => {
                const next = { ...previous };
                delete next[tripId];
                return next;
            });
        }
    }

    function handleDragStart(payload: DragPayload, event: React.DragEvent<HTMLDivElement>): void {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', `${payload.type}:${payload.id}`);
        setDragging(payload);
    }

    function handleDragOverTrip(
        event: React.DragEvent<HTMLDivElement>,
        expectedType: DragType,
        tripId: number,
    ): void {
        if (!dragging || dragging.type !== expectedType) {
            return;
        }

        event.preventDefault();
        setDragOverZone(`${expectedType}:${tripId}`);
    }

    function handleDropOnTrip(
        event: React.DragEvent<HTMLDivElement>,
        expectedType: DragType,
        tripId: number,
    ): void {
        event.preventDefault();

        const payload =
            parseDropPayload(event.dataTransfer.getData('text/plain')) ?? dragging;

        if (!payload || payload.type !== expectedType) {
            setDragOverZone(null);
            return;
        }

        if (payload.type === 'driver') {
            const driver = driversById.get(payload.id);

            if (driver) {
                setTripDriver(tripId, String(driver.id), driver.nome);
            }
        }

        if (payload.type === 'truck') {
            const truck = trucksById.get(payload.id);

            if (truck) {
                setTripTruck(tripId, String(truck.id), truck.placa);
            }
        }

        setDragOverZone(null);
        setDragging(null);
    }

    async function handlePreviewImport(): Promise<void> {
        if (!importFile) {
            setNotice({
                message: 'Selecione um arquivo XLSX para importar a base.',
                variant: 'error',
            });
            return;
        }

        if (selectedUnitId === '') {
            setNotice({
                message: 'Selecione a unidade antes de importar o XLSX.',
                variant: 'error',
            });
            return;
        }

        setPreviewing(true);

        const formData = new FormData();
        formData.append('file', importFile);
        formData.append('unidade_id', selectedUnitId);

        try {
            const response = await apiPost<ImportPreviewResponse>('/programming/import-base-preview', formData);

            setImportPreview(response);

            if (response.total_validas <= 0) {
                const ignored = response.total_ignoradas ?? 0;
                setNotice({
                    message: `Nenhuma linha válida encontrada. Lidas: ${response.total_lidas}. Ignoradas: ${ignored}. Erros: ${response.total_erros}.`,
                    variant: 'error',
                });
            } else {
                setNotice({
                    message: `Pré-visualização pronta. Linhas válidas: ${response.total_validas}. Clique em Salvar tabela do dia para confirmar.`,
                    variant: 'info',
                });
            }
        } catch (importError) {
            setNotice({
                message: getErrorMessage(importError, 'Não foi possível ler a planilha de programação.'),
                variant: 'error',
            });
            setImportPreview(null);
        } finally {
            setPreviewing(false);
        }
    }

    async function handleImportBase(): Promise<void> {
        if (!importFile) {
            setNotice({
                message: 'Selecione um arquivo XLSX para importar a base.',
                variant: 'error',
            });
            return;
        }

        if (selectedUnitId === '') {
            setNotice({
                message: 'Selecione a unidade antes de importar o XLSX.',
                variant: 'error',
            });
            return;
        }

        if (!importPreview || importPreview.total_validas <= 0) {
            setNotice({
                message: 'Primeiro clique em Ler XLSX e valide se existem linhas válidas para importar.',
                variant: 'error',
            });
            return;
        }

        setImporting(true);

        const formData = new FormData();
        formData.append('file', importFile);
        formData.append('unidade_id', selectedUnitId);

        try {
            const response = await apiPost<{
                message: string;
                total_criadas: number;
                total_atualizadas: number;
                total_erros: number;
                data_sugerida?: string | null;
                datas_importadas?: string[];
            }>('/programming/import-base', formData);

            setNotice({
                message: `${response.message} Criadas: ${response.total_criadas}. Atualizadas: ${response.total_atualizadas}. Erros: ${response.total_erros}.`,
                variant: 'success',
            });

            setImportFile(null);

            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            setImportPreview(null);

            const importedDate = response.data_sugerida && response.data_sugerida !== ''
                ? response.data_sugerida
                : selectedDate;

            if (importedDate !== selectedDate) {
                setSelectedDate(importedDate);
            }

            await loadDashboard(selectedUnitId, importedDate, true);
        } catch (importError) {
            setNotice({
                message: getErrorMessage(importError, 'Não foi possível importar a planilha de programação.'),
                variant: 'error',
            });
        } finally {
            setImporting(false);
        }
    }

    async function handleClearDayTable(): Promise<void> {
        if (selectedUnitId === '' || selectedDate === '') {
            setNotice({
                message: 'Selecione unidade e data para limpar a tabela do dia.',
                variant: 'error',
            });
            return;
        }

        setClearingDay(true);

        try {
            const response = await apiPost<{
                message: string;
                total_removidas: number;
            }>('/programming/clear-day-table', {
                unidade_id: Number(selectedUnitId),
                data: selectedDate,
            });

            setNotice({
                message: `${response.message} Removidas: ${formatIntegerBR(response.total_removidas)}.`,
                variant: 'success',
            });

            setClearConfirmOpen(false);
            await loadDashboard(selectedUnitId, selectedDate, true);
        } catch (clearError) {
            setNotice({
                message: getErrorMessage(clearError, 'Não foi possível limpar a tabela do dia.'),
                variant: 'error',
            });
        } finally {
            setClearingDay(false);
        }
    }

    function bringPanelToFront(panel: FloatingPanelKey): void {
        setPanelStates((previous) => {
            const maxZ = Math.max(previous.drivers.z, previous.trucks.z) + 1;

            return {
                ...previous,
                [panel]: {
                    ...previous[panel],
                    z: maxZ,
                },
            };
        });
    }

    function startPanelDrag(panel: FloatingPanelKey, event: React.MouseEvent<HTMLDivElement>): void {
        if (!isDesktop) {
            return;
        }

        const workspace = workspaceRef.current;

        if (!workspace) {
            return;
        }

        const workspaceRect = workspace.getBoundingClientRect();
        const panelState = panelStates[panel];

        bringPanelToFront(panel);

        setDragPanelState({
            panel,
            offsetX: event.clientX - workspaceRect.left - panelState.x,
            offsetY: event.clientY - workspaceRect.top - panelState.y,
        });
    }

    function syncPanelSize(panel: FloatingPanelKey): void {
        if (!isDesktop) {
            return;
        }

        const element = panelRefs.current[panel];
        const workspace = workspaceRef.current;

        if (!element || !workspace) {
            return;
        }

        const workspaceRect = workspace.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);

        setPanelStates((previous) => {
            const current = previous[panel];

            return {
                ...previous,
                [panel]: {
                    ...current,
                    width,
                    height,
                    x: clamp(current.x, 0, Math.max(0, workspaceRect.width - width)),
                    y: clamp(current.y, 0, Math.max(0, workspaceRect.height - 80)),
                },
            };
        });
    }

    function focusDriverInputByOffset(currentTripId: number, offset: number): void {
        const currentIndex = orderedTripIds.indexOf(currentTripId);

        if (currentIndex < 0) {
            return;
        }

        const nextIndex = clamp(currentIndex + offset, 0, orderedTripIds.length - 1);
        const targetTripId = orderedTripIds[nextIndex];

        window.setTimeout(() => {
            driverInputRefs.current[targetTripId]?.focus();
            driverInputRefs.current[targetTripId]?.select();
        }, 0);
    }

    function focusTruckInputByOffset(currentTripId: number, offset: number): void {
        const currentIndex = orderedTripIds.indexOf(currentTripId);

        if (currentIndex < 0) {
            return;
        }

        const nextIndex = clamp(currentIndex + offset, 0, orderedTripIds.length - 1);
        const targetTripId = orderedTripIds[nextIndex];

        window.setTimeout(() => {
            truckInputRefs.current[targetTripId]?.focus();
            truckInputRefs.current[targetTripId]?.select();
        }, 0);
    }

    function applyDriverTextToTrip(tripId: number, rawValue: string): void {
        const value = rawValue.trim();

        if (value === '') {
            const draft = assignmentDraftRef.current[tripId];
            const driverId = Number(draft?.colaborador_id ?? 0);
            const selected = driversById.get(driverId);

            setDriverInputByTrip((previous) => ({
                ...previous,
                [tripId]: selected?.nome ?? '',
            }));

            return;
        }

        const matched = findBestDriverMatch(value, drivers);

        if (!matched) {
            setTripSaveErrors((previous) => ({
                ...previous,
                [tripId]: `Motorista não encontrado: ${value}`,
            }));
            return;
        }

        setTripDriver(tripId, String(matched.id), matched.nome);
    }

    function applyTruckTextToTrip(tripId: number, rawValue: string): void {
        const value = rawValue.trim();

        if (value === '') {
            const draft = assignmentDraftRef.current[tripId];
            const truckId = Number(draft?.placa_frota_id ?? 0);
            const selected = trucksById.get(truckId);

            setTruckInputByTrip((previous) => ({
                ...previous,
                [tripId]: selected?.placa ?? '',
            }));

            return;
        }

        const matched = findBestTruckMatch(value, trucks);

        if (!matched) {
            setTripSaveErrors((previous) => ({
                ...previous,
                [tripId]: `Caminhão não encontrado: ${value}`,
            }));
            return;
        }

        setTripTruck(tripId, String(matched.id), matched.placa);
    }

    const driversPanelBody = (
        <>
            <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={driverQuery}
                    onChange={(event) => setDriverQuery(event.target.value)}
                    placeholder="Filtrar motorista"
                    className="h-8 pl-8"
                />
            </div>

            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant={driverFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setDriverFilter('all')}
                    className="h-7 text-xs"
                >
                    Todos ({formatIntegerBR(driverCounters.all)})
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={driverFilter === 'available' ? 'default' : 'outline'}
                    onClick={() => setDriverFilter('available')}
                    className="h-7 text-xs"
                >
                    Disponíveis ({formatIntegerBR(driverCounters.available)})
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={driverFilter === 'started' ? 'default' : 'outline'}
                    onClick={() => setDriverFilter('started')}
                    className="h-7 text-xs"
                >
                    Iniciadas ({formatIntegerBR(driverCounters.started)})
                </Button>
            </div>

            <div className="space-y-1 overflow-auto pr-1 text-xs" style={{ maxHeight: isDesktop ? 'calc(100% - 96px)' : '420px' }}>
                {filteredDrivers.length === 0 ? (
                    <p className="py-4 text-center text-muted-foreground">Nenhum motorista encontrado.</p>
                ) : (
                    filteredDrivers.map((driver) => {
                        const usage = driverUsageMetaMap.get(driver.id);
                        const status = usage?.status ?? 'available';

                        return (
                            <div
                                key={driver.id}
                                draggable
                                onDragStart={(event) =>
                                    handleDragStart({ type: 'driver', id: driver.id }, event)
                                }
                                onDragEnd={() => {
                                    setDragging(null);
                                    setDragOverZone(null);
                                }}
                                className="cursor-grab rounded-md border px-2 py-1.5 active:cursor-grabbing"
                                title="Clique e arraste"
                            >
                                <div className="mb-1 flex items-start justify-between gap-2">
                                    <p className="truncate text-[13px] font-semibold">{driver.nome}</p>
                                    <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                </div>

                                <p className="text-[11px] text-muted-foreground">{driver.funcao_nome}</p>

                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <Badge className={statusBadgeClass(status)}>{statusLabel(status)}</Badge>
                                    <span className="text-[11px] text-muted-foreground">
                                        {formatDecimalBR(usage?.totalHours ?? 0, 2)} h • {formatIntegerBR(usage?.assignedCount ?? 0)} viag.
                                    </span>
                                </div>

                                {usage && usage.labels.length > 0 ? (
                                    <p className="mt-1 truncate text-[10px] text-muted-foreground">
                                        {usage.labels.join(', ')}
                                    </p>
                                ) : null}
                            </div>
                        );
                    })
                )}
            </div>
        </>
    );

    const trucksPanelBody = (
        <>
            <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={truckQuery}
                    onChange={(event) => setTruckQuery(event.target.value)}
                    placeholder="Filtrar caminhão"
                    className="h-8 pl-8"
                />
            </div>

            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant={truckFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setTruckFilter('all')}
                    className="h-7 text-xs"
                >
                    Todos ({formatIntegerBR(truckCounters.all)})
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={truckFilter === 'available' ? 'default' : 'outline'}
                    onClick={() => setTruckFilter('available')}
                    className="h-7 text-xs"
                >
                    Disponíveis ({formatIntegerBR(truckCounters.available)})
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={truckFilter === 'started' ? 'default' : 'outline'}
                    onClick={() => setTruckFilter('started')}
                    className="h-7 text-xs"
                >
                    Iniciadas ({formatIntegerBR(truckCounters.started)})
                </Button>
            </div>

            <div className="space-y-1 overflow-auto pr-1 text-xs" style={{ maxHeight: isDesktop ? 'calc(100% - 96px)' : '320px' }}>
                {filteredTrucks.length === 0 ? (
                    <p className="py-4 text-center text-muted-foreground">Nenhum caminhão encontrado.</p>
                ) : (
                    filteredTrucks.map((truck) => {
                        const usage = truckUsageMetaMap.get(truck.id);
                        const status = usage?.status ?? 'available';

                        return (
                            <div
                                key={truck.id}
                                draggable
                                onDragStart={(event) =>
                                    handleDragStart({ type: 'truck', id: truck.id }, event)
                                }
                                onDragEnd={() => {
                                    setDragging(null);
                                    setDragOverZone(null);
                                }}
                                className="cursor-grab rounded-md border px-2 py-1.5 active:cursor-grabbing"
                                title="Clique e arraste"
                            >
                                <div className="mb-1 flex items-start justify-between gap-2">
                                    <p className="truncate text-[13px] font-semibold">{truck.placa}</p>
                                    <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <Badge className={statusBadgeClass(status)}>{statusLabel(status)}</Badge>
                                    <span className="text-[11px] text-muted-foreground">
                                        {formatIntegerBR(usage?.assignedCount ?? 0)} viag.
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </>
    );

    return (
        <AdminLayout title="Programação - Dashboard" active="programming-dashboard" module="programming">
            <div className="space-y-4">
                <div>
                    <h2 className="text-2xl font-semibold">Programação de Viagens</h2>
                    <p className="text-sm text-muted-foreground">
                        Visão operacional em modo planilha com autosave e navegação por teclado.
                    </p>
                </div>

                {error ? <Notification message={error} variant="error" /> : null}
                {notice ? (
                    <Notification
                        message={notice.message}
                        variant={notice.variant}
                        onClose={() => setNotice(null)}
                    />
                ) : null}

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Filtros e importação da base (XLSX)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid gap-3 lg:grid-cols-3">
                            <div>
                                <p className="mb-1.5 text-xs text-muted-foreground">Unidade</p>
                                <Select value={selectedUnitId} onValueChange={(value) => void handleUnitChange(value)}>
                                    <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Selecione uma unidade" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {units.map((unit) => (
                                            <SelectItem key={unit.id} value={String(unit.id)}>
                                                {unit.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <p className="mb-1.5 text-xs text-muted-foreground">Data</p>
                                <Input
                                    type="date"
                                    className="h-8"
                                    value={selectedDate}
                                    onChange={(event) => {
                                        void handleDateChange(event.target.value);
                                    }}
                                />
                            </div>

                            <div>
                                <p className="mb-1.5 text-xs text-muted-foreground">Arquivo XLSX</p>
                                <div className="flex flex-wrap gap-2">
                                    <Input
                                        ref={fileInputRef}
                                        type="file"
                                        className="h-8"
                                        accept=".xlsx"
                                        onChange={(event) => {
                                            const nextFile = event.target.files?.[0] ?? null;
                                            setImportFile(nextFile);
                                            setImportPreview(null);
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => void handlePreviewImport()}
                                        disabled={previewing}
                                        className="h-8"
                                    >
                                        {previewing ? (
                                            <LoaderCircle className="size-4 animate-spin" />
                                        ) : (
                                            <FileSpreadsheet className="size-4" />
                                        )}
                                        Ler XLSX
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => void handleImportBase()}
                                        disabled={importing || !importPreview || importPreview.total_validas <= 0}
                                        className="h-8"
                                    >
                                        {importing ? (
                                            <LoaderCircle className="size-4 animate-spin" />
                                        ) : (
                                            <CheckCircle2 className="size-4" />
                                        )}
                                        Salvar tabela do dia
                                    </Button>
                                </div>
                                {importPreview ? (
                                    <p className="mt-2 text-[11px] text-muted-foreground">
                                        Lidas: {formatIntegerBR(importPreview.total_lidas)} • Válidas: {formatIntegerBR(importPreview.total_validas)} • Ignoradas: {formatIntegerBR(importPreview.total_ignoradas ?? 0)} • Erros: {formatIntegerBR(importPreview.total_erros)}
                                    </p>
                                ) : null}

                                <div className="mt-3 flex justify-end">
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => setClearConfirmOpen(true)}
                                        disabled={clearingDay || loading || selectedUnitId === '' || selectedDate === ''}
                                        className="h-8"
                                    >
                                        Limpar tabela do dia
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {summaryCards.length > 0 ? (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Indicadores do dia
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
                            {summaryCards.map((item) => (
                                <Card key={item.label} className="border-border/80">
                                    <CardContent className="space-y-0.5 py-3">
                                        <p className="text-[11px] text-muted-foreground">{item.label}</p>
                                        <p className="text-xl font-semibold leading-tight">{item.value}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                ) : null}

                {data?.operation_alerts?.length ? (
                    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Leituras operacionais</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {data.operation_alerts.map((alert, index) => (
                                    <div key={`${alert.title}-${index}`} className="rounded-md border p-3 text-sm">
                                        <p className="font-medium">{alert.title}</p>
                                        <p className="text-xs text-muted-foreground">{alert.detail}</p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Motoristas para revisar</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {(data.driver_overload ?? []).length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sem revisões pendentes por jornada.</p>
                                ) : (
                                    (data.driver_overload ?? []).map((driver) => (
                                        <div key={driver.id} className="rounded-md border p-3 text-sm">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="font-medium">{driver.nome}</p>
                                                <p className="text-xs text-muted-foreground">{formatDecimalBR(driver.horas_trabalhadas_dia)} h</p>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {driver.funcao_nome} • extra {formatDecimalBR(driver.horas_extra_dia)} h
                                            </p>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>
                ) : null}

                <div ref={workspaceRef} className="relative min-h-[860px]">
                    <div className={isDesktop ? 'pl-[360px]' : ''}>
                        {!isDesktop ? (
                            <div className="mb-4 space-y-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-sm">
                                            <Users className="size-4" />
                                            Motoristas
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">{driversPanelBody}</CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-sm">
                                            <Truck className="size-4" />
                                            Caminhões
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">{trucksPanelBody}</CardContent>
                                </Card>
                            </div>
                        ) : null}

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-sm">
                                    <CalendarDays className="size-4" />
                                    Tabela de Viagens (modo planilha)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {loading ? (
                                    <div className="flex items-center gap-2 py-10 px-4 text-sm text-muted-foreground">
                                        <LoaderCircle className="size-4 animate-spin" />
                                        Carregando programação...
                                    </div>
                                ) : trips.length === 0 ? (
                                    <p className="py-10 px-4 text-sm text-muted-foreground">
                                        Nenhuma viagem cadastrada para os filtros selecionados.
                                    </p>
                                ) : (
                                    <div className="overflow-auto rounded-md border-t">
                                        <table className="w-full min-w-[1180px] border-collapse text-[11px]">
                                            <thead className="bg-muted/70 text-[10px] uppercase tracking-wide text-muted-foreground">
                                                <tr>
                                                    <th className="w-10 border-b border-r px-1.5 py-1 text-center">#</th>
                                                    <th className="border-b border-r px-1.5 py-1 text-left">Rota</th>
                                                    <th className="w-[90px] border-b border-r px-1.5 py-1 text-left">Carga</th>
                                                    <th className="w-[88px] border-b border-r px-1.5 py-1 text-left">Saída</th>
                                                    <th className="w-[88px] border-b border-r px-1.5 py-1 text-left">Carreg.</th>
                                                    <th className="w-[88px] border-b border-r px-1.5 py-1 text-left">Chegada</th>
                                                    <th className="w-[230px] border-b border-r px-1.5 py-1 text-left">Motorista</th>
                                                    <th className="w-[200px] border-b border-r px-1.5 py-1 text-left">Caminhão</th>
                                                    <th className="w-[170px] border-b px-1.5 py-1 text-left">Sync</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {trips.map((trip, index) => {
                                                    const draft =
                                                        assignmentDraft[trip.id] ??
                                                        ({
                                                            colaborador_id: trip.escala
                                                                ? String(trip.escala.colaborador_id)
                                                                : 'none',
                                                            placa_frota_id: trip.escala
                                                                ? String(trip.escala.placa_frota_id)
                                                                : 'none',
                                                            hora_inicio_prevista:
                                                                trip.hora_inicio_prevista ?? '',
                                                            hora_carregamento_prevista:
                                                                trip.hora_carregamento_prevista ?? '',
                                                            hora_fim_prevista: trip.hora_fim_prevista ?? '',
                                                        } satisfies AssignmentDraft);

                                                    const tripOrder = trip.ordem_no_dia && trip.ordem_no_dia > 0
                                                        ? trip.ordem_no_dia
                                                        : index + 1;
                                                    const driverDropKey = `driver:${trip.id}`;
                                                    const truckDropKey = `truck:${trip.id}`;
                                                    const isDriverDropOver = dragOverZone === driverDropKey;
                                                    const isTruckDropOver = dragOverZone === truckDropKey;
                                                    const autoSaving = Boolean(autoSavingTripIds[trip.id]);
                                                    const autoSavedAt = autoSavedAtByTrip[trip.id];
                                                    const saveError = tripSaveErrors[trip.id];

                                                    return (
                                                        <tr
                                                            key={trip.id}
                                                            className={`border-b align-middle ${
                                                                index % 2 === 0 ? 'bg-background' : 'bg-muted/15'
                                                            } hover:bg-muted/25`}
                                                        >
                                                            <td className="border-r px-1.5 py-1 text-center">
                                                                <div className="flex flex-col items-center gap-0.5">
                                                                    <span className="inline-flex min-w-5 items-center justify-center rounded bg-muted px-1 py-0.5 text-[10px] font-semibold">
                                                                        {tripOrder}
                                                                    </span>
                                                                    {trip.saida_dia_anterior ? (
                                                                        <span className="rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-800">D-1</span>
                                                                    ) : null}
                                                                </div>
                                                            </td>

                                                            <td className="border-r px-1.5 py-1 leading-tight">
                                                                <p className="truncate font-semibold">{trip.aviario ?? '-'}</p>
                                                                <p className="truncate text-[10px] text-muted-foreground">{trip.cidade ?? '-'}</p>
                                                                <p className="text-[10px] text-muted-foreground">{formatDecimalBR(trip.distancia_km, 0)} km</p>
                                                            </td>

                                                            <td className="border-r px-1.5 py-1">
                                                                <span className="truncate">{trip.numero_carga ?? '-'}</span>
                                                            </td>

                                                            <td className="border-r px-1.5 py-1">
                                                                <Input
                                                                    type="time"
                                                                    className="h-6 px-1 text-[11px]"
                                                                    value={draft.hora_inicio_prevista}
                                                                    onChange={(event) => {
                                                                        updateTripDraft(trip.id, (current) => ({
                                                                            ...current,
                                                                            hora_inicio_prevista: event.target.value,
                                                                        }));
                                                                    }}
                                                                    onBlur={() => queueAutoSaveTrip(trip.id)}
                                                                />
                                                            </td>

                                                            <td className="border-r px-1.5 py-1">
                                                                <Input
                                                                    type="time"
                                                                    className="h-6 px-1 text-[11px]"
                                                                    value={draft.hora_carregamento_prevista}
                                                                    onChange={(event) => {
                                                                        updateTripDraft(trip.id, (current) => ({
                                                                            ...current,
                                                                            hora_carregamento_prevista: event.target.value,
                                                                        }));
                                                                    }}
                                                                    onBlur={() => queueAutoSaveTrip(trip.id)}
                                                                />
                                                            </td>

                                                            <td className="border-r px-1.5 py-1">
                                                                <Input
                                                                    type="time"
                                                                    className="h-6 px-1 text-[11px]"
                                                                    value={draft.hora_fim_prevista}
                                                                    onChange={(event) => {
                                                                        updateTripDraft(trip.id, (current) => ({
                                                                            ...current,
                                                                            hora_fim_prevista: event.target.value,
                                                                        }));
                                                                    }}
                                                                    onBlur={() => queueAutoSaveTrip(trip.id)}
                                                                />
                                                            </td>

                                                            <td className="border-r px-1.5 py-1">
                                                                <div
                                                                    onDragOver={(event) => handleDragOverTrip(event, 'driver', trip.id)}
                                                                    onDragLeave={() => setDragOverZone(null)}
                                                                    onDrop={(event) => handleDropOnTrip(event, 'driver', trip.id)}
                                                                    className={`rounded-sm border px-1 py-0.5 ${
                                                                        isDriverDropOver ? 'border-primary bg-primary/10' : 'border-border'
                                                                    }`}
                                                                >
                                                                    <Input
                                                                        ref={(element) => {
                                                                            driverInputRefs.current[trip.id] = element;
                                                                        }}
                                                                        list="programming-driver-options"
                                                                        className="h-6 border-0 px-0 text-[11px] shadow-none focus-visible:ring-0"
                                                                        placeholder="Digite nome (ex: Adai)"
                                                                        value={driverInputByTrip[trip.id] ?? ''}
                                                                        onChange={(event) => {
                                                                            const value = event.target.value;
                                                                            setDriverInputByTrip((previous) => ({
                                                                                ...previous,
                                                                                [trip.id]: value,
                                                                            }));
                                                                        }}
                                                                        onBlur={(event) => {
                                                                            applyDriverTextToTrip(trip.id, event.target.value);
                                                                        }}
                                                                        onKeyDown={(event) => {
                                                                            if (event.key === 'Enter') {
                                                                                event.preventDefault();
                                                                                applyDriverTextToTrip(trip.id, event.currentTarget.value);
                                                                                focusDriverInputByOffset(trip.id, 1);
                                                                                return;
                                                                            }

                                                                            if (event.key === 'ArrowDown') {
                                                                                event.preventDefault();
                                                                                applyDriverTextToTrip(trip.id, event.currentTarget.value);
                                                                                focusDriverInputByOffset(trip.id, 1);
                                                                                return;
                                                                            }

                                                                            if (event.key === 'ArrowUp') {
                                                                                event.preventDefault();
                                                                                applyDriverTextToTrip(trip.id, event.currentTarget.value);
                                                                                focusDriverInputByOffset(trip.id, -1);
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>
                                                                {trip.interjornada_alert?.is_violated ? (
                                                                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-destructive">
                                                                        <AlertTriangle className="size-3" />
                                                                        {trip.interjornada_alert.mensagem}
                                                                    </p>
                                                                ) : null}
                                                            </td>

                                                            <td className="border-r px-1.5 py-1">
                                                                <div
                                                                    onDragOver={(event) => handleDragOverTrip(event, 'truck', trip.id)}
                                                                    onDragLeave={() => setDragOverZone(null)}
                                                                    onDrop={(event) => handleDropOnTrip(event, 'truck', trip.id)}
                                                                    className={`rounded-sm border px-1 py-0.5 ${
                                                                        isTruckDropOver ? 'border-primary bg-primary/10' : 'border-border'
                                                                    }`}
                                                                >
                                                                    <Input
                                                                        ref={(element) => {
                                                                            truckInputRefs.current[trip.id] = element;
                                                                        }}
                                                                        list="programming-truck-options"
                                                                        className="h-6 border-0 px-0 text-[11px] shadow-none focus-visible:ring-0"
                                                                        placeholder="Digite placa"
                                                                        value={truckInputByTrip[trip.id] ?? ''}
                                                                        onChange={(event) => {
                                                                            const value = event.target.value;
                                                                            setTruckInputByTrip((previous) => ({
                                                                                ...previous,
                                                                                [trip.id]: value,
                                                                            }));
                                                                        }}
                                                                        onBlur={(event) => {
                                                                            applyTruckTextToTrip(trip.id, event.target.value);
                                                                        }}
                                                                        onKeyDown={(event) => {
                                                                            if (event.key === 'Enter') {
                                                                                event.preventDefault();
                                                                                applyTruckTextToTrip(trip.id, event.currentTarget.value);
                                                                                focusTruckInputByOffset(trip.id, 1);
                                                                                return;
                                                                            }

                                                                            if (event.key === 'ArrowDown') {
                                                                                event.preventDefault();
                                                                                applyTruckTextToTrip(trip.id, event.currentTarget.value);
                                                                                focusTruckInputByOffset(trip.id, 1);
                                                                                return;
                                                                            }

                                                                            if (event.key === 'ArrowUp') {
                                                                                event.preventDefault();
                                                                                applyTruckTextToTrip(trip.id, event.currentTarget.value);
                                                                                focusTruckInputByOffset(trip.id, -1);
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>
                                                            </td>

                                                            <td className="px-1.5 py-1">
                                                                {autoSaving ? (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                                                        <LoaderCircle className="size-3 animate-spin" />
                                                                        Salvando...
                                                                    </span>
                                                                ) : saveError ? (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
                                                                        <AlertTriangle className="size-3" />
                                                                        {saveError}
                                                                    </span>
                                                                ) : autoSavedAt ? (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700">
                                                                        <CheckCircle2 className="size-3" />
                                                                        Auto {new Date(autoSavedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] text-muted-foreground">Aguardando escala completa</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {isDesktop ? (
                        <>
                            <div
                                ref={(element) => {
                                    panelRefs.current.drivers = element;
                                }}
                                onMouseDown={() => bringPanelToFront('drivers')}
                                onMouseUp={() => syncPanelSize('drivers')}
                                className="absolute rounded-lg border bg-background shadow-xl resize overflow-auto"
                                style={{
                                    left: panelStates.drivers.x,
                                    top: panelStates.drivers.y,
                                    width: panelStates.drivers.width,
                                    height: panelStates.drivers.height,
                                    zIndex: panelStates.drivers.z,
                                    minWidth: 290,
                                    minHeight: 260,
                                    maxWidth: 620,
                                    maxHeight: 900,
                                }}
                            >
                                <div
                                    className="cursor-move border-b bg-muted/50 px-3 py-2"
                                    onMouseDown={(event) => startPanelDrag('drivers', event)}
                                >
                                    <p className="flex items-center gap-2 text-sm font-semibold">
                                        <Users className="size-4" />
                                        Motoristas ({formatIntegerBR(filteredDrivers.length)})
                                    </p>
                                </div>
                                <div className="space-y-2 p-3">{driversPanelBody}</div>
                            </div>

                            <div
                                ref={(element) => {
                                    panelRefs.current.trucks = element;
                                }}
                                onMouseDown={() => bringPanelToFront('trucks')}
                                onMouseUp={() => syncPanelSize('trucks')}
                                className="absolute rounded-lg border bg-background shadow-xl resize overflow-auto"
                                style={{
                                    left: panelStates.trucks.x,
                                    top: panelStates.trucks.y,
                                    width: panelStates.trucks.width,
                                    height: panelStates.trucks.height,
                                    zIndex: panelStates.trucks.z,
                                    minWidth: 280,
                                    minHeight: 240,
                                    maxWidth: 620,
                                    maxHeight: 820,
                                }}
                            >
                                <div
                                    className="cursor-move border-b bg-muted/50 px-3 py-2"
                                    onMouseDown={(event) => startPanelDrag('trucks', event)}
                                >
                                    <p className="flex items-center gap-2 text-sm font-semibold">
                                        <Truck className="size-4" />
                                        Caminhões ({formatIntegerBR(filteredTrucks.length)})
                                    </p>
                                </div>
                                <div className="space-y-2 p-3">{trucksPanelBody}</div>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>

            <datalist id="programming-driver-options">
                {drivers.map((driver) => (
                    <option key={driver.id} value={driver.nome} />
                ))}
            </datalist>

            <datalist id="programming-truck-options">
                {trucks.map((truck) => (
                    <option key={truck.id} value={truck.placa} />
                ))}
            </datalist>

            <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="size-5 text-amber-600" />
                            Confirmar limpeza da tabela do dia
                        </DialogTitle>
                        <DialogDescription>
                            Esta ação vai remover todas as viagens da unidade selecionada em <strong>{formatDateBR(selectedDate)}</strong>.
                            Use apenas quando a base do dia tiver sido lançada errado.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Depois da limpeza, você pode importar novamente o XLSX correto do dia.
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setClearConfirmOpen(false)}
                            disabled={clearingDay}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                                void handleClearDayTable();
                            }}
                            disabled={clearingDay}
                        >
                            {clearingDay ? <LoaderCircle className="size-4 animate-spin" /> : null}
                            Confirmar limpeza
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
