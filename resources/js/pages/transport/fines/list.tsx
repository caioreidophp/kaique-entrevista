import { ArrowDown, ArrowUp, Filter, LoaderCircle, Search } from 'lucide-react';
import { router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
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
import { ApiError, apiDelete, apiGet, apiPut } from '@/lib/api-client';
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
    tipo_registro: 'multa' | 'notificacao';
    data: string;
    hora: string | null;
    placa_frota_id: number | null;
    multa_infracao_id: number | null;
    multa_orgao_autuador_id: number | null;
    descricao: string | null;
    numero_auto_infracao: string | null;
    indicado_condutor: boolean;
    culpa: 'empresa' | 'motorista';
    valor: string;
    tipo_valor: 'normal' | '20_percent' | '40_percent';
    vencimento: string | null;
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
    | 'hora'
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

interface NotificationEditForm {
    id: number;
    data: string;
    hora: string;
    placa_frota_id: string;
    multa_infracao_id: string;
    descricao: string;
    numero_auto_infracao: string;
    multa_orgao_autuador_id: string;
    status: 'aguardando_motorista' | 'solicitado_boleto' | 'boleto_ok' | 'pago';
}

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

function formatHora(value: string | null | undefined): string {
    if (!value) return '-';
    return value.slice(0, 5);
}

export default function TransportFinesListPage() {
    const [references, setReferences] = useState<ReferenceResponse | null>(null);
    const [rows, setRows] = useState<FineItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ message: string; variant: 'success' | 'error' | 'info' } | null>(null);

    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [sortBy, setSortBy] = useState<SortField>('data');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [viewType, setViewType] = useState<'multa' | 'notificacao'>('multa');

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

    const [editingNotification, setEditingNotification] = useState<NotificationEditForm | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);

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
                tipo_registro: viewType,
            });

            if (search.trim()) params.set('search', search.trim());
            if (dataInicio) params.set('data_inicio', dataInicio);
            if (dataFim) params.set('data_fim', dataFim);
            if (unidadeId !== 'all') params.set('unidade_id', unidadeId);
            if (placaId !== 'all') params.set('placa_frota_id', placaId);
            if (viewType === 'multa' && motoristaId !== 'all') params.set('colaborador_id', motoristaId);
            if (infracaoId !== 'all') params.set('multa_infracao_id', infracaoId);
            if (orgaoId !== 'all') params.set('multa_orgao_autuador_id', orgaoId);
            if (viewType === 'multa' && culpa !== 'all') params.set('culpa', culpa);
            if (status !== 'all') params.set('status', status);

            const response = await apiGet<PaginatedFineResponse>(`/fines?${params.toString()}`);

            setRows(response.data);
            setPage(response.current_page);
            setLastPage(response.last_page);
            setTotal(response.total);
        } catch {
            setError(`Não foi possível carregar a lista de ${viewType === 'multa' ? 'multas' : 'notificações'}.`);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadReferences();
    }, []);

    useEffect(() => {
        void loadRows(1);
    }, [sortBy, sortDirection, viewType]);

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

    function openEditNotification(row: FineItem): void {
        setEditingNotification({
            id: row.id,
            data: row.data,
            hora: formatHora(row.hora) === '-' ? '00:00' : formatHora(row.hora),
            placa_frota_id: String(row.placa_frota_id ?? row.placa_frota?.id ?? ''),
            multa_infracao_id: String(row.multa_infracao_id ?? row.infracao?.id ?? ''),
            descricao: row.descricao ?? '',
            numero_auto_infracao: row.numero_auto_infracao ?? '',
            multa_orgao_autuador_id: String(row.multa_orgao_autuador_id ?? row.orgao_autuador?.id ?? ''),
            status: row.status,
        });
    }

    async function saveNotificationEdit(): Promise<void> {
        if (!editingNotification) return;

        setSavingEdit(true);
        setNotice(null);

        try {
            await apiPut(`/fines/${editingNotification.id}`, {
                tipo_registro: 'notificacao',
                data: editingNotification.data,
                hora: editingNotification.hora,
                placa_frota_id: Number(editingNotification.placa_frota_id),
                multa_infracao_id: Number(editingNotification.multa_infracao_id),
                descricao: editingNotification.descricao.trim() || null,
                numero_auto_infracao: editingNotification.numero_auto_infracao.trim() || null,
                multa_orgao_autuador_id: Number(editingNotification.multa_orgao_autuador_id),
                status: editingNotification.status,
            });

            setNotice({
                message: 'Notificação atualizada com sucesso.',
                variant: 'success',
            });
            setEditingNotification(null);
            await loadRows(page);
        } catch (apiError) {
            if (apiError instanceof ApiError) {
                setNotice({
                    message: apiError.message,
                    variant: 'error',
                });
            } else {
                setNotice({
                    message: 'Não foi possível atualizar a notificação.',
                    variant: 'error',
                });
            }
        } finally {
            setSavingEdit(false);
        }
    }

    async function deleteNotification(id: number): Promise<void> {
        if (!window.confirm('Confirma a exclusão desta notificação?')) {
            return;
        }

        try {
            await apiDelete(`/fines/${id}`);
            setNotice({
                message: 'Notificação excluída com sucesso.',
                variant: 'success',
            });
            await loadRows(page);
        } catch (apiError) {
            if (apiError instanceof ApiError) {
                setNotice({
                    message: apiError.message,
                    variant: 'error',
                });
            } else {
                setNotice({
                    message: 'Não foi possível excluir a notificação.',
                    variant: 'error',
                });
            }
        }
    }

    function transformToFine(id: number): void {
        router.visit(`/transport/fines/launch?from_notification_id=${id}`);
    }

    return (
        <AdminLayout title="Gestão de Multas - Lista" active="fines-list" module="fines">
            <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-semibold">Lista de Multas</h2>
                        <p className="text-sm text-muted-foreground">
                            Alterne entre multas e notificações. Notificações não entram no dashboard e podem ser transformadas em multa.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant={viewType === 'multa' ? 'default' : 'outline'}
                            onClick={() => setViewType('multa')}
                        >
                            Multas
                        </Button>
                        <Button
                            type="button"
                            variant={viewType === 'notificacao' ? 'default' : 'outline'}
                            onClick={() => setViewType('notificacao')}
                        >
                            Notificações
                        </Button>
                    </div>
                </div>

                {notice ? <Notification message={notice.message} variant={notice.variant} /> : null}
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

                            {viewType === 'multa' ? (
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
                            ) : null}

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

                            {viewType === 'multa' ? (
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
                            ) : null}
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
                        <CardTitle>{viewType === 'multa' ? 'Multas' : 'Notificações'} ({total})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando {viewType === 'multa' ? 'multas' : 'notificações'}...
                            </div>
                        ) : rows.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Nenhuma {viewType === 'multa' ? 'multa' : 'notificação'} encontrada para os filtros selecionados.
                            </p>
                        ) : viewType === 'multa' ? (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1600px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('data')}>DATA {renderSortIcon('data')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('hora')}>HORA {renderSortIcon('hora')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('placa')}>PLACA {renderSortIcon('placa')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('infracao')}>INFRAÇÃO {renderSortIcon('infracao')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('descricao')}>DESCRIÇÃO {renderSortIcon('descricao')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('numero_auto_infracao')}>Nº AUTO DE INFRAÇÃO {renderSortIcon('numero_auto_infracao')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('orgao')}>ÓRGÃO AUTUADOR {renderSortIcon('orgao')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('motorista')}>MOTORISTA {renderSortIcon('motorista')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('indicado_condutor')}>INDICADO CONDUTOR {renderSortIcon('indicado_condutor')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('culpa')}>CULPA {renderSortIcon('culpa')}</button></th>
                                            <th className="p-2 text-right"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('valor')}>VALOR {renderSortIcon('valor')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('tipo_valor')}>TIPO VALOR {renderSortIcon('tipo_valor')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('vencimento')}>VENCIMENTO {renderSortIcon('vencimento')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('status')}>STATUS {renderSortIcon('status')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('descontar')}>DESCONTAR {renderSortIcon('descontar')}</button></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <tr key={row.id} className="border-b align-top last:border-b-0">
                                                <td className="p-2">{formatDateBR(row.data)}</td>
                                                <td className="p-2">{formatHora(row.hora)}</td>
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
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1250px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('data')}>DATA {renderSortIcon('data')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('hora')}>HORA {renderSortIcon('hora')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('placa')}>PLACA {renderSortIcon('placa')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('infracao')}>INFRAÇÃO {renderSortIcon('infracao')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('descricao')}>DESCRIÇÃO {renderSortIcon('descricao')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('numero_auto_infracao')}>Nº AUTO DE INFRAÇÃO {renderSortIcon('numero_auto_infracao')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('orgao')}>ÓRGÃO ATUADOR {renderSortIcon('orgao')}</button></th>
                                            <th className="p-2"><button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('status')}>STATUS {renderSortIcon('status')}</button></th>
                                            <th className="p-2">AÇÕES</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <tr key={row.id} className="border-b align-top last:border-b-0">
                                                <td className="p-2">{formatDateBR(row.data)}</td>
                                                <td className="p-2">{formatHora(row.hora)}</td>
                                                <td className="p-2">{row.placa_frota?.placa ?? '-'}</td>
                                                <td className="p-2">{row.infracao?.nome ?? '-'}</td>
                                                <td className="p-2">{row.descricao ?? '-'}</td>
                                                <td className="p-2">{row.numero_auto_infracao ?? '-'}</td>
                                                <td className="p-2">{row.orgao_autuador?.nome ?? '-'}</td>
                                                <td className="p-2">{statusLabel(row.status)}</td>
                                                <td className="p-2">
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button type="button" size="sm" variant="outline" onClick={() => openEditNotification(row)}>Editar</Button>
                                                        <Button type="button" size="sm" variant="destructive" onClick={() => void deleteNotification(row.id)}>Excluir</Button>
                                                        <Button type="button" size="sm" onClick={() => transformToFine(row.id)}>Transformar em multa</Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="mt-4 flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground">Página {page} de {lastPage}</span>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => void loadRows(page - 1)}>Anterior</Button>
                                <Button type="button" variant="outline" size="sm" disabled={loading || page >= lastPage} onClick={() => void loadRows(page + 1)}>Próxima</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={editingNotification !== null} onOpenChange={(open) => !open && setEditingNotification(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Notificação</DialogTitle>
                    </DialogHeader>

                    {editingNotification ? (
                        <div className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Data</Label>
                                    <Input type="date" value={editingNotification.data} onChange={(event) => setEditingNotification((previous) => previous ? { ...previous, data: event.target.value } : previous)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Hora</Label>
                                    <Input type="time" value={editingNotification.hora} onChange={(event) => setEditingNotification((previous) => previous ? { ...previous, hora: event.target.value } : previous)} />
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Placa</Label>
                                    <Select value={editingNotification.placa_frota_id || 'none'} onValueChange={(value) => setEditingNotification((previous) => previous ? { ...previous, placa_frota_id: value === 'none' ? '' : value } : previous)}>
                                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Selecione</SelectItem>
                                            {sortedPlates.map((item) => (
                                                <SelectItem key={item.id} value={String(item.id)}>{item.placa}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Infração</Label>
                                    <Select value={editingNotification.multa_infracao_id || 'none'} onValueChange={(value) => setEditingNotification((previous) => previous ? { ...previous, multa_infracao_id: value === 'none' ? '' : value } : previous)}>
                                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Selecione</SelectItem>
                                            {sortedInfractions.map((item) => (
                                                <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Descrição</Label>
                                <Input value={editingNotification.descricao} onChange={(event) => setEditingNotification((previous) => previous ? { ...previous, descricao: event.target.value } : previous)} />
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Nº Auto de Infração</Label>
                                    <Input value={editingNotification.numero_auto_infracao} onChange={(event) => setEditingNotification((previous) => previous ? { ...previous, numero_auto_infracao: event.target.value } : previous)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Órgão Atuador</Label>
                                    <Select value={editingNotification.multa_orgao_autuador_id || 'none'} onValueChange={(value) => setEditingNotification((previous) => previous ? { ...previous, multa_orgao_autuador_id: value === 'none' ? '' : value } : previous)}>
                                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Selecione</SelectItem>
                                            {sortedAuthorities.map((item) => (
                                                <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={editingNotification.status} onValueChange={(value: NotificationEditForm['status']) => setEditingNotification((previous) => previous ? { ...previous, status: value } : previous)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="aguardando_motorista">Aguardando Motorista</SelectItem>
                                        <SelectItem value="solicitado_boleto">Solicitado Boleto</SelectItem>
                                        <SelectItem value="boleto_ok">Boleto OK</SelectItem>
                                        <SelectItem value="pago">Pago</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditingNotification(null)} disabled={savingEdit}>Cancelar</Button>
                        <Button type="button" onClick={() => void saveNotificationEdit()} disabled={savingEdit || !editingNotification || !editingNotification.data || !editingNotification.hora || !editingNotification.placa_frota_id || !editingNotification.multa_infracao_id || !editingNotification.multa_orgao_autuador_id}>
                            {savingEdit ? (<><LoaderCircle className="size-4 animate-spin" />Salvando...</>) : 'Salvar alterações'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
