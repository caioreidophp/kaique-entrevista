import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { ApiError, apiGet } from '@/lib/api-client';

interface ActivityCauser {
    id: number;
    name: string;
    email: string;
}

interface ActivityChange {
    old?: Record<string, unknown>;
    attributes?: Record<string, unknown>;
}

interface ActivityLogItem {
    id: number;
    log_name: string | null;
    description: string;
    event: string | null;
    subject_type: string | null;
    subject_id: number | null;
    changes: ActivityChange | null;
    causer: ActivityCauser | null;
    created_at: string;
}

interface ActivityLogResponse {
    data: ActivityLogItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const logNameLabel: Record<string, string> = {
    default: 'Entrevista',
    frete: 'Frete',
    folha: 'Folha',
    cadastro: 'Cadastro',
};

const eventLabel: Record<string, string> = {
    created: 'Criou',
    updated: 'Atualizou',
    deleted: 'Excluiu',
};

const eventVariant: Record<
    string,
    'default' | 'secondary' | 'destructive' | 'outline'
> = {
    created: 'default',
    updated: 'secondary',
    deleted: 'destructive',
};

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function ChangesCell({
    changes,
    event,
}: {
    changes: ActivityChange | null;
    event: string | null;
}) {
    if (!changes) return <span className="text-muted-foreground">—</span>;

    if (event === 'created' && changes.attributes) {
        const entries = Object.entries(changes.attributes);
        if (entries.length === 0)
            return <span className="text-muted-foreground">—</span>;

        return (
            <div className="flex flex-wrap gap-1">
                {entries.map(([key, val]) => (
                    <span
                        key={key}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                    >
                        {key}:{' '}
                        <span className="text-green-700 dark:text-green-400">
                            {String(val ?? '')}
                        </span>
                    </span>
                ))}
            </div>
        );
    }

    if (event === 'updated' && changes.old && changes.attributes) {
        const keys = Object.keys(changes.attributes);
        if (keys.length === 0)
            return <span className="text-muted-foreground">—</span>;

        return (
            <div className="flex flex-col gap-0.5">
                {keys.map((key) => (
                    <span key={key} className="font-mono text-[11px]">
                        <span className="font-semibold">{key}:</span>{' '}
                        <span className="text-red-600 line-through">
                            {String(changes.old![key] ?? '')}
                        </span>
                        {' → '}
                        <span className="text-green-700 dark:text-green-400">
                            {String(changes.attributes![key] ?? '')}
                        </span>
                    </span>
                ))}
            </div>
        );
    }

    return <span className="text-muted-foreground">—</span>;
}

export default function ActivityLogPage() {
    const [items, setItems] = useState<ActivityLogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [notification, setNotification] = useState<{
        type: 'success' | 'error';
        message: string;
    } | null>(null);

    const [search, setSearch] = useState('');
    const [logName, setLogName] = useState('');
    const [event, setEvent] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [appliedFilters, setAppliedFilters] = useState({
        search: '',
        log_name: '',
        event: '',
        date_from: '',
        date_to: '',
        page: 1,
    });

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                params.set('per_page', '25');
                params.set('page', String(appliedFilters.page));
                if (appliedFilters.search)
                    params.set('search', appliedFilters.search);
                if (appliedFilters.log_name)
                    params.set('log_name', appliedFilters.log_name);
                if (appliedFilters.event)
                    params.set('event', appliedFilters.event);
                if (appliedFilters.date_from)
                    params.set('date_from', appliedFilters.date_from);
                if (appliedFilters.date_to)
                    params.set('date_to', appliedFilters.date_to);

                const res = await apiGet<ActivityLogResponse>(
                    `/activity-log?${params.toString()}`,
                );
                if (!cancelled) {
                    setItems(res.data);
                    setCurrentPage(res.current_page);
                    setLastPage(res.last_page);
                    setTotal(res.total);
                }
            } catch (err) {
                if (!cancelled) {
                    const msg =
                        err instanceof ApiError
                            ? err.message
                            : 'Erro ao carregar log.';
                    setNotification({ type: 'error', message: msg });
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, [appliedFilters]);

    function applyFilters() {
        setAppliedFilters({
            search,
            log_name: logName,
            event,
            date_from: dateFrom,
            date_to: dateTo,
            page: 1,
        });
    }

    function clearFilters() {
        setSearch('');
        setLogName('');
        setEvent('');
        setDateFrom('');
        setDateTo('');
        setAppliedFilters({
            search: '',
            log_name: '',
            event: '',
            date_from: '',
            date_to: '',
            page: 1,
        });
    }

    function goToPage(page: number) {
        setAppliedFilters((prev) => ({ ...prev, page }));
    }

    return (
        <AdminLayout
            title="Log de Ações"
            active="activity-log"
            module="home"
        >
            {notification && (
                <Notification
                    variant={notification.type}
                    message={notification.message}
                />
            )}

            <div className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold">Log de Ações</h2>
                    <p className="text-sm text-muted-foreground">
                        Histórico completo de ações realizadas no sistema.
                        {total > 0 && !loading && (
                            <span className="ml-1 font-medium text-foreground">
                                {total} registros encontrados.
                            </span>
                        )}
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                    <Input
                        placeholder="Buscar por usuário ou ação..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                        className="w-52"
                    />
                    <Select
                        value={logName || '_all'}
                        onValueChange={(v) => setLogName(v === '_all' ? '' : v)}
                    >
                        <SelectTrigger className="w-36">
                            <SelectValue placeholder="Módulo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_all">
                                Todos os módulos
                            </SelectItem>
                            <SelectItem value="default">Entrevistas</SelectItem>
                            <SelectItem value="frete">Frete</SelectItem>
                            <SelectItem value="folha">Folha</SelectItem>
                            <SelectItem value="cadastro">Cadastro</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={event || '_all'}
                        onValueChange={(v) => setEvent(v === '_all' ? '' : v)}
                    >
                        <SelectTrigger className="w-36">
                            <SelectValue placeholder="Evento" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_all">
                                Todos os eventos
                            </SelectItem>
                            <SelectItem value="created">Criação</SelectItem>
                            <SelectItem value="updated">Atualização</SelectItem>
                            <SelectItem value="deleted">Exclusão</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-36"
                        title="Data inicial"
                    />
                    <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-36"
                        title="Data final"
                    />
                    <Button size="sm" onClick={applyFilters}>
                        Filtrar
                    </Button>
                    <Button size="sm" variant="outline" onClick={clearFilters}>
                        Limpar
                    </Button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[900px] table-fixed text-sm">
                        <thead className="bg-muted/40">
                            <tr>
                                <th className="w-[160px] px-4 py-3 text-left font-medium">
                                    Data / Hora
                                </th>
                                <th className="w-[140px] px-4 py-3 text-left font-medium">
                                    Usuário
                                </th>
                                <th className="w-[80px] px-3 py-3 text-left font-medium">
                                    Módulo
                                </th>
                                <th className="w-[80px] px-3 py-3 text-left font-medium">
                                    Evento
                                </th>
                                <th className="w-[200px] px-4 py-3 text-left font-medium">
                                    Descrição
                                </th>
                                <th className="w-[240px] px-4 py-3 text-left font-medium">
                                    Alterações
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-4 py-8 text-center text-muted-foreground"
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <LoaderCircle className="size-4 animate-spin" />
                                            Carregando...
                                        </span>
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-4 py-8 text-center text-muted-foreground"
                                    >
                                        Nenhuma ação registrada ainda.
                                    </td>
                                </tr>
                            ) : (
                                items.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="border-t align-top transition-colors hover:bg-muted/20"
                                    >
                                        <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                                            {formatDate(item.created_at)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="block truncate text-sm leading-5 font-medium">
                                                {item.causer?.name ?? (
                                                    <span className="text-muted-foreground italic">
                                                        sistema
                                                    </span>
                                                )}
                                            </span>
                                            {item.causer?.email && (
                                                <span className="block truncate text-[11px] text-muted-foreground">
                                                    {item.causer.email}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            <Badge
                                                variant="outline"
                                                className="text-[11px]"
                                            >
                                                {logNameLabel[
                                                    item.log_name ?? ''
                                                ] ??
                                                    item.log_name ??
                                                    '—'}
                                            </Badge>
                                        </td>
                                        <td className="px-3 py-3">
                                            <Badge
                                                variant={
                                                    eventVariant[
                                                        item.event ?? ''
                                                    ] ?? 'secondary'
                                                }
                                                className="text-[11px]"
                                            >
                                                {eventLabel[item.event ?? ''] ??
                                                    item.event ??
                                                    '—'}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {item.description}
                                            {item.subject_type &&
                                                item.subject_id && (
                                                    <span className="block text-[11px] text-muted-foreground">
                                                        {item.subject_type} #
                                                        {item.subject_id}
                                                    </span>
                                                )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <ChangesCell
                                                changes={item.changes}
                                                event={item.event}
                                            />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {lastPage > 1 && (
                    <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-muted-foreground">
                            Página {currentPage} de {lastPage}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={currentPage <= 1}
                                onClick={() => goToPage(currentPage - 1)}
                            >
                                Anterior
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={currentPage >= lastPage}
                                onClick={() => goToPage(currentPage + 1)}
                            >
                                Próximo
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
