import { LoaderCircle, PencilLine, Printer, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import { usePersistedState } from '@/hooks/use-persisted-state';
import { ApiError, apiDelete, apiGet, apiPut } from '@/lib/api-client';

interface Unidade {
    id: number;
    nome: string;
}

interface TipoPagamento {
    id: number;
    nome: string;
}

interface Colaborador {
    id: number;
    nome: string;
    unidade_id: number;
    nome_banco?: string | null;
    numero_agencia?: string | null;
    numero_conta?: string | null;
    tipo_conta?: string | null;
    chave_pix?: string | null;
    banco_salario?: string | null;
    numero_agencia_salario?: string | null;
    numero_conta_salario?: string | null;
    conta_pagamento?: string | null;
    cartao_beneficio?: string | null;
}

interface Pagamento {
    id: number;
    colaborador_id: number;
    unidade_id: number;
    tipo_pagamento_id: number | null;
    valor: string;
    descricao: string | null;
    data_pagamento: string | null;
    competencia_mes: number;
    competencia_ano: number;
    colaborador?: Colaborador;
    unidade?: Unidade;
    tipo_pagamento?: TipoPagamento;
}

interface GroupedPayment {
    key: string;
    colaborador: Colaborador;
    unidade: Unidade | null;
    descricao: string;
    data_pagamento: string | null;
    byType: Map<number, Pagamento>;
    allItems: Pagamento[];
}

interface PaginatedResponse<T> {
    current_page: number;
    data: T[];
    last_page: number;
    total: number;
}

interface WrappedResponse<T> {
    data: T;
}

const now = new Date();
const defaultMonth = String(now.getMonth() + 1);
const defaultYear = String(now.getFullYear());

function formatCurrency(value: number | string): string {
    const numeric = typeof value === 'string' ? Number(value) : value;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(Number.isFinite(numeric) ? numeric : 0);
}

function formatDate(value: string | null): string {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('pt-BR');
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export default function TransportPayrollListPage() {
    const [items, setItems] = useState<Pagamento[]>([]);
    const [tipos, setTipos] = useState<TipoPagamento[]>([]);
    const [unidades, setUnidades] = useState<Unidade[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [monthFilter, setMonthFilter, resetMonthFilter] = usePersistedState(
        'transport:payroll:list:monthFilter',
        defaultMonth,
    );
    const [yearFilter, setYearFilter, resetYearFilter] = usePersistedState(
        'transport:payroll:list:yearFilter',
        defaultYear,
    );
    const [unidadeFilter, setUnidadeFilter, resetUnidadeFilter] =
        usePersistedState('transport:payroll:list:unidadeFilter', 'all');

    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const [deleteCandidate, setDeleteCandidate] = useState<GroupedPayment | null>(null);
    const [editCandidate, setEditCandidate] = useState<GroupedPayment | null>(null);
    const [editDate, setEditDate] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editValues, setEditValues] = useState<Record<number, string>>({});

    const monthOptions = useMemo(
        () => [
            { value: '1', label: 'Jan' },
            { value: '2', label: 'Fev' },
            { value: '3', label: 'Mar' },
            { value: '4', label: 'Abr' },
            { value: '5', label: 'Mai' },
            { value: '6', label: 'Jun' },
            { value: '7', label: 'Jul' },
            { value: '8', label: 'Ago' },
            { value: '9', label: 'Set' },
            { value: '10', label: 'Out' },
            { value: '11', label: 'Nov' },
            { value: '12', label: 'Dez' },
        ],
        [],
    );

    const yearOptions = useMemo(
        () => [
            String(now.getFullYear() - 1),
            String(now.getFullYear()),
            String(now.getFullYear() + 1),
        ],
        [],
    );

    const groupedItems = useMemo(() => {
        const map = new Map<string, GroupedPayment>();

        items.forEach((item) => {
            if (!item.colaborador) return;

            const key = [
                item.colaborador_id,
                item.unidade_id,
                item.data_pagamento ?? `${item.competencia_ano}-${String(item.competencia_mes).padStart(2, '0')}-01`,
                item.descricao ?? '',
            ].join('|');

            if (!map.has(key)) {
                map.set(key, {
                    key,
                    colaborador: item.colaborador,
                    unidade: item.unidade ?? null,
                    descricao: item.descricao ?? '-',
                    data_pagamento: item.data_pagamento,
                    byType: new Map<number, Pagamento>(),
                    allItems: [],
                });
            }

            const group = map.get(key);
            if (!group) return;

            if (item.tipo_pagamento_id) {
                group.byType.set(item.tipo_pagamento_id, item);
            }
            group.allItems.push(item);
        });

        return Array.from(map.values());
    }, [items]);

    async function loadOptions(): Promise<void> {
        try {
            const [unitsRes, tiposRes] = await Promise.all([
                apiGet<WrappedResponse<Unidade[]>>('/registry/unidades'),
                apiGet<WrappedResponse<TipoPagamento[]>>('/registry/tipos-pagamento'),
            ]);
            setUnidades(unitsRes.data);
            setTipos(tiposRes.data);
        } catch {
            setNotification({
                message: 'Não foi possível carregar filtros e tipos de pagamento.',
                variant: 'error',
            });
        }
    }

    function buildQuery(page: number): string {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('per_page', '80');
        params.set('competencia_mes', monthFilter);
        params.set('competencia_ano', yearFilter);

        if (unidadeFilter !== 'all') {
            params.set('unidade_id', unidadeFilter);
        }

        return params.toString();
    }

    async function load(page = 1): Promise<void> {
        setLoading(true);
        setNotification(null);

        try {
            const response = await apiGet<PaginatedResponse<Pagamento>>(
                `/payroll/pagamentos?${buildQuery(page)}`,
            );
            setItems(response.data);
            setCurrentPage(response.current_page);
            setLastPage(response.last_page);
            setTotal(response.total);
        } catch {
            setNotification({
                message: 'Não foi possível carregar a lista de pagamentos.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadOptions();
        void load(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function clearFilters(): void {
        resetMonthFilter();
        resetYearFilter();
        resetUnidadeFilter();
        void load(1);
    }

    function openEditDialog(item: GroupedPayment): void {
        setEditCandidate(item);
        setEditDate(item.data_pagamento ? item.data_pagamento.slice(0, 10) : '');
        setEditDescription(item.descricao === '-' ? '' : item.descricao);

        const values: Record<number, string> = {};
        tipos.forEach((tipo) => {
            values[tipo.id] = item.byType.get(tipo.id)?.valor
                ? String(item.byType.get(tipo.id)?.valor)
                : '0';
        });
        setEditValues(values);
    }

    async function saveEdition(): Promise<void> {
        if (!editCandidate) return;

        const payloads = editCandidate.allItems.map((item) => {
            return {
                id: item.id,
                payload: {
                    valor: editValues[item.tipo_pagamento_id ?? 0] ?? item.valor,
                    descricao: editDescription || null,
                    data_pagamento: editDate || null,
                },
            };
        });

        setSaving(true);
        setNotification(null);

        try {
            await Promise.all(payloads.map((entry) => apiPut(`/payroll/pagamentos/${entry.id}`, entry.payload)));
            setNotification({ message: 'Pagamentos atualizados com sucesso.', variant: 'success' });
            setEditCandidate(null);
            await load(currentPage);
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({ message: error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível atualizar os pagamentos.', variant: 'error' });
            }
        } finally {
            setSaving(false);
        }
    }

    async function confirmDelete(): Promise<void> {
        if (!deleteCandidate) return;

        setDeleting(true);

        try {
            await Promise.all(deleteCandidate.allItems.map((item) => apiDelete(`/payroll/pagamentos/${item.id}`)));
            setNotification({ message: 'Lançamento excluído com sucesso.', variant: 'success' });
            setDeleteCandidate(null);
            await load(currentPage);
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({ message: error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível excluir o lançamento.', variant: 'error' });
            }
        } finally {
            setDeleting(false);
        }
    }

    function printRow(item: GroupedPayment): void {
        const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
        if (!printWindow) {
            setNotification({ message: 'Não foi possível abrir a tela de impressão.', variant: 'error' });
            return;
        }

        const banking = item.colaborador;
        const typeCells = tipos
            .map((tipo) => {
                const valor = item.byType.get(tipo.id)?.valor ?? '0';
                return `<td>${escapeHtml(formatCurrency(valor))}</td>`;
            })
            .join('');

        const typeHeaders = tipos.map((tipo) => `<th>${escapeHtml(tipo.nome)}</th>`).join('');

        const html = `
            <!doctype html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8" />
                <title>Planilha de Pagamento</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
                    h1 { margin: 0 0 8px; }
                    p { margin: 0 0 4px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                    th, td { border: 1px solid #cfcfcf; padding: 8px; text-align: left; font-size: 12px; }
                    th { background: #f3f4f6; }
                    .meta { margin-top: 12px; }
                    .meta strong { min-width: 180px; display: inline-block; }
                </style>
            </head>
            <body>
                <h1>Planilha de Pagamento</h1>
                <p><strong>Colaborador:</strong> ${escapeHtml(item.colaborador.nome)}</p>
                <p><strong>Unidade:</strong> ${escapeHtml(item.unidade?.nome ?? '-')}</p>
                <p><strong>Descrição:</strong> ${escapeHtml(item.descricao)}</p>
                <p><strong>Data:</strong> ${escapeHtml(formatDate(item.data_pagamento))}</p>

                <table>
                    <thead>
                        <tr>
                            <th>Colaborador</th>
                            <th>Descrição</th>
                            <th>Unidade</th>
                            ${typeHeaders}
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${escapeHtml(item.colaborador.nome)}</td>
                            <td>${escapeHtml(item.descricao)}</td>
                            <td>${escapeHtml(item.unidade?.nome ?? '-')}</td>
                            ${typeCells}
                            <td>${escapeHtml(
                                formatCurrency(
                                    tipos.reduce((acc, tipo) => acc + Number(item.byType.get(tipo.id)?.valor ?? 0), 0),
                                ),
                            )}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="meta">
                    <p><strong>Banco:</strong> ${escapeHtml(banking.nome_banco ?? '-')}</p>
                    <p><strong>Agência:</strong> ${escapeHtml(banking.numero_agencia ?? '-')}</p>
                    <p><strong>Conta:</strong> ${escapeHtml(banking.numero_conta ?? '-')} (${escapeHtml(banking.tipo_conta ?? '-')})</p>
                    <p><strong>PIX:</strong> ${escapeHtml(banking.chave_pix ?? '-')}</p>
                    <p><strong>Banco Salário:</strong> ${escapeHtml(banking.banco_salario ?? '-')}</p>
                    <p><strong>Agência Salário:</strong> ${escapeHtml(banking.numero_agencia_salario ?? '-')}</p>
                    <p><strong>Conta Salário:</strong> ${escapeHtml(banking.numero_conta_salario ?? '-')}</p>
                    <p><strong>Conta Pagamento:</strong> ${escapeHtml(banking.conta_pagamento ?? '-')}</p>
                    <p><strong>Cartão Benefício:</strong> ${escapeHtml(banking.cartao_beneficio ?? '-')}</p>
                </div>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    return (
        <AdminLayout
            title="Pagamentos - Lista de Pagamentos"
            active="payroll-list"
            module="payroll"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Lista de Pagamentos</h2>
                    <p className="text-sm text-muted-foreground">
                        Cada linha representa um colaborador com colunas dinâmicas por tipo de pagamento.
                    </p>
                </div>

                {notification ? (
                    <Notification message={notification.message} variant={notification.variant} />
                ) : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-4">
                            <div className="space-y-2">
                                <Label>Mês</Label>
                                <Select value={monthFilter} onValueChange={setMonthFilter}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {monthOptions.map((month) => (
                                            <SelectItem key={month.value} value={month.value}>
                                                {month.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Ano</Label>
                                <Select value={yearFilter} onValueChange={setYearFilter}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {yearOptions.map((year) => (
                                            <SelectItem key={year} value={year}>
                                                {year}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Unidade</Label>
                                <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        {unidades.map((unit) => (
                                            <SelectItem key={unit.id} value={String(unit.id)}>
                                                {unit.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end gap-2">
                                <Button variant="outline" onClick={() => void load(1)}>
                                    Aplicar filtros
                                </Button>
                                <Button variant="outline" onClick={clearFilters}>
                                    Limpar
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Lançamentos agrupados ({groupedItems.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando pagamentos...
                            </div>
                        ) : groupedItems.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum pagamento encontrado.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-2 pr-3 font-medium">Colaborador</th>
                                            <th className="py-2 pr-3 font-medium">Descrição</th>
                                            <th className="py-2 pr-3 font-medium">Unidade</th>
                                            {tipos.map((tipo) => (
                                                <th key={tipo.id} className="py-2 pr-3 font-medium">
                                                    {tipo.nome}
                                                </th>
                                            ))}
                                            <th className="py-2 pr-3 font-medium">Total</th>
                                            <th className="py-2 pr-3 font-medium">Data</th>
                                            <th className="py-2 text-right font-medium">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupedItems.map((item) => {
                                            const totalRow = tipos.reduce(
                                                (acc, tipo) => acc + Number(item.byType.get(tipo.id)?.valor ?? 0),
                                                0,
                                            );

                                            return (
                                                <tr key={item.key} className="border-b last:border-b-0">
                                                    <td className="py-2 pr-3 font-medium">{item.colaborador.nome}</td>
                                                    <td className="py-2 pr-3">{item.descricao}</td>
                                                    <td className="py-2 pr-3">{item.unidade?.nome ?? '-'}</td>
                                                    {tipos.map((tipo) => (
                                                        <td key={tipo.id} className="py-2 pr-3">
                                                            {formatCurrency(item.byType.get(tipo.id)?.valor ?? 0)}
                                                        </td>
                                                    ))}
                                                    <td className="py-2 pr-3 font-semibold">{formatCurrency(totalRow)}</td>
                                                    <td className="py-2 pr-3">{formatDate(item.data_pagamento)}</td>
                                                    <td className="py-2">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => openEditDialog(item)}
                                                            >
                                                                <PencilLine className="size-4" />
                                                                Editar
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => printRow(item)}
                                                            >
                                                                <Printer className="size-4" />
                                                                Imprimir
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => setDeleteCandidate(item)}
                                                            >
                                                                <Trash2 className="size-4" />
                                                                Excluir
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="mt-4 flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                Página {currentPage} de {lastPage} - Total de registros: {total}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    disabled={currentPage <= 1 || loading}
                                    onClick={() => void load(currentPage - 1)}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    disabled={currentPage >= lastPage || loading}
                                    onClick={() => void load(currentPage + 1)}
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
                    if (!open) setDeleteCandidate(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir lançamento agrupado</DialogTitle>
                        <DialogDescription>
                            Essa ação exclui todos os tipos de pagamento deste lançamento.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDeleteCandidate(null)}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => void confirmDelete()}
                            disabled={deleting}
                        >
                            {deleting ? (
                                <>
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Excluindo...
                                </>
                            ) : (
                                'Excluir'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(editCandidate)}
                onOpenChange={(open) => {
                    if (!open) setEditCandidate(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar lançamento agrupado</DialogTitle>
                        <DialogDescription>
                            Edite descrição, data e valores dos tipos já lançados para este colaborador.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="edit-description">Descrição</Label>
                                <Input
                                    id="edit-description"
                                    value={editDescription}
                                    onChange={(event) => setEditDescription(event.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-date">Data pagamento</Label>
                                <Input
                                    id="edit-date"
                                    type="date"
                                    value={editDate}
                                    onChange={(event) => setEditDate(event.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            {tipos
                                .filter((tipo) => editCandidate?.byType.has(tipo.id))
                                .map((tipo) => (
                                    <div className="space-y-2" key={tipo.id}>
                                        <Label htmlFor={`tipo-${tipo.id}`}>{tipo.nome}</Label>
                                        <Input
                                            id={`tipo-${tipo.id}`}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={editValues[tipo.id] ?? '0'}
                                            onChange={(event) =>
                                                setEditValues((previous) => ({
                                                    ...previous,
                                                    [tipo.id]: event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditCandidate(null)}>
                            Cancelar
                        </Button>
                        <Button type="button" onClick={() => void saveEdition()} disabled={saving}>
                            {saving ? (
                                <>
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                'Salvar alterações'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
