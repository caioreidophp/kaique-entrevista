import { Download, LoaderCircle, Moon, Play, RefreshCw, Sun, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppearance } from '@/hooks/use-appearance';
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';
import { getAuthToken } from '@/lib/transport-auth';
import {
    getStoredTransportLanguage,
    setStoredTransportLanguage,
    type TransportLanguage,
} from '@/lib/transport-language';
import { getStoredUser } from '@/lib/transport-session';

interface IntegrationSummary {
    hooksTotal: number;
    hooksActive: number;
    deliveries24h: number;
    failures24h: number;
    remindersSent24h: number;
    remindersFailed24h: number;
}

interface WebhookRow {
    id: number;
    name: string;
    target_url: string;
    is_active: boolean;
    deliveries_last_24h?: number;
    deliveries_failed_last_24h?: number;
}

interface ReminderRuleRow {
    id: number;
    name: string;
    trigger_key: 'vacations_due' | 'task_sla_overdue';
    channel: 'email' | 'whatsapp';
    recipients: string[];
    threshold_days: number;
    webhook_url: string | null;
    is_active: boolean;
    sent_last_7d?: number;
    failed_last_7d?: number;
}

interface ReminderDeliveryRow {
    id: number;
    trigger_key: string;
    channel: string;
    recipient: string;
    status: 'sent' | 'failed';
    created_at: string;
}

export default function TransportSettingsPage() {
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const currentUser = getStoredUser();
    const isMasterAdmin = currentUser?.role === 'master_admin';
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [language, setLanguage] = useState<TransportLanguage>(() =>
        getStoredTransportLanguage(),
    );
    const [savingPassword, setSavingPassword] = useState(false);
    const [downloadingBackup, setDownloadingBackup] = useState(false);
    const [runningReminders, setRunningReminders] = useState(false);
    const [loadingIntegrations, setLoadingIntegrations] = useState(false);
    const [savingRule, setSavingRule] = useState(false);
    const [integrationSummary, setIntegrationSummary] = useState<IntegrationSummary | null>(null);
    const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
    const [reminderRules, setReminderRules] = useState<ReminderRuleRow[]>([]);
    const [reminderDeliveries, setReminderDeliveries] = useState<ReminderDeliveryRow[]>([]);
    const [ruleForm, setRuleForm] = useState({
        name: '',
        trigger_key: 'vacations_due' as 'vacations_due' | 'task_sla_overdue',
        channel: 'email' as 'email' | 'whatsapp',
        recipients: '',
        threshold_days: 30,
        webhook_url: '',
        message_prefix: '',
    });
    const [message, setMessage] = useState<{
        text: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSavingPassword(true);
        setMessage(null);

        try {
            await apiPut<{ message: string }>('/settings/password', {
                current_password: currentPassword,
                password: newPassword,
                password_confirmation: confirmPassword,
            });

            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setMessage({
                text: 'Senha alterada com sucesso.',
                variant: 'success',
            });
        } catch (error) {
            if (error instanceof ApiError) {
                const firstError = error.errors ? Object.values(error.errors)[0]?.[0] : null;

                setMessage({
                    text: firstError ?? error.message ?? 'Não foi possível alterar a senha.',
                    variant: 'error',
                });
            } else {
                setMessage({
                    text: 'Não foi possível alterar a senha.',
                    variant: 'error',
                });
            }
        } finally {
            setSavingPassword(false);
        }
    }

    async function handleDownloadBackup(): Promise<void> {
        const token = getAuthToken();

        if (!token) {
            setMessage({
                text: 'Sessão expirada. Faça login novamente.',
                variant: 'error',
            });
            return;
        }

        setDownloadingBackup(true);
        setMessage(null);

        try {
            const response = await fetch('/api/settings/backup', {
                method: 'GET',
                headers: {
                    Accept: 'application/zip',
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                let backendMessage = 'Não foi possível gerar o backup.';
                let detailLines: string[] = [];

                try {
                    const payload = (await response.json()) as {
                        message?: string;
                        details?: string[];
                        error_id?: string;
                        stage?: string;
                    };

                    if (payload?.message) {
                        backendMessage = payload.message;
                    }

                    if (Array.isArray(payload?.details)) {
                        detailLines = payload.details.filter((item) => Boolean(item?.trim()));
                    }

                    if (payload?.error_id) {
                        detailLines.push(`Error ID: ${payload.error_id}`);
                    }

                    if (payload?.stage) {
                        detailLines.push(`Etapa: ${payload.stage}`);
                    }
                } catch {
                    const textBody = await response.text().catch(() => '');
                    if (textBody.trim()) {
                        detailLines = ['Resposta não JSON recebida do servidor.', textBody.slice(0, 350)];
                    }
                }

                const fullMessage =
                    detailLines.length > 0 ? `${backendMessage}\n${detailLines.join('\n')}` : backendMessage;

                throw new Error(fullMessage);
            }

            const blob = await response.blob();
            const contentDisposition = response.headers.get('content-disposition') ?? '';
            const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);
            const fileName = fileNameMatch?.[1] ?? 'backup_kaique.zip';
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');

            anchor.href = url;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);

            setMessage({
                text: 'Backup gerado e download iniciado.',
                variant: 'success',
            });
        } catch (error) {
            setMessage({
                text: error instanceof Error ? error.message : 'Não foi possível gerar o backup.',
                variant: 'error',
            });
        } finally {
            setDownloadingBackup(false);
        }
    }

    function handleLanguageChange(nextLanguage: TransportLanguage): void {
        setLanguage(nextLanguage);
        setStoredTransportLanguage(nextLanguage);
        setMessage({
            text: nextLanguage === 'en-US' ? 'Idioma alterado para English.' : 'Idioma alterado para Português.',
            variant: 'success',
        });
    }

    async function loadIntegrationData(): Promise<void> {
        if (!isMasterAdmin) {
            return;
        }

        setLoadingIntegrations(true);
        try {
            const [webhookResponse, remindersSummary, rulesResponse, deliveriesResponse] = await Promise.all([
                apiGet<{
                    data: WebhookRow[];
                    summary: {
                        hooks_total: number;
                        active_hooks: number;
                        deliveries_last_24h: number;
                        failed_last_24h: number;
                    };
                }>('/system/webhooks'),
                apiGet<{
                    summary: {
                        sent_last_24h: number;
                        failed_last_24h: number;
                    };
                }>('/system/reminders/deliveries?limit=1'),
                apiGet<{ data: ReminderRuleRow[] }>('/system/reminders/rules'),
                apiGet<{ data: ReminderDeliveryRow[] }>('/system/reminders/deliveries?limit=12'),
            ]);

            setIntegrationSummary({
                hooksTotal: webhookResponse.summary.hooks_total ?? 0,
                hooksActive: webhookResponse.summary.active_hooks ?? 0,
                deliveries24h: webhookResponse.summary.deliveries_last_24h ?? 0,
                failures24h: webhookResponse.summary.failed_last_24h ?? 0,
                remindersSent24h: remindersSummary.summary.sent_last_24h ?? 0,
                remindersFailed24h: remindersSummary.summary.failed_last_24h ?? 0,
            });
            setWebhooks(webhookResponse.data ?? []);
            setReminderRules(rulesResponse.data ?? []);
            setReminderDeliveries(deliveriesResponse.data ?? []);
        } catch {
            setIntegrationSummary(null);
            setWebhooks([]);
            setReminderRules([]);
            setReminderDeliveries([]);
        } finally {
            setLoadingIntegrations(false);
        }
    }

    useEffect((): void => {
        if (!isMasterAdmin) {
            return;
        }

        void loadIntegrationData();
    }, [isMasterAdmin]);

    async function handleRunReminders(ruleId?: number): Promise<void> {
        setRunningReminders(true);
        setMessage(null);

        try {
            const response = await apiPost<{
                message: string;
                data: {
                    processed_rules: number;
                    attempted: number;
                    sent: number;
                    failed: number;
                    skipped: number;
                };
            }>('/system/reminders/run', ruleId ? { rule_id: ruleId } : {});

            setMessage({
                text: `${response.message} Regras: ${response.data.processed_rules} | Envios: ${response.data.sent}/${response.data.attempted} | Falhas: ${response.data.failed}.`,
                variant: response.data.failed > 0 ? 'info' : 'success',
            });

            await loadIntegrationData();
        } catch (error) {
            setMessage({
                text:
                    error instanceof ApiError
                        ? error.message
                        : 'Não foi possível executar os lembretes automáticos.',
                variant: 'error',
            });
        } finally {
            setRunningReminders(false);
        }
    }

    async function handleCreateRule(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setSavingRule(true);
        setMessage(null);

        try {
            const recipients = ruleForm.recipients
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);

            await apiPost('/system/reminders/rules', {
                ...ruleForm,
                recipients,
                webhook_url: ruleForm.channel === 'whatsapp' ? ruleForm.webhook_url || null : null,
            });

            setRuleForm({
                name: '',
                trigger_key: 'vacations_due',
                channel: 'email',
                recipients: '',
                threshold_days: 30,
                webhook_url: '',
                message_prefix: '',
            });

            setMessage({
                text: 'Regra de lembrete criada com sucesso.',
                variant: 'success',
            });
            await loadIntegrationData();
        } catch (error) {
            setMessage({
                text:
                    error instanceof ApiError
                        ? error.message
                        : 'Não foi possível criar a regra de lembrete.',
                variant: 'error',
            });
        } finally {
            setSavingRule(false);
        }
    }

    async function handleToggleRule(rule: ReminderRuleRow): Promise<void> {
        try {
            await apiPut(`/system/reminders/rules/${rule.id}`, {
                is_active: !rule.is_active,
            });
            setMessage({
                text: `Regra ${!rule.is_active ? 'ativada' : 'desativada'} com sucesso.`,
                variant: 'success',
            });
            await loadIntegrationData();
        } catch (error) {
            setMessage({
                text:
                    error instanceof ApiError ? error.message : 'Não foi possível atualizar a regra.',
                variant: 'error',
            });
        }
    }

    async function handleDeleteRule(rule: ReminderRuleRow): Promise<void> {
        try {
            await apiDelete(`/system/reminders/rules/${rule.id}`);
            setMessage({
                text: 'Regra removida com sucesso.',
                variant: 'success',
            });
            await loadIntegrationData();
        } catch (error) {
            setMessage({
                text: error instanceof ApiError ? error.message : 'Não foi possível remover a regra.',
                variant: 'error',
            });
        }
    }

    async function handleTestWebhook(webhookId: number): Promise<void> {
        try {
            await apiPost(`/system/webhooks/${webhookId}/test`);
            setMessage({
                text: 'Disparo de teste enfileirado com sucesso.',
                variant: 'success',
            });
            await loadIntegrationData();
        } catch (error) {
            setMessage({
                text:
                    error instanceof ApiError
                        ? error.message
                        : 'Não foi possível enviar o teste do webhook.',
                variant: 'error',
            });
        }
    }

    async function handleRetryWebhookFailed(webhookId: number): Promise<void> {
        try {
            const response = await apiPost<{ queued: number }>(
                `/system/webhooks/${webhookId}/deliveries/retry-failed`,
                { limit: 20 },
            );
            setMessage({
                text: `${response.queued} reenvio(s) em lote enfileirado(s).`,
                variant: 'info',
            });
            await loadIntegrationData();
        } catch (error) {
            setMessage({
                text:
                    error instanceof ApiError
                        ? error.message
                        : 'Não foi possível reenfileirar falhas do webhook.',
                variant: 'error',
            });
        }
    }

    return (
        <AdminLayout title="Configurações" active="settings">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Configurações</h2>
                    <p className="text-sm text-muted-foreground">
                        Ajuste o tema visual, o idioma e a segurança da sua conta.
                    </p>
                </div>

                {message ? <Notification message={message.text} variant={message.variant} /> : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Aparência</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant={resolvedAppearance === 'light' ? 'default' : 'outline'}
                                onClick={() => updateAppearance('light')}
                            >
                                <Sun className="size-4" />
                                Claro
                            </Button>
                            <Button
                                type="button"
                                variant={resolvedAppearance === 'dark' ? 'default' : 'outline'}
                                onClick={() => updateAppearance('dark')}
                            >
                                <Moon className="size-4" />
                                Modo escuro
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Idioma</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                            Escolha o idioma principal da interface.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                variant={language === 'pt-BR' ? 'default' : 'outline'}
                                onClick={() => handleLanguageChange('pt-BR')}
                            >
                                Português (Brasil)
                            </Button>
                            <Button
                                type="button"
                                variant={language === 'en-US' ? 'default' : 'outline'}
                                onClick={() => handleLanguageChange('en-US')}
                            >
                                English (US)
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Alterar senha</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-4" onSubmit={handlePasswordSubmit}>
                            <div className="space-y-2">
                                <Label htmlFor="current-password">Senha atual</Label>
                                <Input
                                    id="current-password"
                                    type="password"
                                    value={currentPassword}
                                    onChange={(event) => setCurrentPassword(event.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="new-password">Nova senha</Label>
                                <Input
                                    id="new-password"
                                    type="password"
                                    value={newPassword}
                                    onChange={(event) => setNewPassword(event.target.value)}
                                    required
                                    minLength={8}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    required
                                    minLength={8}
                                />
                            </div>

                            <Button type="submit" disabled={savingPassword}>
                                {savingPassword ? (
                                    <>
                                        <LoaderCircle className="size-4 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    'Salvar senha'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {isMasterAdmin ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Backup do sistema</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                Gera um arquivo ZIP com banco de dados e arquivos essenciais do sistema.
                            </p>
                            <Button
                                type="button"
                                onClick={() => void handleDownloadBackup()}
                                disabled={downloadingBackup}
                            >
                                {downloadingBackup ? (
                                    <>
                                        <LoaderCircle className="size-4 animate-spin" />
                                        Gerando backup...
                                    </>
                                ) : (
                                    <>
                                        <Download className="size-4" />
                                        Baixar backup
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                ) : null}

                {isMasterAdmin ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Integrações e lembretes automáticos</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-md border p-3">
                                    <p className="text-xs text-muted-foreground">Webhooks ativos</p>
                                    <p className="text-lg font-semibold">
                                        {integrationSummary
                                            ? `${integrationSummary.hooksActive}/${integrationSummary.hooksTotal}`
                                            : '--'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Entregas 24h: {integrationSummary?.deliveries24h ?? 0} | Falhas:{' '}
                                        {integrationSummary?.failures24h ?? 0}
                                    </p>
                                </div>
                                <div className="rounded-md border p-3">
                                    <p className="text-xs text-muted-foreground">Lembretes 24h</p>
                                    <p className="text-lg font-semibold">
                                        {integrationSummary ? integrationSummary.remindersSent24h : 0}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Falhas: {integrationSummary?.remindersFailed24h ?? 0}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    onClick={() => void handleRunReminders()}
                                    disabled={runningReminders}
                                >
                                    {runningReminders ? (
                                        <>
                                            <LoaderCircle className="size-4 animate-spin" />
                                            Executando lembretes...
                                        </>
                                    ) : (
                                        'Executar lembretes agora'
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => void loadIntegrationData()}
                                    disabled={loadingIntegrations}
                                >
                                    <RefreshCw className="size-4" />
                                    Atualizar painel
                                </Button>
                            </div>

                            <div className="grid gap-4 xl:grid-cols-2">
                                <div className="space-y-3 rounded-md border p-3">
                                    <h3 className="text-sm font-semibold">Webhooks configurados</h3>
                                    {webhooks.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            Nenhum webhook cadastrado.
                                        </p>
                                    ) : (
                                        webhooks.map((hook) => (
                                            <div key={hook.id} className="rounded-md border p-3 text-sm">
                                                <p className="font-medium">{hook.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {hook.target_url}
                                                </p>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Status: {hook.is_active ? 'Ativo' : 'Inativo'} | Entregas 24h:{' '}
                                                    {hook.deliveries_last_24h ?? 0} | Falhas 24h:{' '}
                                                    {hook.deliveries_failed_last_24h ?? 0}
                                                </p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => void handleTestWebhook(hook.id)}
                                                    >
                                                        <Play className="size-3.5" />
                                                        Testar
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            void handleRetryWebhookFailed(hook.id)
                                                        }
                                                    >
                                                        <RefreshCw className="size-3.5" />
                                                        Reenfileirar falhas
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="space-y-3 rounded-md border p-3">
                                    <h3 className="text-sm font-semibold">Nova regra de lembrete</h3>
                                    <form className="space-y-2" onSubmit={handleCreateRule}>
                                        <Input
                                            placeholder="Nome da regra"
                                            value={ruleForm.name}
                                            onChange={(event) =>
                                                setRuleForm((previous) => ({
                                                    ...previous,
                                                    name: event.target.value,
                                                }))
                                            }
                                            required
                                        />
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <select
                                                className="h-9 rounded-md border bg-background px-3 text-sm"
                                                value={ruleForm.trigger_key}
                                                onChange={(event) =>
                                                    setRuleForm((previous) => ({
                                                        ...previous,
                                                        trigger_key: event.target.value as
                                                            | 'vacations_due'
                                                            | 'task_sla_overdue',
                                                    }))
                                                }
                                            >
                                                <option value="vacations_due">Férias vencendo</option>
                                                <option value="task_sla_overdue">Tarefas com SLA</option>
                                            </select>
                                            <select
                                                className="h-9 rounded-md border bg-background px-3 text-sm"
                                                value={ruleForm.channel}
                                                onChange={(event) =>
                                                    setRuleForm((previous) => ({
                                                        ...previous,
                                                        channel: event.target.value as 'email' | 'whatsapp',
                                                    }))
                                                }
                                            >
                                                <option value="email">E-mail</option>
                                                <option value="whatsapp">WhatsApp</option>
                                            </select>
                                        </div>
                                        <Input
                                            placeholder="Destinatários separados por vírgula"
                                            value={ruleForm.recipients}
                                            onChange={(event) =>
                                                setRuleForm((previous) => ({
                                                    ...previous,
                                                    recipients: event.target.value,
                                                }))
                                            }
                                            required
                                        />
                                        <Input
                                            type="number"
                                            min={1}
                                            max={180}
                                            value={String(ruleForm.threshold_days)}
                                            onChange={(event) =>
                                                setRuleForm((previous) => ({
                                                    ...previous,
                                                    threshold_days: Number(event.target.value) || 1,
                                                }))
                                            }
                                        />
                                        {ruleForm.channel === 'whatsapp' ? (
                                            <Input
                                                placeholder="Webhook URL do provedor WhatsApp"
                                                value={ruleForm.webhook_url}
                                                onChange={(event) =>
                                                    setRuleForm((previous) => ({
                                                        ...previous,
                                                        webhook_url: event.target.value,
                                                    }))
                                                }
                                                required
                                            />
                                        ) : null}
                                        <Input
                                            placeholder="Prefixo da mensagem (opcional)"
                                            value={ruleForm.message_prefix}
                                            onChange={(event) =>
                                                setRuleForm((previous) => ({
                                                    ...previous,
                                                    message_prefix: event.target.value,
                                                }))
                                            }
                                        />
                                        <Button type="submit" disabled={savingRule}>
                                            {savingRule ? (
                                                <>
                                                    <LoaderCircle className="size-4 animate-spin" />
                                                    Salvando...
                                                </>
                                            ) : (
                                                'Criar regra'
                                            )}
                                        </Button>
                                    </form>
                                </div>
                            </div>

                            <div className="grid gap-4 xl:grid-cols-2">
                                <div className="space-y-3 rounded-md border p-3">
                                    <h3 className="text-sm font-semibold">Regras cadastradas</h3>
                                    {reminderRules.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            Nenhuma regra cadastrada.
                                        </p>
                                    ) : (
                                        reminderRules.map((rule) => (
                                            <div key={rule.id} className="rounded-md border p-3 text-sm">
                                                <p className="font-medium">{rule.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Trigger: {rule.trigger_key} | Canal: {rule.channel} | Janela:{' '}
                                                    {rule.threshold_days} dia(s)
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Enviados 7d: {rule.sent_last_7d ?? 0} | Falhas 7d:{' '}
                                                    {rule.failed_last_7d ?? 0}
                                                </p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => void handleToggleRule(rule)}
                                                    >
                                                        {rule.is_active ? 'Desativar' : 'Ativar'}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => void handleRunReminders(rule.id)}
                                                        disabled={runningReminders}
                                                    >
                                                        <Play className="size-3.5" />
                                                        Rodar agora
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => void handleDeleteRule(rule)}
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                        Excluir
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="space-y-3 rounded-md border p-3">
                                    <h3 className="text-sm font-semibold">Histórico recente de lembretes</h3>
                                    {reminderDeliveries.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            Sem envios recentes no período.
                                        </p>
                                    ) : (
                                        reminderDeliveries.map((delivery) => (
                                            <div key={delivery.id} className="rounded-md border p-3 text-sm">
                                                <p className="font-medium">
                                                    {delivery.channel.toUpperCase()} • {delivery.recipient}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Trigger: {delivery.trigger_key}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Status:{' '}
                                                    {delivery.status === 'sent' ? 'Enviado' : 'Falhou'} •{' '}
                                                    {new Date(delivery.created_at).toLocaleString('pt-BR')}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : null}
            </div>
        </AdminLayout>
    );
}
