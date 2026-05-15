import { LoaderCircle, Printer, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { apiGet } from '@/lib/api-client';
import { formatDateBR } from '@/lib/transport-format';
import type { InterviewCandidateListGroup } from '@/types/driver-interview';

type FilterOption = {
    id: number;
    nome: string;
};

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

function formatInterviewTime(value: string | null | undefined): string {
    if (!value) return '';
    return value.slice(0, 5);
}

function candidateSortTime(
    value: string | null | undefined,
    fallback: string | null | undefined,
): string {
    return (value || fallback || '99:99').slice(0, 5);
}

export default function TransportInterviewCandidateListPage() {
    const [candidateGroups, setCandidateGroups] = useState<
        InterviewCandidateListGroup[]
    >([]);
    const [candidateTotal, setCandidateTotal] = useState(0);
    const [candidateLoading, setCandidateLoading] = useState(false);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search, 350);
    const [functionFilter, setFunctionFilter] = useState('all');
    const [unitFilter, setUnitFilter] = useState('all');
    const [interviewDateFilter, setInterviewDateFilter] = useState('');
    const [unidades, setUnidades] = useState<FilterOption[]>([]);
    const [funcoes, setFuncoes] = useState<FilterOption[]>([]);

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
                const items = group.items
                    .filter((item) => {
                        if (!normalizedSearch) return true;

                        return normalizeText(
                            `${item.full_name} ${item.role_name ?? ''} ${item.unit_name ?? ''} ${item.phone ?? ''}`,
                        ).includes(normalizedSearch);
                    })
                    .sort((first, second) => {
                        const firstTime = candidateSortTime(
                            first.confirmed_interview_time,
                            first.interview_time,
                        );
                        const secondTime = candidateSortTime(
                            second.confirmed_interview_time,
                            second.interview_time,
                        );

                        if (firstTime !== secondTime) {
                            return firstTime.localeCompare(secondTime);
                        }

                        return first.full_name.localeCompare(
                            second.full_name,
                            'pt-BR',
                            { sensitivity: 'base' },
                        );
                    });

                return {
                    ...group,
                    items,
                    total: items.length,
                };
            })
            .filter((group) => group.items.length > 0);
    }, [candidateGroups, debouncedSearch]);

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
                message:
                    'Não foi possível carregar a lista de candidatos convocados.',
                variant: 'error',
            });
        } finally {
            setCandidateLoading(false);
        }
    }

    async function loadOptions(): Promise<void> {
        try {
            const [unidadesResponse, funcoesResponse] = await Promise.all([
                apiGet<{ data: FilterOption[] }>(
                    '/registry/unidades?include_inactive=1',
                ),
                apiGet<{ data: FilterOption[] }>('/registry/funcoes?active=1'),
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

    function clearFilters(): void {
        setSearch('');
        setFunctionFilter('all');
        setUnitFilter('all');
        setInterviewDateFilter('');
    }

    useEffect(() => {
        void loadOptions();
    }, []);

    useEffect(() => {
        void loadCandidateList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [functionFilter, unitFilter, interviewDateFilter]);

    return (
        <AdminLayout title="Lista de candidatos" active="candidate-list">
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold">
                            Lista de candidatos
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Veja apenas candidatos convocados, agrupados por
                            data de entrevista.
                        </p>
                    </div>
                    <div className="flex gap-2 print:hidden">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => window.print()}
                        >
                            <Printer className="size-4" />
                            Imprimir lista
                        </Button>
                    </div>
                </div>

                {notification ? (
                    <Notification
                        message={notification.message}
                        variant={notification.variant}
                    />
                ) : null}

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
                    <Select
                        value={functionFilter}
                        onValueChange={setFunctionFilter}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Todas as funções" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                Todas as funções
                            </SelectItem>
                            {roleNames.map((roleName) => (
                                <SelectItem
                                    key={`filter-role-${roleName}`}
                                    value={roleName}
                                >
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
                            <SelectItem value="all">
                                Todas as unidades
                            </SelectItem>
                            {unitNames.map((unitName) => (
                                <SelectItem
                                    key={`filter-unit-${unitName}`}
                                    value={unitName}
                                >
                                    {unitName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        type="date"
                        value={interviewDateFilter}
                        onChange={(event) =>
                            setInterviewDateFilter(event.target.value)
                        }
                        placeholder="Data da entrevista"
                    />
                </div>

                <div className="flex flex-wrap gap-2 print:hidden">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={clearFilters}
                    >
                        Limpar filtros
                    </Button>
                </div>

                <div className="hidden print:block">
                    <div className="flex items-center gap-3 border-b pb-3">
                        <img
                            src="/logo/kaiquesemfundo.png"
                            alt="Kaique"
                            className="h-10 w-10 object-contain"
                            loading="eager"
                            decoding="async"
                        />
                        <div>
                            <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                Kaique Transportes
                            </p>
                            <h1 className="text-lg font-semibold">
                                Lista de Candidatos para Entrevista
                            </h1>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border bg-muted/10 px-4 py-3 text-sm">
                    <strong className="font-semibold">
                        Lista de Candidatos para Entrevista
                    </strong>
                    <p className="text-muted-foreground">
                        Total filtrado:{' '}
                        {candidateLoading ? '...' : candidateTotal}{' '}
                        candidato(s).
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
                    <div className="space-y-4">
                        {filteredCandidateGroups.map((group) => (
                            <div
                                key={group.interview_date}
                                className="rounded-lg border"
                            >
                                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                                    <h3 className="font-semibold">
                                        Lista de{' '}
                                        {formatDateBR(group.interview_date)}
                                    </h3>
                                    <Badge variant="secondary">
                                        {group.total} candidato(s)
                                    </Badge>
                                </div>
                                <div className="overflow-x-auto print:overflow-visible">
                                    <table className="w-full text-sm print:table-fixed print:text-[11px]">
                                        <thead className="bg-muted/20">
                                            <tr>
                                                <th className="w-[28%] px-3 py-2 text-left font-medium print:px-2">
                                                    Nome
                                                </th>
                                                <th className="w-[16%] px-3 py-2 text-left font-medium print:px-2">
                                                    Função
                                                </th>
                                                <th className="w-[16%] px-3 py-2 text-left font-medium print:px-2">
                                                    Unidade
                                                </th>
                                                <th className="w-[16%] px-3 py-2 text-left font-medium print:px-2">
                                                    Telefone
                                                </th>
                                                <th className="w-[12%] px-3 py-2 text-left font-medium print:px-2">
                                                    Confirmação horário
                                                </th>
                                                <th className="w-[12%] px-3 py-2 text-left font-medium print:px-2">
                                                    Confirmação data
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.items.map((item) => (
                                                <tr
                                                    key={item.id}
                                                    className="border-t"
                                                >
                                                    <td className="px-3 py-2 font-medium print:px-2">
                                                        {item.full_name}
                                                    </td>
                                                    <td className="px-3 py-2 print:px-2">
                                                        {item.role_name ?? ''}
                                                    </td>
                                                    <td className="px-3 py-2 print:px-2">
                                                        {item.unit_name ?? ''}
                                                    </td>
                                                    <td className="px-3 py-2 print:px-2">
                                                        {item.phone ?? ''}
                                                    </td>
                                                    <td className="px-3 py-2 print:px-2">
                                                        {formatInterviewTime(
                                                            item.confirmed_interview_time,
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 print:px-2">
                                                        {item.confirmed_interview_date
                                                            ? formatDateBR(
                                                                  item.confirmed_interview_date,
                                                              )
                                                            : ''}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
