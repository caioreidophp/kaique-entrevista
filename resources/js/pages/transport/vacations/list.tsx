import { ArrowDown, ArrowUp, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
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
import { apiGet } from '@/lib/api-client';

interface WrappedResponse<T> {
    data: T;
}

interface Unidade {
    id: number;
    nome: string;
}

interface Funcao {
    id: number;
    nome: string;
}

interface VacationCandidateRow {
    colaborador_id: number;
    nome: string;
    funcao: string | null;
    funcao_id: number | null;
    unidade: string | null;
    unidade_id: number | null;
    periodo_aquisitivo_inicio: string;
    periodo_aquisitivo_fim: string;
    direito: string;
    limite: string;
    status: 'vencida' | 'a_vencer' | 'liberada' | 'atencao' | 'urgente';
}

interface VacationLaunchedRow {
    id: number;
    colaborador_id: number;
    nome: string | null;
    funcao: string | null;
    unidade: string | null;
    data_inicio: string | null;
    data_fim: string | null;
    periodo_aquisitivo_inicio: string | null;
    periodo_aquisitivo_fim: string | null;
    dias_ferias: number;
    com_abono: boolean;
    autor: string | null;
}

type VacationTab = 'a-realizar' | 'realizadas';
type SortDirection = 'asc' | 'desc';
type CandidateSortBy =
    | 'nome'
    | 'funcao'
    | 'unidade'
    | 'periodo_aquisitivo_inicio'
    | 'periodo_aquisitivo_fim'
    | 'direito'
    | 'limite';
type LaunchedSortBy =
    | 'nome'
    | 'funcao'
    | 'unidade'
    | 'data_inicio'
    | 'data_fim'
    | 'periodo_aquisitivo_inicio'
    | 'periodo_aquisitivo_fim'
    | 'dias_ferias';

function formatDate(date: string | null): string {
    if (!date) return '-';

    const [year, month, day] = date.split('-');
    if (!year || !month || !day) return date;
    return `${day}/${month}/${year}`;
}

function normalizeText(value: string | null | undefined): string {
    return (value ?? '').toLocaleLowerCase('pt-BR');
}

function vacationStatusLabel(status: VacationCandidateRow['status']): string {
    switch (status) {
        case 'a_vencer':
            return 'À Vencer';
        case 'liberada':
            return 'Liberada';
        case 'atencao':
            return 'Atenção';
        case 'urgente':
            return 'Urgente';
        case 'vencida':
            return 'Vencida';
        default:
            return status;
    }
}

function vacationStatusClass(status: VacationCandidateRow['status']): string {
    switch (status) {
        case 'a_vencer':
            return 'font-medium text-sky-700';
        case 'liberada':
            return 'font-medium text-emerald-700';
        case 'atencao':
            return 'font-medium text-amber-700';
        case 'urgente':
            return 'font-medium text-orange-700';
        case 'vencida':
            return 'font-medium text-destructive';
        default:
            return 'font-medium text-foreground';
    }
}

function SortHeader({
    label,
    active,
    direction,
    onClick,
}: {
    label: string;
    active: boolean;
    direction: SortDirection;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-foreground/80"
        >
            <span>{label}</span>
            {active ? (
                direction === 'asc' ? (
                    <ArrowUp className="size-3.5" />
                ) : (
                    <ArrowDown className="size-3.5" />
                )
            ) : (
                <ArrowDown className="size-3.5 opacity-30" />
            )}
        </button>
    );
}

export default function VacationsListPage() {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<VacationTab>('a-realizar');
    const [candidates, setCandidates] = useState<VacationCandidateRow[]>([]);
    const [launched, setLaunched] = useState<VacationLaunchedRow[]>([]);
    const [unidades, setUnidades] = useState<Unidade[]>([]);
    const [funcoes, setFuncoes] = useState<Funcao[]>([]);
    const [unidadeFilter, setUnidadeFilter] = useState('all');
    const [funcaoFilter, setFuncaoFilter] = useState('all');
    const [limiteFilter, setLimiteFilter] = useState('todos');
    const [nameFilter, setNameFilter] = useState('');
    const [candidateSortBy, setCandidateSortBy] = useState<CandidateSortBy>('limite');
    const [candidateSortDirection, setCandidateSortDirection] = useState<SortDirection>('asc');
    const [launchedSortBy, setLaunchedSortBy] = useState<LaunchedSortBy>('data_inicio');
    const [launchedSortDirection, setLaunchedSortDirection] = useState<SortDirection>('desc');
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    useEffect(() => {
        Promise.all([
            apiGet<WrappedResponse<Unidade[]>>('/registry/unidades'),
            apiGet<WrappedResponse<Funcao[]>>('/registry/funcoes'),
        ])
            .then(([u, f]) => {
                setUnidades(u.data);
                setFuncoes(f.data);
            })
            .catch(() => {
                setNotification({
                    message: 'Não foi possível carregar os filtros de férias.',
                    variant: 'error',
                });
            });
    }, []);

    useEffect(() => {
        const params = new URLSearchParams();

        if (unidadeFilter !== 'all') params.set('unidade_id', unidadeFilter);
        if (funcaoFilter !== 'all') params.set('funcao_id', funcaoFilter);
        params.set('limite', limiteFilter);

        Promise.all([
            apiGet<WrappedResponse<VacationCandidateRow[]>>(
                `/payroll/vacations?${params.toString()}`,
            ),
            apiGet<WrappedResponse<VacationLaunchedRow[]>>(
                `/payroll/vacations/launched?${params.toString()}`,
            ),
        ])
            .then(([candidateResponse, launchedResponse]) => {
                setCandidates(candidateResponse.data);
                setLaunched(launchedResponse.data);
            })
            .catch(() => {
                setNotification({
                    message: 'Não foi possível carregar a lista de férias.',
                    variant: 'error',
                });
            })
            .finally(() => setLoading(false));
    }, [unidadeFilter, funcaoFilter, limiteFilter]);

    function handleUnidadeFilterChange(value: string): void {
        setLoading(true);
        setUnidadeFilter(value);
    }

    function handleFuncaoFilterChange(value: string): void {
        setLoading(true);
        setFuncaoFilter(value);
    }

    function handleLimiteFilterChange(value: string): void {
        setLoading(true);
        setLimiteFilter(value);
    }

    function toggleCandidateSort(next: CandidateSortBy): void {
        if (candidateSortBy === next) {
            setCandidateSortDirection((previous) =>
                previous === 'asc' ? 'desc' : 'asc',
            );
            return;
        }

        setCandidateSortBy(next);
        setCandidateSortDirection('asc');
    }

    function toggleLaunchedSort(next: LaunchedSortBy): void {
        if (launchedSortBy === next) {
            setLaunchedSortDirection((previous) =>
                previous === 'asc' ? 'desc' : 'asc',
            );
            return;
        }

        setLaunchedSortBy(next);
        setLaunchedSortDirection('asc');
    }

    const filteredCandidates = useMemo(() => {
        const normalizedQuery = normalizeText(nameFilter);

        return [...candidates]
            .filter((item) => {
                const matchesName =
                    normalizedQuery.length === 0 ||
                    normalizeText(item.nome).includes(normalizedQuery);

                return matchesName;
            })
            .sort((left, right) => {
                const direction = candidateSortDirection === 'asc' ? 1 : -1;
                const leftValue = String(left[candidateSortBy] ?? '');
                const rightValue = String(right[candidateSortBy] ?? '');

                return leftValue.localeCompare(rightValue, 'pt-BR', {
                    numeric: true,
                    sensitivity: 'base',
                }) * direction;
            });
    }, [candidateSortBy, candidateSortDirection, candidates, nameFilter]);

    const filteredLaunched = useMemo(() => {
        const normalizedQuery = normalizeText(nameFilter);

        return [...launched]
            .filter((item) => {
                const matchesName =
                    normalizedQuery.length === 0 ||
                    normalizeText(item.nome).includes(normalizedQuery);

                return matchesName;
            })
            .sort((left, right) => {
                const direction = launchedSortDirection === 'asc' ? 1 : -1;
                const leftValue = String(left[launchedSortBy] ?? '');
                const rightValue = String(right[launchedSortBy] ?? '');

                return leftValue.localeCompare(rightValue, 'pt-BR', {
                    numeric: true,
                    sensitivity: 'base',
                }) * direction;
            });
    }, [launched, launchedSortBy, launchedSortDirection, nameFilter]);

    return (
        <AdminLayout
            title="Controle de Férias - Lista"
            active="vacations-list"
            module="vacations"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Lista de Férias</h2>
                    <p className="text-sm text-muted-foreground">
                        Duas visões separadas para férias pendentes e férias já lançadas.
                    </p>
                </div>

                {notification ? (
                    <Notification message={notification.message} variant={notification.variant} />
                ) : null}

                <div className="flex flex-wrap gap-3">
                    <Button
                        type="button"
                        variant={activeTab === 'a-realizar' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('a-realizar')}
                    >
                        A realizar
                    </Button>
                    <Button
                        type="button"
                        variant={activeTab === 'realizadas' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('realizadas')}
                    >
                        Realizadas
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-4">
                        <div className="space-y-2">
                            <Label htmlFor="vacation-name-filter">Nome</Label>
                            <Input
                                id="vacation-name-filter"
                                value={nameFilter}
                                onChange={(event) => setNameFilter(event.target.value)}
                                placeholder="Buscar por nome"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Unidade</Label>
                            <Select value={unidadeFilter} onValueChange={handleUnidadeFilterChange}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as unidades</SelectItem>
                                    {unidades.map((item) => (
                                        <SelectItem key={item.id} value={String(item.id)}>
                                            {item.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Função</Label>
                            <Select value={funcaoFilter} onValueChange={handleFuncaoFilterChange}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as funções</SelectItem>
                                    {funcoes.map((item) => (
                                        <SelectItem key={item.id} value={String(item.id)}>
                                            {item.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Vencimento</Label>
                            <Select value={limiteFilter} onValueChange={handleLimiteFilterChange}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos</SelectItem>
                                    <SelectItem value="vencidas">Vencidas</SelectItem>
                                    <SelectItem value="a_vencer">A vencer</SelectItem>
                                    <SelectItem value="proximos_4_meses">Próximos 4 meses</SelectItem>
                                    <SelectItem value="proximos_2_meses">Próximos 2 meses</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {activeTab === 'a-realizar'
                                ? `A realizar (${filteredCandidates.length})`
                                : `Realizadas (${filteredLaunched.length})`}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando lista...
                            </div>
                        ) : activeTab === 'a-realizar' ? (
                            filteredCandidates.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Nenhum colaborador encontrado.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1100px] text-sm">
                                        <thead>
                                            <tr className="border-b text-left text-muted-foreground">
                                                <th className="py-2 pr-3">
                                                    <SortHeader
                                                        label="Nome"
                                                        active={candidateSortBy === 'nome'}
                                                        direction={candidateSortDirection}
                                                        onClick={() => toggleCandidateSort('nome')}
                                                    />
                                                </th>
                                                <th className="py-2 pr-3">
                                                    <SortHeader
                                                        label="Função"
                                                        active={candidateSortBy === 'funcao'}
                                                        direction={candidateSortDirection}
                                                        onClick={() => toggleCandidateSort('funcao')}
                                                    />
                                                </th>
                                                <th className="py-2 pr-3">
                                                    <SortHeader
                                                        label="Unidade"
                                                        active={candidateSortBy === 'unidade'}
                                                        direction={candidateSortDirection}
                                                        onClick={() => toggleCandidateSort('unidade')}
                                                    />
                                                </th>
                                                <th className="py-2 pr-3">
                                                    <SortHeader
                                                        label="Início Período"
                                                        active={candidateSortBy === 'periodo_aquisitivo_inicio'}
                                                        direction={candidateSortDirection}
                                                        onClick={() => toggleCandidateSort('periodo_aquisitivo_inicio')}
                                                    />
                                                </th>
                                                <th className="py-2 pr-3">
                                                    <SortHeader
                                                        label="Fim Período"
                                                        active={candidateSortBy === 'periodo_aquisitivo_fim'}
                                                        direction={candidateSortDirection}
                                                        onClick={() => toggleCandidateSort('periodo_aquisitivo_fim')}
                                                    />
                                                </th>
                                                <th className="py-2 pr-3">
                                                    <SortHeader
                                                        label="Direito"
                                                        active={candidateSortBy === 'direito'}
                                                        direction={candidateSortDirection}
                                                        onClick={() => toggleCandidateSort('direito')}
                                                    />
                                                </th>
                                                <th className="py-2 pr-3">
                                                    <SortHeader
                                                        label="Limite"
                                                        active={candidateSortBy === 'limite'}
                                                        direction={candidateSortDirection}
                                                        onClick={() => toggleCandidateSort('limite')}
                                                    />
                                                </th>
                                                <th className="py-2 pr-3 font-medium">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredCandidates.map((item) => (
                                                <tr key={item.colaborador_id} className="border-b last:border-b-0">
                                                    <td className="py-2 pr-3 font-medium">{item.nome}</td>
                                                    <td className="py-2 pr-3">{item.funcao ?? '-'}</td>
                                                    <td className="py-2 pr-3">{item.unidade ?? '-'}</td>
                                                    <td className="py-2 pr-3">{formatDate(item.periodo_aquisitivo_inicio)}</td>
                                                    <td className="py-2 pr-3">{formatDate(item.periodo_aquisitivo_fim)}</td>
                                                    <td className="py-2 pr-3">{formatDate(item.direito)}</td>
                                                    <td className="py-2 pr-3">{formatDate(item.limite)}</td>
                                                    <td className="py-2 pr-3">
                                                        <span className={vacationStatusClass(item.status)}>
                                                            {vacationStatusLabel(item.status)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        ) : filteredLaunched.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum lançamento de férias encontrado.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1200px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-2 pr-3">
                                                <SortHeader
                                                    label="Nome"
                                                    active={launchedSortBy === 'nome'}
                                                    direction={launchedSortDirection}
                                                    onClick={() => toggleLaunchedSort('nome')}
                                                />
                                            </th>
                                            <th className="py-2 pr-3">
                                                <SortHeader
                                                    label="Função"
                                                    active={launchedSortBy === 'funcao'}
                                                    direction={launchedSortDirection}
                                                    onClick={() => toggleLaunchedSort('funcao')}
                                                />
                                            </th>
                                            <th className="py-2 pr-3">
                                                <SortHeader
                                                    label="Unidade"
                                                    active={launchedSortBy === 'unidade'}
                                                    direction={launchedSortDirection}
                                                    onClick={() => toggleLaunchedSort('unidade')}
                                                />
                                            </th>
                                            <th className="py-2 pr-3">
                                                <SortHeader
                                                    label="Início"
                                                    active={launchedSortBy === 'data_inicio'}
                                                    direction={launchedSortDirection}
                                                    onClick={() => toggleLaunchedSort('data_inicio')}
                                                />
                                            </th>
                                            <th className="py-2 pr-3">
                                                <SortHeader
                                                    label="Fim"
                                                    active={launchedSortBy === 'data_fim'}
                                                    direction={launchedSortDirection}
                                                    onClick={() => toggleLaunchedSort('data_fim')}
                                                />
                                            </th>
                                            <th className="py-2 pr-3">
                                                <SortHeader
                                                    label="Início Período"
                                                    active={launchedSortBy === 'periodo_aquisitivo_inicio'}
                                                    direction={launchedSortDirection}
                                                    onClick={() => toggleLaunchedSort('periodo_aquisitivo_inicio')}
                                                />
                                            </th>
                                            <th className="py-2 pr-3">
                                                <SortHeader
                                                    label="Fim Período"
                                                    active={launchedSortBy === 'periodo_aquisitivo_fim'}
                                                    direction={launchedSortDirection}
                                                    onClick={() => toggleLaunchedSort('periodo_aquisitivo_fim')}
                                                />
                                            </th>
                                            <th className="py-2 pr-3">
                                                <SortHeader
                                                    label="Dias"
                                                    active={launchedSortBy === 'dias_ferias'}
                                                    direction={launchedSortDirection}
                                                    onClick={() => toggleLaunchedSort('dias_ferias')}
                                                />
                                            </th>
                                            <th className="py-2 pr-3 font-medium">Abono</th>
                                            <th className="py-2 pr-3 font-medium">Autor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLaunched.map((item) => (
                                            <tr key={item.id} className="border-b last:border-b-0">
                                                <td className="py-2 pr-3 font-medium">{item.nome ?? '-'}</td>
                                                <td className="py-2 pr-3">{item.funcao ?? '-'}</td>
                                                <td className="py-2 pr-3">{item.unidade ?? '-'}</td>
                                                <td className="py-2 pr-3">{formatDate(item.data_inicio)}</td>
                                                <td className="py-2 pr-3">{formatDate(item.data_fim)}</td>
                                                <td className="py-2 pr-3">{formatDate(item.periodo_aquisitivo_inicio)}</td>
                                                <td className="py-2 pr-3">{formatDate(item.periodo_aquisitivo_fim)}</td>
                                                <td className="py-2 pr-3">{item.dias_ferias}</td>
                                                <td className="py-2 pr-3">{item.com_abono ? 'Com abono' : 'Sem abono'}</td>
                                                <td className="py-2 pr-3">{item.autor ?? '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
