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

interface Unidade {
    id: number;
    nome: string;
}

interface LaunchCandidate {
    id: number;
    nome: string;
    cpf: string;
    unidade?: Unidade;
    pagamento_existente: {
        id: number;
        valor: number;
    } | null;
}

interface LaunchResponse {
    competencia_mes: number;
    competencia_ano: number;
    data: LaunchCandidate[];
}

interface WrappedResponse<T> {
    data: T;
}

function formatCurrency(value: number | string): string {
    const numeric = typeof value === 'string' ? Number(value) : value;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(Number.isFinite(numeric) ? numeric : 0);
}

export default function TransportPayrollLaunchPage() {
    const currentYear = new Date().getFullYear();
    const [month, setMonth] = useState(String(new Date().getMonth() + 1));
    const [year, setYear] = useState(String(currentYear));
    const [unidadeId, setUnidadeId] = useState('');

    const [unidades, setUnidades] = useState<Unidade[]>([]);
    const [candidates, setCandidates] = useState<LaunchCandidate[]>([]);
    const [values, setValues] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(true);
    const [loadingCandidates, setLoadingCandidates] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const monthOptions = useMemo(
        () => [
            { value: '1', label: 'Janeiro' },
            { value: '2', label: 'Fevereiro' },
            { value: '3', label: 'Março' },
            { value: '4', label: 'Abril' },
            { value: '5', label: 'Maio' },
            { value: '6', label: 'Junho' },
            { value: '7', label: 'Julho' },
            { value: '8', label: 'Agosto' },
            { value: '9', label: 'Setembro' },
            { value: '10', label: 'Outubro' },
            { value: '11', label: 'Novembro' },
            { value: '12', label: 'Dezembro' },
        ],
        [],
    );

    const yearOptions = useMemo(
        () => [
            String(currentYear - 1),
            String(currentYear),
            String(currentYear + 1),
        ],
        [currentYear],
    );

    async function loadUnidades(): Promise<void> {
        setLoading(true);
        try {
            const response =
                await apiGet<WrappedResponse<Unidade[]>>('/registry/unidades');
            setUnidades(response.data);
            if (!unidadeId && response.data.length > 0) {
                setUnidadeId(String(response.data[0].id));
            }
        } catch {
            setNotification({
                message: 'Não foi possível carregar as unidades.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    async function loadCandidates(): Promise<void> {
        if (!unidadeId) return;

        setLoadingCandidates(true);
        setNotification(null);

        try {
            const response = await apiGet<LaunchResponse>(
                `/payroll/launch-candidates?unidade_id=${unidadeId}&competencia_mes=${month}&competencia_ano=${year}`,
            );
            setCandidates(response.data);
            setValues({});
        } catch {
            setNotification({
                message:
                    'Não foi possível carregar os colaboradores da unidade.',
                variant: 'error',
            });
        } finally {
            setLoadingCandidates(false);
        }
    }

    useEffect(() => {
        loadUnidades();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (unidadeId) {
            void loadCandidates();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unidadeId, month, year]);

    function setValue(id: number, value: string): void {
        setValues((previous) => ({
            ...previous,
            [id]: value,
        }));
    }

    async function handleLaunch(): Promise<void> {
        const pagamentos = candidates
            .filter((item) => !item.pagamento_existente)
            .map((item) => ({
                colaborador_id: item.id,
                valor: values[item.id],
            }))
            .filter((item) => item.valor && Number(item.valor) > 0);

        if (pagamentos.length === 0) {
            setNotification({
                message: 'Preencha ao menos um valor para lançar pagamentos.',
                variant: 'info',
            });
            return;
        }

        setSaving(true);
        setNotification(null);

        try {
            const response = await apiPost<{ created_count: number }>(
                '/payroll/launch-batch',
                {
                    unidade_id: Number(unidadeId),
                    competencia_mes: Number(month),
                    competencia_ano: Number(year),
                    pagamentos,
                },
            );

            setNotification({
                message: `${response.created_count} pagamento(s) lançado(s) com sucesso.`,
                variant: 'success',
            });
            await loadCandidates();
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
                    message: 'Não foi possível lançar os pagamentos.',
                    variant: 'error',
                });
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminLayout
            title="Salários - Lançar Pagamentos"
            active="payroll-launch"
            module="payroll"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">
                        Lançar Pagamentos
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Selecione unidade, mês e ano para lançar pagamentos em
                        lote sem duplicidade.
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
                        <CardTitle>Filtros</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label>Unidade</Label>
                                <Select
                                    value={unidadeId}
                                    onValueChange={setUnidadeId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {unidades.map((unidade) => (
                                            <SelectItem
                                                key={unidade.id}
                                                value={String(unidade.id)}
                                            >
                                                {unidade.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Mês</Label>
                                <Select value={month} onValueChange={setMonth}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {monthOptions.map((item) => (
                                            <SelectItem
                                                key={item.value}
                                                value={item.value}
                                            >
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Ano</Label>
                                <Select value={year} onValueChange={setYear}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {yearOptions.map((item) => (
                                            <SelectItem key={item} value={item}>
                                                {item}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Colaboradores Ativos da Unidade</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading || loadingCandidates ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando colaboradores...
                            </div>
                        ) : candidates.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Nenhum colaborador ativo encontrado.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {candidates.map((item) => (
                                    <div
                                        key={item.id}
                                        className="grid gap-2 rounded-md border p-3 md:grid-cols-[2fr_1fr_1fr_1fr] md:items-end"
                                    >
                                        <div>
                                            <p className="font-medium">
                                                {item.nome}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                CPF: {item.cpf}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">
                                                Unidade
                                            </p>
                                            <p className="text-sm">
                                                {item.unidade?.nome ?? '-'}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor={`valor-${item.id}`}>
                                                Valor
                                            </Label>
                                            <Input
                                                id={`valor-${item.id}`}
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={values[item.id] ?? ''}
                                                onChange={(event) =>
                                                    setValue(
                                                        item.id,
                                                        event.target.value,
                                                    )
                                                }
                                                disabled={Boolean(
                                                    item.pagamento_existente,
                                                )}
                                            />
                                        </div>
                                        <div>
                                            {item.pagamento_existente ? (
                                                <p className="text-xs text-muted-foreground">
                                                    Já lançado:{' '}
                                                    {formatCurrency(
                                                        item.pagamento_existente
                                                            .valor,
                                                    )}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">
                                                    Pronto para lançar
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        onClick={() => void handleLaunch()}
                                        disabled={saving}
                                    >
                                        {saving ? (
                                            <>
                                                <LoaderCircle className="size-4 animate-spin" />
                                                Lançando...
                                            </>
                                        ) : (
                                            'Lançar Pagamentos'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
