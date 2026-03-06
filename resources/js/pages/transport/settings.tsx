import { LoaderCircle, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppearance } from '@/hooks/use-appearance';
import { ApiError, apiPut } from '@/lib/api-client';

export default function TransportSettingsPage() {
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);
    const [message, setMessage] = useState<{
        text: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

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
            </div>
        </AdminLayout>
    );
}
