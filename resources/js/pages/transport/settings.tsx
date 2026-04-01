import { Download, Languages, LoaderCircle, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppearance } from '@/hooks/use-appearance';
import { ApiError, apiPut } from '@/lib/api-client';
import {
    getStoredTransportLanguage,
    setStoredTransportLanguage,
    type TransportLanguage,
} from '@/lib/transport-language';
import { getAuthToken } from '@/lib/transport-auth';
import { getStoredUser } from '@/lib/transport-session';

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
    const [message, setMessage] = useState<{
        text: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    function handleLanguageChange(nextLanguage: TransportLanguage): void {
        setLanguage(nextLanguage);
        setStoredTransportLanguage(nextLanguage);
        setMessage({
            text:
                nextLanguage === 'en-US'
                    ? 'Language changed to English.'
                    : 'Idioma alterado para Portugues.',
            variant: 'info',
        });
    }

    async function handlePasswordSubmit(
        event: React.FormEvent<HTMLFormElement>,
    ) {
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
                const firstError = error.errors
                    ? Object.values(error.errors)[0]?.[0]
                    : null;

                setMessage({
                    text:
                        firstError ??
                        error.message ??
                        'Não foi possível alterar a senha.',
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
                        detailLines = payload.details.filter((item) =>
                            Boolean(item?.trim()),
                        );
                    }

                    if (payload?.error_id) {
                        detailLines.push(`Error ID: ${payload.error_id}`);
                    }

                    if (payload?.stage) {
                        detailLines.push(`Etapa: ${payload.stage}`);
                    }

                    // Mantem os detalhes completos no console para diagnostico rapido.
                    console.error('Falha backup payload:', payload);
                } catch {
                    const textBody = await response.text().catch(() => '');
                    if (textBody.trim()) {
                        detailLines = [
                            'Resposta não-JSON recebida do servidor.',
                            textBody.slice(0, 350),
                        ];
                    }
                }

                const fullMessage =
                    detailLines.length > 0
                        ? `${backendMessage}\n${detailLines.join('\n')}`
                        : backendMessage;

                throw new Error(fullMessage);
            }

            const blob = await response.blob();
            const contentDisposition =
                response.headers.get('content-disposition') ?? '';
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
                text:
                    error instanceof Error
                        ? error.message
                        : 'Não foi possível gerar o backup.',
                variant: 'error',
            });
        } finally {
            setDownloadingBackup(false);
        }
    }

    return (
        <AdminLayout title="Configurações" active="settings">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Configurações</h2>
                    <p className="text-sm text-muted-foreground">
                        Ajuste o modo escuro e altere sua senha de acesso.
                    </p>
                </div>

                {message ? (
                    <Notification
                        message={message.text}
                        variant={message.variant}
                    />
                ) : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Aparência</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant={
                                    resolvedAppearance === 'light'
                                        ? 'default'
                                        : 'outline'
                                }
                                onClick={() => updateAppearance('light')}
                            >
                                <Sun className="size-4" />
                                Claro
                            </Button>
                            <Button
                                type="button"
                                variant={
                                    resolvedAppearance === 'dark'
                                        ? 'default'
                                        : 'outline'
                                }
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
                        <CardTitle className="inline-flex items-center gap-2">
                            <Languages className="size-4" />
                            Idioma
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant={
                                    language === 'pt-BR'
                                        ? 'default'
                                        : 'outline'
                                }
                                onClick={() =>
                                    handleLanguageChange('pt-BR')
                                }
                            >
                                Portugues
                            </Button>
                            <Button
                                type="button"
                                variant={
                                    language === 'en-US'
                                        ? 'default'
                                        : 'outline'
                                }
                                onClick={() =>
                                    handleLanguageChange('en-US')
                                }
                            >
                                English
                            </Button>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Essa opcao sincroniza com o seletor global do menu lateral.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Alterar senha</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            className="space-y-4"
                            onSubmit={handlePasswordSubmit}
                        >
                            <div className="space-y-2">
                                <Label htmlFor="current-password">
                                    Senha atual
                                </Label>
                                <Input
                                    id="current-password"
                                    type="password"
                                    value={currentPassword}
                                    onChange={(event) =>
                                        setCurrentPassword(event.target.value)
                                    }
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="new-password">Nova senha</Label>
                                <Input
                                    id="new-password"
                                    type="password"
                                    value={newPassword}
                                    onChange={(event) =>
                                        setNewPassword(event.target.value)
                                    }
                                    required
                                    minLength={8}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">
                                    Confirmar nova senha
                                </Label>
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(event) =>
                                        setConfirmPassword(event.target.value)
                                    }
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
            </div>
        </AdminLayout>
    );
}
