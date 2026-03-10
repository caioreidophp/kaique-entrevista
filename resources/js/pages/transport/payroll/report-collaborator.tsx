import { AlertCircle, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet } from '@/lib/api-client';

interface Colaborador {
    id: number;
    nome: string;
}

interface ReportResponse {
    colaborador: {
        id: number;
        nome: string;
        unidade?: { nome: string };
        funcao?: { nome: string };
    };
    timeline: Array<{
        id: number;
        competencia_mes: number;
        competencia_ano: number;
        valor: number;
        parcela_emprestimo?: number;
        ganho_total?: number;
        lancado_em: string | null;
        observacao: string | null;
    }>;
    total_acumulado: number;
    total_acumulado_com_emprestimo?: number;
    media_salarial: number;
    variacao_percentual: Array<{
        competencia_mes: number;
        competencia_ano: number;
        variacao_percentual: number | null;
    }>;
    datas_importantes: {
        data_admissao: string | null;
        data_demissao: string | null;
        data_nascimento: string | null;
    };
}

interface PaginatedResponse<T> {
    data: T[];
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
}

function formatDate(value: string | null): string {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('pt-BR');
}

function normalizeSearchText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

export default function TransportPayrollReportCollaboratorPage() {
    const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [collaboratorQuery, setCollaboratorQuery] = useState('');
    const [collaboratorOptionsOpen, setCollaboratorOptionsOpen] =
        useState(false);
    const [highlightedCollaboratorIndex, setHighlightedCollaboratorIndex] =
        useState<number>(-1);
    const [report, setReport] = useState<ReportResponse | null>(null);
    const [loadingCollaborators, setLoadingCollaborators] = useState(true);
    const [loadingReport, setLoadingReport] = useState(false);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);
    const collaboratorInputRef = useRef<HTMLInputElement | null>(null);

    const sortedCollaborators = useMemo(() => {
        return [...colaboradores].sort((first, second) =>
            first.nome.localeCompare(second.nome, 'pt-BR', {
                sensitivity: 'base',
            }),
        );
    }, [colaboradores]);

    const filteredCollaborators = useMemo(() => {
        const term = normalizeSearchText(collaboratorQuery.trim());

        if (!term) {
            return sortedCollaborators;
        }

        return sortedCollaborators.filter((item) =>
            normalizeSearchText(item.nome).includes(term),
        );
    }, [collaboratorQuery, sortedCollaborators]);

    function openCollaboratorOptions(): void {
        setCollaboratorOptionsOpen(true);
        setHighlightedCollaboratorIndex(
            filteredCollaborators.length > 0 ? 0 : -1,
        );
    }

    function selectCollaborator(item: Colaborador): void {
        setSelectedId(String(item.id));
        setCollaboratorQuery(item.nome);
        setCollaboratorOptionsOpen(false);
        setHighlightedCollaboratorIndex(-1);
        collaboratorInputRef.current?.focus();
    }

    useEffect(() => {
        if (!collaboratorOptionsOpen) {
            return;
        }

        if (filteredCollaborators.length === 0) {
            if (highlightedCollaboratorIndex !== -1) {
                setHighlightedCollaboratorIndex(-1);
            }
            return;
        }

        if (
            highlightedCollaboratorIndex < 0 ||
            highlightedCollaboratorIndex >= filteredCollaborators.length
        ) {
            setHighlightedCollaboratorIndex(0);
        }
    }, [
        collaboratorOptionsOpen,
        filteredCollaborators.length,
        highlightedCollaboratorIndex,
    ]);

    const variationMap = useMemo(() => {
        const map = new Map<string, number | null>();
        report?.variacao_percentual.forEach((item) => {
            map.set(
                `${item.competencia_ano}-${item.competencia_mes}`,
                item.variacao_percentual,
            );
        });
        return map;
    }, [report]);

    async function loadCollaborators(): Promise<void> {
        setLoadingCollaborators(true);
        try {
            const response = await apiGet<PaginatedResponse<Colaborador>>(
                '/registry/colaboradores?active=1&per_page=100',
            );
            setColaboradores(response.data);
        } catch {
            setNotification({
                message: 'Não foi possível carregar colaboradores.',
                variant: 'error',
            });
        } finally {
            setLoadingCollaborators(false);
        }
    }

    async function loadReport(id: string): Promise<void> {
        if (!id) return;
        setLoadingReport(true);
        setNotification(null);

        try {
            const response = await apiGet<ReportResponse>(
                `/payroll/reports/colaborador?colaborador_id=${id}`,
            );
            setReport(response);
        } catch {
            setNotification({
                message:
                    'Não foi possível carregar o relatório do colaborador.',
                variant: 'error',
            });
        } finally {
            setLoadingReport(false);
        }
    }

    useEffect(() => {
        setSelectedId('');
        setCollaboratorQuery('');
        setReport(null);
        loadCollaborators();
    }, []);

    useEffect(() => {
        if (selectedId) {
            void loadReport(selectedId);
        }
    }, [selectedId]);

    return (
        <AdminLayout
            title="Pagamentos - Relatório por Colaborador"
            active="payroll-report-collaborator"
            module="payroll"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">
                        Relatório por Colaborador
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Histórico de pagamentos, evolução, médias e datas
                        importantes.
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
                        <CardTitle>Selecionar colaborador</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-[2fr_auto]">
                            <div className="space-y-2">
                                <Label>Colaborador</Label>
                                <div className="relative">
                                    <Input
                                        ref={collaboratorInputRef}
                                        value={collaboratorQuery}
                                        autoComplete="off"
                                        onFocus={openCollaboratorOptions}
                                        onBlur={() => {
                                            window.setTimeout(() => {
                                                setCollaboratorOptionsOpen(
                                                    false,
                                                );
                                                setHighlightedCollaboratorIndex(
                                                    -1,
                                                );
                                            }, 120);
                                        }}
                                        onChange={(event) => {
                                            setSelectedId('');
                                            setReport(null);
                                            setCollaboratorQuery(
                                                event.target.value,
                                            );
                                            openCollaboratorOptions();
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Escape') {
                                                setCollaboratorOptionsOpen(
                                                    false,
                                                );
                                                setHighlightedCollaboratorIndex(
                                                    -1,
                                                );
                                                return;
                                            }

                                            if (
                                                event.key !== 'ArrowDown' &&
                                                event.key !== 'ArrowUp' &&
                                                event.key !== 'Enter'
                                            ) {
                                                return;
                                            }

                                            if (!collaboratorOptionsOpen) {
                                                openCollaboratorOptions();
                                            }

                                            if (
                                                filteredCollaborators.length ===
                                                0
                                            ) {
                                                return;
                                            }

                                            if (event.key === 'ArrowDown') {
                                                event.preventDefault();
                                                setHighlightedCollaboratorIndex(
                                                    (previous) =>
                                                        Math.min(
                                                            filteredCollaborators.length -
                                                                1,
                                                            previous < 0
                                                                ? 0
                                                                : previous + 1,
                                                        ),
                                                );
                                                return;
                                            }

                                            if (event.key === 'ArrowUp') {
                                                event.preventDefault();
                                                setHighlightedCollaboratorIndex(
                                                    (previous) =>
                                                        Math.max(
                                                            0,
                                                            previous < 0
                                                                ? 0
                                                                : previous - 1,
                                                        ),
                                                );
                                                return;
                                            }

                                            if (
                                                event.key === 'Enter' &&
                                                highlightedCollaboratorIndex >=
                                                    0
                                            ) {
                                                event.preventDefault();
                                                const option =
                                                    filteredCollaborators[
                                                        highlightedCollaboratorIndex
                                                    ];

                                                if (option) {
                                                    selectCollaborator(option);
                                                }
                                            }
                                        }}
                                        placeholder="Digite para buscar colaborador"
                                    />

                                    {collaboratorOptionsOpen ? (
                                        <div className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border shadow-md">
                                            {filteredCollaborators.length === 0 ? (
                                                <p className="px-3 py-2 text-sm text-muted-foreground">
                                                    Nenhum colaborador encontrado.
                                                </p>
                                            ) : (
                                                filteredCollaborators.map(
                                                    (item, index) => (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            className={`w-full px-3 py-2 text-left text-sm ${
                                                                highlightedCollaboratorIndex ===
                                                                index
                                                                    ? 'bg-muted'
                                                                    : 'hover:bg-muted'
                                                            }`}
                                                            onMouseEnter={() =>
                                                                setHighlightedCollaboratorIndex(
                                                                    index,
                                                                )
                                                            }
                                                            onMouseDown={(
                                                                event,
                                                            ) => {
                                                                event.preventDefault();
                                                                selectCollaborator(
                                                                    item,
                                                                );
                                                            }}
                                                        >
                                                            {item.nome}
                                                        </button>
                                                    ),
                                                )
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Lista em ordem alfabética. Digite parte do
                                    nome e clique no colaborador desejado.
                                </p>
                            </div>
                            <div className="flex items-end">
                                <Button
                                    variant="outline"
                                    disabled={!selectedId}
                                    onClick={() => void loadReport(selectedId)}
                                >
                                    Atualizar
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {loadingCollaborators || (loadingReport && !report) ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando relatório...
                    </div>
                ) : report ? (
                    <>
                        {loadingReport ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <LoaderCircle className="size-3 animate-spin" />
                                Atualizando dados...
                            </div>
                        ) : null}
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Total acumulado
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {formatCurrency(report.total_acumulado)}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Total com empréstimos
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {formatCurrency(
                                            report.total_acumulado_com_emprestimo ??
                                                report.total_acumulado,
                                        )}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Média salarial
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-semibold">
                                        {formatCurrency(report.media_salarial)}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Unidade
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg font-semibold">
                                        {report.colaborador.unidade?.nome ??
                                            '-'}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-muted-foreground">
                                        Função
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg font-semibold">
                                        {report.colaborador.funcao?.nome ?? '-'}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        Linha do tempo de pagamentos
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {report.timeline.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Sem pagamentos registrados.
                                        </p>
                                    ) : (
                                        report.timeline.map((item) => {
                                            const variation = variationMap.get(
                                                `${item.competencia_ano}-${item.competencia_mes}`,
                                            );
                                            return (
                                                <div
                                                    key={item.id}
                                                    className="rounded-md border p-3 text-sm"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span>
                                                            {String(
                                                                item.competencia_mes,
                                                            ).padStart(2, '0')}
                                                            /
                                                            {
                                                                item.competencia_ano
                                                            }
                                                        </span>
                                                        <span className="font-semibold">
                                                            {formatCurrency(item.ganho_total ?? item.valor)}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                                                        <span>
                                                            Lançado em:{' '}
                                                            {formatDate(
                                                                item.lancado_em,
                                                            )}
                                                        </span>
                                                        <span>
                                                            Variação:{' '}
                                                            {variation ===
                                                                null ||
                                                            variation ===
                                                                undefined
                                                                ? '-'
                                                                : `${variation}%`}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                        Pagamento: {formatCurrency(item.valor)} | Parcela empréstimo:{' '}
                                                        {formatCurrency(item.parcela_emprestimo ?? 0)}
                                                    </div>
                                                    {item.observacao ? (
                                                        <p className="mt-2 text-xs text-muted-foreground">
                                                            {item.observacao}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            );
                                        })
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Datas importantes</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="rounded-md border p-3">
                                        <p className="text-xs text-muted-foreground">
                                            Data de admissão
                                        </p>
                                        <p className="font-medium">
                                            {formatDate(
                                                report.datas_importantes
                                                    .data_admissao,
                                            )}
                                        </p>
                                    </div>
                                    <div className="rounded-md border p-3">
                                        <p className="text-xs text-muted-foreground">
                                            Data de demissão
                                        </p>
                                        <p className="font-medium">
                                            {formatDate(
                                                report.datas_importantes
                                                    .data_demissao,
                                            )}
                                        </p>
                                    </div>
                                    <div className="rounded-md border p-3">
                                        <p className="text-xs text-muted-foreground">
                                            Data de nascimento
                                        </p>
                                        <p className="font-medium">
                                            {formatDate(
                                                report.datas_importantes
                                                    .data_nascimento,
                                            )}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center gap-2 rounded-md border border-muted-foreground/20 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                        <AlertCircle className="size-4" />
                        Digite o nome do colaborador para carregar o relatório.
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
