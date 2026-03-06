import { Head, router } from '@inertiajs/react';
import { LoaderCircle, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiPost, ApiError } from '@/lib/api-client';
import {
    clearAuthToken,
    getAuthToken,
    setAuthToken,
} from '@/lib/transport-auth';
import {
    clearStoredUser,
    fetchCurrentUser,
    getStoredUser,
    storeUser,
} from '@/lib/transport-session';

interface LoginResponse {
    token: string;
    user: {
        id: number;
        name: string;
        email: string;
        role: 'master_admin' | 'admin' | 'usuario';
    };
}

export default function TransportLoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        document
            .querySelectorAll(
                '[data-slot="dialog-overlay"], [data-slot="dialog-content"]',
            )
            .forEach((node) => node.remove());

        document.body.style.pointerEvents = 'auto';
        document.body.style.overflow = 'auto';

        const token = getAuthToken();

        if (!token) {
            return;
        }

        const stored = getStoredUser();

        if (stored) {
            router.visit('/transport/home');
            return;
        }

        fetchCurrentUser(true)
            .then(() => {
                router.visit('/transport/home');
            })
            .catch(() => {
                clearAuthToken();
                clearStoredUser();
            });
    }, []);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const response = await apiPost<LoginResponse>(
                '/login',
                { email, password },
                false,
            );

            setAuthToken(response.token);
            storeUser(response.user);
            router.visit('/transport/home');
        } catch (error) {
            if (error instanceof ApiError) {
                setMessage(error.message || 'E-mail ou senha inválidos.');
            } else {
                setMessage('Não foi possível realizar login.');
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <Head title="Login da Entrevista" />

            <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                            <Truck className="size-5" />
                            <span className="text-sm">Kaique Transportes</span>
                        </div>
                        <CardTitle className="text-2xl">
                            Acessar painel
                        </CardTitle>
                    </CardHeader>

                    <CardContent>
                        <form className="space-y-4" onSubmit={handleSubmit}>
                            {message ? (
                                <Notification
                                    message={message}
                                    variant="error"
                                />
                            ) : null}

                            <div className="space-y-2">
                                <Label htmlFor="email">E-mail</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(event) =>
                                        setEmail(event.target.value)
                                    }
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Senha</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                    required
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <LoaderCircle className="size-4 animate-spin" />
                                        Entrando...
                                    </>
                                ) : (
                                    'Entrar'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
