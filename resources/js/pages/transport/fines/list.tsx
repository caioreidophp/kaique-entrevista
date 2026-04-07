import { ArrowDown, ArrowUp, Filter, LoaderCircle, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { apiGet } from '@/lib/api-client';
import { formatCurrencyBR, formatDateBR } from '@/lib/transport-format';

interface UnitItem {
    id: number;
    nome: string;
}

interface PlateItem {
    id: number;
    placa: string;
    unidade_id: number | null;
    unidade?: UnitItem;
}

interface DriverItem {
    id: number;
    nome: string;
    unidade_id: number | null;
    unidade?: UnitItem;
}

interface FineInfractionItem {
    id: number;
    nome: string;
}

interface FineAuthorityItem {
    id: number;
    nome: string;
}

interface ReferenceResponse {
    unidades: UnitItem[];
    placas: PlateItem[];
    motoristas: DriverItem[];
    infracoes: FineInfractionItem[];
    orgaos: FineAuthorityItem[];
}

interface FineItem {
    id: number;
    data: string;
    descricao: string | null;
    numero_auto_infracao: string | null;
    indicado_condutor: boolean;
    culpa: 'empresa' | 'motorista';
    valor: string;
    tipo_valor: 'normal' | '20_percent' | '40_percent';
    vencimento: string;
    status: 'aguardando_motorista' | 'solicitado_boleto' | 'boleto_ok' | 'pago';
    descontar: boolean;
    placa_frota?: {
        id: number;
        placa: string;
    } | null;
    infracao?: {
        id: number;
        nome: string;
    } | null;
    orgao_autuador?: {
        id: number;
        nome: string;
    } | null;
    colaborador?: {
        id: number;
        nome: string;
    } | null;
}

interface PaginatedFineResponse {
    data: FineItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

type SortField =
    | 'data'
    | 'placa'
    | 'infracao'
    | 'descricao'
    | 'numero_auto_infracao'
    | 'orgao'
    | 'motorista'
    | 'indicado_condutor'
    | 'culpa'
    | 'valor'
    | 'tipo_valor'
    | 'vencimento'
    | 'status'
    | 'descontar';

function statusLabel(value: string): string {
    const map: Record<string, string> = {
        aguardando_motorista: 'Aguardando Motorista',
        solicitado_boleto: 'Solicitado Boleto',
        boleto_ok: 'Boleto OK',
        pago: 'Pago',
    };

    return map[value] ?? value;
}

function culpaLabel(value: string): string {
    return value === 'motorista' ? 'Motorista' : 'Empresa';
}

function tipoValorLabel(value: string): string {
    const map: Record<string, string> = {
        normal: 'Normal',
        '20_percent': '20%',
        '40_percent': '40%',
    };

    return map[value] ?? value;
}

export default function TransportFinesListPage() {
    const [references, setReferences] = useState<ReferenceResponse | null>(null);
    const [rows, setRows] = useState<FineItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [sortBy, setSortBy] = useState<SortField>('data');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const [search, setSearch] = useState('');
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [unidadeId, setUnidadeId] = useState('all');
    const [placaId, setPlacaId] = useState('all');
    const [motoristaId, setMotoristaId] = useState('all');
    const [infracaoId, setInfracaoId] = useState('all');
    const [orgaoId, setOrgaoId] = useState('all');
    const [culpa, setCulpa] = useState('all');
    const [status, setStatus] = useState('all');

    const sortedPlates = useMemo(() => {
        return [...(references?.placas ?? [])].sort((a, b) => a.placa.localeCompare(b.placa));
    }, [references?.placas]);

    const sortedDrivers = useMemo(() => {
        return [...(references?.motoristas ?? [])].sort((a, b) => a.nome.localeCompare(b.nome));
    }, [references?.motoristas]);

    const sortedInfractions = useMemo(() => {
        return [...(references?.infracoes ?? [])].sort((a, b) => a.nome.localeCompare(b.nome));
    }, [references?.infracoes]);

    const sortedAuthorities = useMemo(() => {
        return [...(references?.orgaos ?? [])].sort((a, b) => a.nome.localeCompare(b.nome));
    }, [references?.orgaos]);

    async function loadReferences(): Promise<void> {
        try {
            const response = await apiGet<ReferenceResponse>('/fines/reference');
            setReferences(response);
        } catch {
            setError('Não foi possível carregar as referências de filtros.');
        }
    }

    async function loadRows(targetPage: number): Promise<void> {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                page: String(targetPage),
                per_page: '20',
                sort_by: sortBy,
                sort_direction: sortDirection,
            });

            if (search.trim()) params.set('search', search.trim());
            if (dataInicio) params.set('data_inicio', dataInicio);
            if (dataFim) params.set('data_fim', dataFim);
            if (unidadeId !== 'all') params.set('unidade_id', unidadeId);
            if (placaId !== 'all') params.set('placa_frota_id', placaId);
            if (motoristaId !== 'all') params.set('colaborador_id', motoristaId);
            if (infracaoId !== 'all') params.set('multa_infracao_id', infracaoId);
            if (orgaoId !== 'all') params.set('multa_orgao_autuador_id', orgaoId);
            if (culpa !== 'all') params.set('culpa', culpa);
            if (status !== 'all') params.set('status', status);

            const response = await apiGet<PaginatedFineResponse>(`/fines?${params.toString()}`);

            setRows(response.data);
            setPage(response.current_page);
            setLastPage(response.last_page);
            setTotal(response.total);
        } catch {
            setError('Não foi possível carregar a lista de multas.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadReferences();
    }, []);

    useEffect(() => {
        void loadRows(1);
    }, [sortBy, sortDirection]);

    function applyFilters(): void {
        void loadRows(1);
    }

    function clearFilters(): void {
        setSearch('');
        setDataInicio('');
        setDataFim('');
        setUnidadeId('all');
        setPlacaId('all');
        setMotoristaId('all');
        setInfracaoId('all');
        setOrgaoId('all');
        setCulpa('all');
        setStatus('all');

        setTimeout(() => {
            void loadRows(1);
        }, 0);
    }

    function handleSort(field: SortField): void {
        if (sortBy === field) {
            setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'));
            return;
        }

        setSortBy(field);
        setSortDirection('asc');
    }

    function renderSortIcon(field: SortField): React.ReactNode {
        if (sortBy !== field) return null;

        if (sortDirection === 'asc') {
            return <ArrowUp className="size-3.5" />;
        }

        return <ArrowDown className="size-3.5" />;
    }

    return (
        <AdminLayout title="Gestão de Multas - Lista" active="fines-list" module="fines">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Lista de Multas</h2>
                    <p className="text-sm text-muted-foreground">
                        Ordenação por todos os campos e filtros por placa, motorista, infração, culpa, status e órgão.
                    </p>
                </div>

                {error ? <Notification message={error} variant="error" /> : null}

                <Card className="border-border/80">
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Buscar</label>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                                    <Input
                                        className="pl-8"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Auto/descrição"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Data início</label>
                                <Input type="date" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Data fim</label>
                                <Input type="date" value={dataFim} onChange={(event) => setDataFim(event.target.value)} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Unidade</label>
                                <Select value={unidadeId} onValueChange={setUnidadeId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        {(references?.unidades ?? []).map((unit) => (
                                            <SelectItem key={unit.id} value={String(unit.id)}>
                                                {unit.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Placa</label>
                                <Select value={placaId} onValueChange={setPlacaId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        {sortedPlates.map((plate) => (
                                            <SelectItem key={plate.id} value={String(plate.id)}>
                                                {plate.placa}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Motorista</label>
                                <Select value={motoristaId} onValueChange={setMotoristaId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        {sortedDrivers.map((driver) => (
                                            <SelectItem key={driver.id} value={String(driver.id)}>
                                                {driver.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Infração</label>
                                <Select value={infracaoId} onValueChange={setInfracaoId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        {sortedInfractions.map((item) => (
                                            <SelectItem key={item.id} value={String(item.id)}>
                                                {item.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Órgão</label>
                                <Select value={orgaoId} onValueChange={setOrgaoId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        {sortedAuthorities.map((item) => (
                                            <SelectItem key={item.id} value={String(item.id)}>
                                                {item.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Culpa</label>
                                <Select value={culpa} onValueChange={setCulpa}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        <SelectItem value="empresa">Empresa</SelectItem>
                                        <SelectItem value="motorista">Motorista</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Status</label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        <SelectItem value="aguardando_motorista">Aguardando Motorista</SelectItem>
                                        <SelectItem value="solicitado_boleto">Solicitado Boleto</SelectItem>
                                        <SelectItem value="boleto_ok">Boleto OK</SelectItem>
                                        <SelectItem value="pago">Pago</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end gap-2 md:col-span-2 lg:col-span-2">
                                <Button type="button" onClick={applyFilters} className="w-full" disabled={loading}>
                                    {loading ? (
                                        <>
                                            <LoaderCircle className="size-4 animate-spin" />
                                            Carregando...
                                        </>
                                    ) : (
                                        <>
                                            <Filter className="size-4" />
                                            Aplicar filtros
                                        </>
                                    )}
                                </Button>
                                <Button type="button" variant="outline" onClick={clearFilters} className="w-full" disabled={loading}>
                                    Limpar
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/80">
                    <CardHeader>
                        <CardTitle>Multas ({total})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando multas...
                            </div>
                        ) : rows.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhuma multa encontrada para os filtros selecionados.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1500px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="p-2">
                                                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('data')}>
                                                    DATA {renderSortIcon('data')}
                                                </button>
                                            </th>
                                            <th className="p-2">
                                                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('placa')}>
                                                    PLACA {renderSortIcon('placa')}
                                                </button>
                                            </th>
                                            <th className="p-2">
                                                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('infracao')}>
                                                    INFRAÇÃO {renderSortIcon('infracao')}
                                                </button>
                                            </th>
                                            <th className="p-2">
                                                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('descricao')}>
                                                    DESCRIÇÃO {renderSortIcon('descricao')}
                                                </button>
                                            </th>
                                            <th className="p-2">
                                                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('numero_auto_infracao')}>
                                                    Nº AUTO DE INFRAÇÃO {renderSortIcon('numero_auto_infracao')}
                                                </button>
                                            </th>
                                            <th className="p-2">
                                                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('orgao')}>
                                                    ÓRGÃO AUTUADOR {renderSortIcon('orgao')}
                                                </button>
                                            </th>
                                            <th className="p-2">
                                                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('motorista')}>
                                                    MOTORISTA {renderSortIcon('motorista')}
                                                </button>
                                            </th>
                                            <th className="p-2">
                                                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('indicado_condutor')}>
                                                    INDICADO CONDUTOR {renderSortIcon('indicado_condutor')}
                                                </button>
                                            </th>
                                            <th className="p-2">
                                                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('culpa')}>
                                                    CULPA {renderSortIcon('culpa')}
                                                </button>
                                            </th>
                                            <th className="p-2 text-right">
                                                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('valor')}>
                                                    VALOR {renderSortIcon('valor')}
                                                </button>
                                            </th>
                                            <th className="p-2">
                                                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('tipo_valor')}>
                                                    TIPO VALOR {renderSortIcon('tipo_valor')}
                                                </button>
                                            </th>
                                            <th className="p-2">
                                                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('vencimento')}>
                                                    VENCIMENTO {renderSortIcon('vencimento')}
                                                </button>
                                            </th>
                                            <th className="p-2">
                                                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('status')}>
                                                    STATUS {renderSortIcon('status')}
                                                </button>
                                            </th>
                                            <th className="p-2">
                                                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('descontar')}>
                                                    DESCONTAR {renderSortIcon('descontar')}
                                                </button>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <tr key={row.id} className="border-b align-top last:border-b-0">
                                                <td className="p-2">{formatDateBR(row.data)}</td>
                                                <td className="p-2">{row.placa_frota?.placa ?? '-'}</td>
                                                <td className="p-2">{row.infracao?.nome ?? '-'}</td>
                                                <td className="p-2">{row.descricao ?? '-'}</td>
                                                <td className="p-2">{row.numero_auto_infracao ?? '-'}</td>
                                                <td className="p-2">{row.orgao_autuador?.nome ?? '-'}</td>
                                                <td className="p-2">{row.colaborador?.nome ?? '-'}</td>
                                                <td className="p-2">{row.indicado_condutor ? 'Sim' : 'Não'}</td>
                                                <td className="p-2">{culpaLabel(row.culpa)}</td>
                                                <td className="p-2 text-right font-medium">{formatCurrencyBR(row.valor)}</td>
                                                <td className="p-2">{tipoValorLabel(row.tipo_valor)}</td>
                                                <td className="p-2">{formatDateBR(row.vencimento)}</td>
                                                <td className="p-2">{statusLabel(row.status)}</td>
                                                <td className="p-2">{row.descontar ? 'Sim' : 'Não'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="mt-4 flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground">
                                Página {page} de {lastPage}
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={loading || page <= 1}
                                    onClick={() => void loadRows(page - 1)}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={loading || page >= lastPage}
                                    onClick={() => void loadRows(page + 1)}
                                >
                                    Próxima
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
