import { Link } from '@inertiajs/react';
import { AlertTriangle, CalendarClock, LoaderCircle, PlusCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { RecordCommentsPanel } from '@/components/transport/record-comments-panel';
import { Badge } from '@/components/ui/badge';
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
import { formatDateTimeBR, formatIntegerBR } from '@/lib/transport-format';

interface PendingInsightsResponse {
    data: {
        interviews: {
            waiting_vacancy: number;
            practical_test: number;
            guep_to_do: number;
            total: number;
        };
        vacations: {
            expired: number;
            due_2_months: number;
        };
        freight: {
            canceled_to_receive: number;
        };
        payroll: {
            pending_collaborators: number;
        };
        fines: {
            notifications_pending: number;
            overdue_open: number;
            total: number;
            pending_notifications: Array<{
                id: number;
                title: string;
                subtitle: string;
                status: string;
                href: string;
            }>;
        };
    };
}

interface UnidadeOption {
    id: number;
    nome: string;
}

interface UnidadesResponse {
    data: UnidadeOption[];
}

interface OperationalTask {
    id: number;
    module_key: string;
    unidade_id: number | null;
    unidade_nome: string | null;
    title: string;
    description: string | null;
    priority: 'low' | 'normal' | 'high' | 'critical';
    status: 'open' | 'in_progress' | 'done' | 'canceled';
    due_at: string | null;
    assigned_to_name: string | null;
    created_by_name: string | null;
    sla_state: 'overdue' | 'due_24h' | 'due_72h' | 'without_due_date' | 'on_track' | 'closed';
}

interface OperationalTasksResponse {
    data: OperationalTask[];
}

interface OperationalTaskSummaryResponse {
    summary: {
        total: number;
        by_status: {
            open: number;
            in_progress: number;
            done: number;
            canceled: number;
        };
        sla: {
            overdue: number;
            due_24h: number;
            due_72h: number;
            without_due_date: number;
        };
        high_priority_open: number;
    };
    by_unit: Array<{
        unidade_id: number | null;
        unidade_nome: string;
        total: number;
    }>;
    by_unit_risk: Array<{
        unidade_id: number | null;
        unidade_nome: string;
        total_open: number;
        overdue: number;
        due_24h: number;
        critical: number;
        high: number;
        risk_score: number;
    }>;
    alerts: Array<{
        severity: 'critical' | 'warning' | 'info';
        code: string;
        title: string;
        message: string;
        count: number;
    }>;
}

interface PendingByUnitResponse {
    data: Array<{
        unidade_id: number;
        unidade_nome: string;
        active_collaborators: number;
        payroll_pending_collaborators: number;
        freight_canceled_to_receive: number;
        fines_notifications_pending: number;
        onboarding_open: number;
        onboarding_overdue: number;
    }>;
}

interface TaskFormState {
    title: string;
    due_at: string;
    priority: 'normal' | 'high' | 'critical';
    module_key: string;
    unidade_id: string;
}

const emptyTaskForm: TaskFormState = {
    title: '',
    due_at: '',
    priority: 'normal',
    module_key: 'operations',
    unidade_id: 'none',
};

function PendingCard({
    title,
    description,
    value,
}: {
    title: string;
    description: string;
    value: number;
}) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
                <p className="text-xs text-muted-foreground">{description}</p>
            </CardHeader>
            <CardContent>
                <p className="text-2xl font-semibold">{formatIntegerBR(value)}</p>
            </CardContent>
        </Card>
    );
}

function priorityBadgeVariant(priority: OperationalTask['priority']): 'secondary' | 'default' | 'destructive' | 'outline' {
    if (priority === 'critical') return 'destructive';
    if (priority === 'high') return 'default';
    if (priority === 'low') return 'outline';
    return 'secondary';
}

function priorityLabel(priority: OperationalTask['priority']): string {
    if (priority === 'critical') return 'Critica';
    if (priority === 'high') return 'Alta';
    if (priority === 'low') return 'Baixa';
    return 'Normal';
}

function slaLabel(slaState: OperationalTask['sla_state']): string {
    if (slaState === 'overdue') return 'SLA vencido';
    if (slaState === 'due_24h') return 'Vence em 24h';
    if (slaState === 'due_72h') return 'Vence em 72h';
    if (slaState === 'without_due_date') return 'Sem prazo';
    if (slaState === 'on_track') return 'No prazo';
    return 'Concluida';
}

export default function TransportOperationsHubPage() {
    const [loading, setLoading] = useState(true);
    const [savingTask, setSavingTask] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);
    const [data, setData] = useState<PendingInsightsResponse['data'] | null>(null);
    const [taskSummary, setTaskSummary] = useState<OperationalTaskSummaryResponse | null>(null);
    const [tasks, setTasks] = useState<OperationalTask[]>([]);
    const [unidades, setUnidades] = useState<UnidadeOption[]>([]);
    const [pendingByUnit, setPendingByUnit] = useState<PendingByUnitResponse['data']>([]);
    const [taskForm, setTaskForm] = useState<TaskFormState>(emptyTaskForm);
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

    async function loadHub(): Promise<void> {
        setLoading(true);
        setError(null);

        try {
            const [pendingResponse, summaryResponse, tasksResponse, unidadesResponse, pendingByUnitResponse] = await Promise.all([
                apiGet<PendingInsightsResponse>('/insights/pending'),
                apiGet<OperationalTaskSummaryResponse>('/operations/tasks/summary'),
                apiGet<OperationalTasksResponse>('/operations/tasks?status=open&per_page=8'),
                apiGet<UnidadesResponse>('/registry/unidades'),
                apiGet<PendingByUnitResponse>('/insights/pending-by-unit'),
            ]);

            setData(pendingResponse.data);
            setTaskSummary(summaryResponse);
            setTasks(tasksResponse.data);
            setUnidades(unidadesResponse.data);
            setPendingByUnit(pendingByUnitResponse.data);

            setSelectedTaskId((current) => {
                if (tasksResponse.data.length === 0) {
                    return null;
                }

                if (current && tasksResponse.data.some((task) => task.id === current)) {
                    return current;
                }

                return tasksResponse.data[0]?.id ?? null;
            });
        } catch {
            setError('Nao foi possivel carregar o hub operacional.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadHub();
    }, []);

    const totalPending = useMemo(() => {
        if (!data) return 0;

        return (
            data.interviews.total
            + data.vacations.expired
            + data.vacations.due_2_months
            + data.freight.canceled_to_receive
            + data.payroll.pending_collaborators
            + data.fines.total
            + (taskSummary?.summary.by_status.open ?? 0)
            + (taskSummary?.summary.by_status.in_progress ?? 0)
        );
    }, [data, taskSummary]);

    const pendingCards = useMemo(() => {
        if (!data) return [];

        return [
            {
                title: 'Entrevistas pendentes',
                description: 'Candidatos aguardando avance no funil.',
                value: data.interviews.total,
            },
            {
                title: 'Ferias vencidas',
                description: 'Periodos vencidos sem lancamento.',
                value: data.vacations.expired,
            },
            {
                title: 'Ferias ate 2 meses',
                description: 'Janela proxima para programacao.',
                value: data.vacations.due_2_months,
            },
            {
                title: 'Cargas a receber',
                description: 'Cargas canceladas aguardando recebimento.',
                value: data.freight.canceled_to_receive,
            },
            {
                title: 'Folha sem lancamento',
                description: 'Colaboradores ativos sem pagamento no mes.',
                value: data.payroll.pending_collaborators,
            },
            {
                title: 'Multas e notificacoes',
                description: 'Pendencias de notificacoes e multas em aberto.',
                value: data.fines.total,
            },
            {
                title: 'GUEP a fazer',
                description: 'Entrevistas com GUEP pendente.',
                value: data.interviews.guep_to_do,
            },
        ];
    }, [data]);

    const riskByUnit = useMemo(() => {
        const map = new Map<number, { riskScore: number; overdue: number; due24h: number }>();

        if (!taskSummary) {
            return map;
        }

        for (const row of taskSummary.by_unit_risk ?? []) {
            if (row.unidade_id === null) {
                continue;
            }

            map.set(row.unidade_id, {
                riskScore: row.risk_score,
                overdue: row.overdue,
                due24h: row.due_24h,
            });
        }

        return map;
    }, [taskSummary]);

    const pendingByUnitOrdered = useMemo(() => {
        return [...pendingByUnit].sort((first, second) => {
            const riskFirst = riskByUnit.get(first.unidade_id)?.riskScore ?? 0;
            const riskSecond = riskByUnit.get(second.unidade_id)?.riskScore ?? 0;

            const firstTotal =
                first.payroll_pending_collaborators
                + first.freight_canceled_to_receive
                + first.fines_notifications_pending
                + first.onboarding_open
                + (first.onboarding_overdue * 2);
            const secondTotal =
                second.payroll_pending_collaborators
                + second.freight_canceled_to_receive
                + second.fines_notifications_pending
                + second.onboarding_open
                + (second.onboarding_overdue * 2);

            if (riskSecond !== riskFirst) {
                return riskSecond - riskFirst;
            }

            return secondTotal - firstTotal;
        });
    }, [pendingByUnit, riskByUnit]);

    async function handleCreateTask(): Promise<void> {
        if (!taskForm.title.trim()) {
            setNotification({
                message: 'Informe um titulo para a tarefa.',
                variant: 'info',
            });
            return;
        }

        setSavingTask(true);
        setNotification(null);

        try {
            await apiPost('/operations/tasks', {
                title: taskForm.title.trim(),
                due_at: taskForm.due_at ? taskForm.due_at : null,
                priority: taskForm.priority,
                module_key: taskForm.module_key,
                unidade_id: taskForm.unidade_id === 'none' ? null : Number(taskForm.unidade_id),
            });

            setNotification({
                message: 'Tarefa operacional criada com sucesso.',
                variant: 'success',
            });
            setTaskForm(emptyTaskForm);
            await loadHub();
        } catch (requestError) {
            if (requestError instanceof ApiError) {
                setNotification({
                    message: requestError.message,
                    variant: 'error',
                });
            } else {
                setNotification({
                    message: 'Nao foi possivel criar a tarefa operacional.',
                    variant: 'error',
                });
            }
        } finally {
            setSavingTask(false);
        }
    }

    return (
        <AdminLayout title="Pendencias" active="operations-hub" module="home">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Pendencias</h2>
                    <p className="text-sm text-muted-foreground">
                        Central de pendencias criticas, tarefas com SLA e prioridades por unidade.
                    </p>
                </div>

                {error ? <Notification message={error} variant="error" /> : null}
                {notification ? <Notification message={notification.message} variant={notification.variant} /> : null}

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando pendencias...
                    </div>
                ) : data && taskSummary ? (
                    <>
                        <div className="grid gap-4 md:grid-cols-3">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Total de pendencias</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-semibold">{formatIntegerBR(totalPending)}</p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Tarefas abertas</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1">
                                    <p className="text-3xl font-semibold">
                                        {formatIntegerBR(taskSummary.summary.by_status.open + taskSummary.summary.by_status.in_progress)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatIntegerBR(taskSummary.summary.high_priority_open)} com prioridade alta/critica.
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>SLA em risco</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1">
                                    <p className="text-3xl font-semibold">
                                        {formatIntegerBR(taskSummary.summary.sla.overdue + taskSummary.summary.sla.due_24h)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatIntegerBR(taskSummary.summary.sla.overdue)} vencidas e {formatIntegerBR(taskSummary.summary.sla.due_24h)} vencendo em 24h.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {pendingCards.map((item) => (
                                <PendingCard
                                    key={item.title}
                                    title={item.title}
                                    description={item.description}
                                    value={item.value}
                                />
                            ))}
                        </div>

                        <div className="grid gap-4 lg:grid-cols-3">
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle>Nova tarefa operacional</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="space-y-2 md:col-span-2">
                                            <Label htmlFor="task-title">Titulo</Label>
                                            <Input
                                                id="task-title"
                                                value={taskForm.title}
                                                onChange={(event) =>
                                                    setTaskForm((previous) => ({
                                                        ...previous,
                                                        title: event.target.value,
                                                    }))
                                                }
                                                placeholder="Ex.: Revisar pagamentos pendentes da unidade"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Modulo</Label>
                                            <Select
                                                value={taskForm.module_key}
                                                onValueChange={(value) =>
                                                    setTaskForm((previous) => ({
                                                        ...previous,
                                                        module_key: value,
                                                    }))
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="operations">Operacoes</SelectItem>
                                                    <SelectItem value="payroll">Pagamentos</SelectItem>
                                                    <SelectItem value="vacations">Ferias</SelectItem>
                                                    <SelectItem value="freight">Fretes</SelectItem>
                                                    <SelectItem value="interviews">Entrevistas</SelectItem>
                                                    <SelectItem value="programming">Programacao</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Prioridade</Label>
                                            <Select
                                                value={taskForm.priority}
                                                onValueChange={(value) =>
                                                    setTaskForm((previous) => ({
                                                        ...previous,
                                                        priority: value as TaskFormState['priority'],
                                                    }))
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="normal">Normal</SelectItem>
                                                    <SelectItem value="high">Alta</SelectItem>
                                                    <SelectItem value="critical">Critica</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Unidade</Label>
                                            <Select
                                                value={taskForm.unidade_id}
                                                onValueChange={(value) =>
                                                    setTaskForm((previous) => ({
                                                        ...previous,
                                                        unidade_id: value,
                                                    }))
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Sem unidade</SelectItem>
                                                    {unidades.map((unidade) => (
                                                        <SelectItem key={unidade.id} value={String(unidade.id)}>
                                                            {unidade.nome}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="task-due-at">Prazo (SLA)</Label>
                                            <Input
                                                id="task-due-at"
                                                type="datetime-local"
                                                value={taskForm.due_at}
                                                onChange={(event) =>
                                                    setTaskForm((previous) => ({
                                                        ...previous,
                                                        due_at: event.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end">
                                        <Button type="button" onClick={() => void handleCreateTask()} disabled={savingTask}>
                                            {savingTask ? (
                                                <>
                                                    <LoaderCircle className="size-4 animate-spin" />
                                                    Salvando...
                                                </>
                                            ) : (
                                                <>
                                                    <PlusCircle className="size-4" />
                                                    Criar tarefa
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Leitura de SLA</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between rounded-md border p-2">
                                        <span className="text-muted-foreground">SLA vencido</span>
                                        <span className="font-semibold text-destructive">{formatIntegerBR(taskSummary.summary.sla.overdue)}</span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md border p-2">
                                        <span className="text-muted-foreground">Vencendo em 24h</span>
                                        <span className="font-semibold">{formatIntegerBR(taskSummary.summary.sla.due_24h)}</span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md border p-2">
                                        <span className="text-muted-foreground">Vencendo em 72h</span>
                                        <span className="font-semibold">{formatIntegerBR(taskSummary.summary.sla.due_72h)}</span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md border p-2">
                                        <span className="text-muted-foreground">Sem prazo</span>
                                        <span className="font-semibold">{formatIntegerBR(taskSummary.summary.sla.without_due_date)}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-3">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Alertas automaticos</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {(taskSummary.alerts ?? []).length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Sem alertas ativos no momento.</p>
                                    ) : (
                                        (taskSummary.alerts ?? []).map((alert) => (
                                            <div
                                                key={alert.code}
                                                className={`rounded-md border p-3 text-sm ${
                                                    alert.severity === 'critical'
                                                        ? 'border-destructive/50 bg-destructive/5'
                                                        : alert.severity === 'warning'
                                                            ? 'border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/20'
                                                            : 'border-muted'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="font-semibold">{alert.title}</p>
                                                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'outline'}>
                                                        {formatIntegerBR(alert.count)}
                                                    </Badge>
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">{alert.message}</p>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Notificacoes de multas pendentes</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {(data.fines.pending_notifications ?? []).length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Sem notificacoes pendentes no momento.</p>
                                    ) : (
                                        data.fines.pending_notifications.map((item) => (
                                            <div key={item.id} className="rounded-md border p-3 text-sm">
                                                <p className="font-medium">{item.title}</p>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {item.subtitle || 'Sem contexto adicional.'}
                                                </p>
                                                <div className="mt-2 flex items-center justify-between gap-2">
                                                    <Badge variant="outline">{item.status}</Badge>
                                                    <Button size="sm" variant="outline" asChild>
                                                        <Link href={item.href}>Abrir</Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    <Button type="button" variant="outline" className="w-full" asChild>
                                        <Link href="/transport/fines/list">Ir para multas</Link>
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Tarefas abertas e em execucao</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {tasks.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Sem tarefas abertas no momento.</p>
                                    ) : (
                                        tasks.map((task) => (
                                            <div key={task.id} className="rounded-md border p-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <p className="text-sm font-semibold">{task.title}</p>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant={priorityBadgeVariant(task.priority)}>{priorityLabel(task.priority)}</Badge>
                                                        <Badge variant={task.sla_state === 'overdue' ? 'destructive' : 'outline'}>
                                                            {slaLabel(task.sla_state)}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                                                    <p>Modulo: {task.module_key}</p>
                                                    <p>Unidade: {task.unidade_nome ?? 'Sem unidade'}</p>
                                                    <p>Responsavel: {task.assigned_to_name ?? task.created_by_name ?? 'Nao definido'}</p>
                                                    <p>
                                                        Prazo:{' '}
                                                        {task.due_at ? formatDateTimeBR(task.due_at) : 'Sem prazo definido'}
                                                    </p>
                                                </div>
                                                <div className="mt-3 flex justify-end">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant={selectedTaskId === task.id ? 'default' : 'outline'}
                                                        onClick={() => setSelectedTaskId(task.id)}
                                                    >
                                                        Comentarios
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}

                                    <RecordCommentsPanel
                                        moduleKey="operations"
                                        recordId={selectedTaskId}
                                        title="Comentarios da tarefa selecionada"
                                    />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Centro de pendencias por unidade</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {pendingByUnitOrdered.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Sem pendencias classificadas por unidade.</p>
                                    ) : (
                                        pendingByUnitOrdered.map((row) => {
                                            const risk = riskByUnit.get(row.unidade_id);
                                            const totalPending =
                                                row.payroll_pending_collaborators
                                                + row.freight_canceled_to_receive
                                                + row.fines_notifications_pending
                                                + row.onboarding_open;

                                            return (
                                                <div key={`unit-${row.unidade_id}`} className="rounded-md border p-3 text-sm">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-medium">{row.unidade_nome}</span>
                                                        <div className="flex items-center gap-2">
                                                            {risk ? (
                                                                <Badge variant={risk.overdue > 0 ? 'destructive' : 'outline'}>
                                                                    Criticidade {formatIntegerBR(risk.riskScore)}
                                                                </Badge>
                                                            ) : null}
                                                            <span className="font-semibold">{formatIntegerBR(totalPending)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                                                        <p>Folha pendente: {formatIntegerBR(row.payroll_pending_collaborators)}</p>
                                                        <p>Cargas a receber: {formatIntegerBR(row.freight_canceled_to_receive)}</p>
                                                        <p>Notificacoes de multa: {formatIntegerBR(row.fines_notifications_pending)}</p>
                                                        <p>Onboarding em aberto: {formatIntegerBR(row.onboarding_open)}</p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}

                                    {(taskSummary.summary.sla.overdue > 0 || taskSummary.summary.high_priority_open > 0) ? (
                                        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="mt-0.5 size-4" />
                                                <p>
                                                    Existem {formatIntegerBR(taskSummary.summary.sla.overdue)} tarefa(s) com SLA vencido e{' '}
                                                    {formatIntegerBR(taskSummary.summary.high_priority_open)} tarefa(s) de alta prioridade em aberto.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-3 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                                            <div className="flex items-start gap-2">
                                                <CalendarClock className="mt-0.5 size-4" />
                                                <p>Sem alertas criticos de SLA neste momento.</p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </>
                ) : null}
            </div>
        </AdminLayout>
    );
}
