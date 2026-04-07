import { LoaderCircle } from 'lucide-react';
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
import { ApiError, apiGet, apiPost } from '@/lib/api-client';

interface WrappedResponse<T> {
    data: T;
}

interface VacationRow {
    colaborador_id: number;
    nome: string;
    periodo_aquisitivo_inicio: string;
    periodo_aquisitivo_fim: string;
    direito: string;
    limite: string;
}

function formatDate(date: string): string {
    const [year, month, day] = date.split('-');
    if (!year || !month || !day) return date;
    return `${day}/${month}/${year}`;
}

function addDays(baseDate: string, days: number): string {
    if (!baseDate) return '';

    const date = new Date(`${baseDate}T12:00:00`);

    if (isNaN(date.getTime())) return '';

    date.setDate(date.getDate() + days);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

export default function VacationsLaunchPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [candidates, setCandidates] = useState<VacationRow[]>([]);

    const [selectedCollaboratorId, setSelectedCollaboratorId] = useState('');
    const [collaboratorQuery, setCollaboratorQuery] = useState('');
    const [collaboratorDropdownOpen, setCollaboratorDropdownOpen] = useState(false);
    const [tipo, setTipo] = useState<'confirmado' | 'previsao' | 'passada'>('confirmado');
    const [comAbono, setComAbono] = useState(true);
    const [diasFerias, setDiasFerias] = useState<20 | 30>(20);
    const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
    const [periodoAquisitivoInicio, setPeriodoAquisitivoInicio] = useState('');
    const [periodoAquisitivoFim, setPeriodoAquisitivoFim] = useState('');
    const [observacoes, setObservacoes] = useState('');

    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const selectedCandidate = useMemo(
        () =>
            candidates.find(
                (item) => String(item.colaborador_id) === selectedCollaboratorId,
            ) ?? null,
        [candidates, selectedCollaboratorId],
    );

    const sortedCandidates = useMemo(
        () =>
            [...candidates].sort((a, b) =>
                a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
            ),
        [candidates],
    );

    const filteredCandidates = useMemo(() => {
        const normalizedQuery = collaboratorQuery.trim().toLocaleLowerCase('pt-BR');

        if (normalizedQuery.length === 0) {
            return sortedCandidates.slice(0, 20);
        }

        return sortedCandidates
            .filter((item) =>
                item.nome.toLocaleLowerCase('pt-BR').includes(normalizedQuery),
            )
            .slice(0, 20);
    }, [collaboratorQuery, sortedCandidates]);

    const dataFimCalculada = useMemo(
        () => addDays(dataInicio, diasFerias - 1),
        [dataInicio, diasFerias],
    );

    useEffect(() => {
        setLoading(true);

        apiGet<WrappedResponse<VacationRow[]>>('/payroll/vacations/candidates')
            .then((response) => setCandidates(response.data))
            .catch(() => {
                setNotification({
                    message: 'Não foi possível carregar colaboradores para férias.',
                    variant: 'error',
                });
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!selectedCandidate) return;

        setPeriodoAquisitivoInicio(selectedCandidate.periodo_aquisitivo_inicio);
        setPeriodoAquisitivoFim(selectedCandidate.periodo_aquisitivo_fim);
        setCollaboratorQuery(selectedCandidate.nome);
    }, [selectedCandidate]);

    useEffect(() => {
        if (!periodoAquisitivoInicio) {
            setPeriodoAquisitivoFim('');
            return;
        }

        setPeriodoAquisitivoFim(addDays(periodoAquisitivoInicio, 364));
    }, [periodoAquisitivoInicio]);

    useEffect(() => {
        if (selectedCollaboratorId && !selectedCandidate) {
            setSelectedCollaboratorId('');
        }
    }, [selectedCandidate, selectedCollaboratorId]);

    async function handleLaunch(): Promise<void> {
        if (!selectedCollaboratorId) {
            setNotification({
                message: 'Selecione um colaborador para lançar férias.',
                variant: 'info',
            });
            return;
        }

        if (!dataInicio || !periodoAquisitivoInicio || !periodoAquisitivoFim) {
            setNotification({
                message: 'Preencha data de início e período aquisitivo.',
                variant: 'info',
            });
            return;
        }

        setSaving(true);
        setNotification(null);

        try {
            await apiPost('/payroll/vacations', {
                colaborador_id: Number(selectedCollaboratorId),
                tipo,
                com_abono: comAbono,
                dias_ferias: diasFerias,
                data_inicio: dataInicio,
                data_fim: dataFimCalculada,
                periodo_aquisitivo_inicio: periodoAquisitivoInicio,
                periodo_aquisitivo_fim: periodoAquisitivoFim,
                observacoes: observacoes.trim() || null,
            });

            setNotification({
                message: 'Férias lançadas com sucesso.',
                variant: 'success',
            });

            const refreshed = await apiGet<WrappedResponse<VacationRow[]>>('/payroll/vacations/candidates');
            setCandidates(refreshed.data);

            setSelectedCollaboratorId('');
            setCollaboratorQuery('');
            setTipo('confirmado');
            setPeriodoAquisitivoInicio('');
            setPeriodoAquisitivoFim('');
            setDataInicio(new Date().toISOString().slice(0, 10));
            setComAbono(true);
            setDiasFerias(20);
            setObservacoes('');
        } catch (error) {
            if (error instanceof ApiError) {
                const firstError = error.errors
                    ? Object.values(error.errors)[0]?.[0]
                    : null;

                setNotification({
                    message: firstError ?? error.message,
                    variant: 'error',
                });
            } else {
                setNotification({
                    message: 'Não foi possível lançar férias.',
                    variant: 'error',
                });
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminLayout
            title="Controle de Férias - Lançar"
            active="vacations-launch"
            module="vacations"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Controle de Férias - Lançar</h2>
                    <p className="text-sm text-muted-foreground">
                        Lançamento com cálculo automático de data fim e fim do período aquisitivo.
                    </p>
                </div>

                {notification ? (
                    <Notification message={notification.message} variant={notification.variant} />
                ) : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Lançar Férias</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando colaboradores...
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <Label>Nome *</Label>
                                    <div className="relative">
                                        <Input
                                            value={collaboratorQuery}
                                            placeholder="Digite para buscar colaborador"
                                            onFocus={() => setCollaboratorDropdownOpen(true)}
                                            onChange={(event) => {
                                                const nextValue = event.target.value;
                                                setCollaboratorQuery(nextValue);
                                                setCollaboratorDropdownOpen(true);

                                                const exactMatch = sortedCandidates.find(
                                                    (item) =>
                                                        item.nome.toLocaleLowerCase('pt-BR') ===
                                                        nextValue.trim().toLocaleLowerCase('pt-BR'),
                                                );

                                                setSelectedCollaboratorId(
                                                    exactMatch
                                                        ? String(exactMatch.colaborador_id)
                                                        : '',
                                                );
                                            }}
                                            onBlur={() => {
                                                window.setTimeout(() => {
                                                    setCollaboratorDropdownOpen(false);
                                                }, 150);
                                            }}
                                        />

                                        {collaboratorDropdownOpen ? (
                                            <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-background shadow-md">
                                                {filteredCandidates.length > 0 ? (
                                                    filteredCandidates.map((item) => (
                                                        <button
                                                            key={item.colaborador_id}
                                                            type="button"
                                                            className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-muted"
                                                            onMouseDown={(event) => {
                                                                event.preventDefault();
                                                                setSelectedCollaboratorId(
                                                                    String(item.colaborador_id),
                                                                );
                                                                setCollaboratorQuery(item.nome);
                                                                setCollaboratorDropdownOpen(false);
                                                            }}
                                                        >
                                                            {item.nome}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <p className="px-3 py-2 text-sm text-muted-foreground">
                                                        Nenhum colaborador encontrado.
                                                    </p>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Tipo</Label>
                                        <Select
                                            value={tipo}
                                            onValueChange={(value: 'confirmado' | 'previsao' | 'passada') =>
                                                setTipo(value)
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="confirmado">Confirmado</SelectItem>
                                                <SelectItem value="previsao">Previsão</SelectItem>
                                                <SelectItem value="passada">Passada</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Dias de férias</Label>
                                        <Select
                                            value={String(diasFerias)}
                                            onValueChange={(value) => {
                                                const nextDays = value === '30' ? 30 : 20;
                                                setDiasFerias(nextDays);
                                                setComAbono(nextDays === 20);
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="20">20 dias</SelectItem>
                                                <SelectItem value="30">30 dias</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Abono</Label>
                                        <Select
                                            value={comAbono ? 'sim' : 'nao'}
                                            onValueChange={(value) => {
                                                const nextComAbono = value === 'sim';
                                                setComAbono(nextComAbono);
                                                setDiasFerias(nextComAbono ? 20 : 30);
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="sim">Sim (20 dias)</SelectItem>
                                                <SelectItem value="nao">Não (30 dias)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="ferias-inicio">Dará início</Label>
                                        <Input
                                            id="ferias-inicio"
                                            type="date"
                                            value={dataInicio}
                                            onChange={(event) =>
                                                setDataInicio(event.target.value)
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="ferias-fim">Data fim (automática)</Label>
                                        <Input
                                            id="ferias-fim"
                                            type="date"
                                            value={dataFimCalculada}
                                            readOnly
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="periodo-inicio">Período aquisitivo início</Label>
                                        <Input
                                            id="periodo-inicio"
                                            type="date"
                                            value={periodoAquisitivoInicio}
                                            onChange={(event) =>
                                                setPeriodoAquisitivoInicio(event.target.value)
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="periodo-fim">Período aquisitivo fim</Label>
                                        <Input
                                            id="periodo-fim"
                                            type="date"
                                            value={periodoAquisitivoFim}
                                            readOnly
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="ferias-observacoes">Observações</Label>
                                    <textarea
                                        id="ferias-observacoes"
                                        className="border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex min-h-24 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                        value={observacoes}
                                        onChange={(event) => setObservacoes(event.target.value)}
                                        placeholder="Observação opcional para aparecer no histórico de férias do cadastro"
                                    />
                                </div>

                                {selectedCandidate ? (
                                    <p className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                                        Direito atual: {formatDate(selectedCandidate.direito)} • Limite atual: {formatDate(selectedCandidate.limite)}
                                    </p>
                                ) : null}

                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        onClick={() => void handleLaunch()}
                                        disabled={saving}
                                    >
                                        {saving ? (
                                            <>
                                                <LoaderCircle className="size-4 animate-spin" />
                                                Salvando...
                                            </>
                                        ) : (
                                            'Lançar Férias'
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
