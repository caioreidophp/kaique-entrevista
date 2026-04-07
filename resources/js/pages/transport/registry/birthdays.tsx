import { Cake, Gift, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet } from '@/lib/api-client';
import { formatDateBR } from '@/lib/transport-format';

interface BirthdayCollaborator {
    id: number;
    nome: string;
    data_nascimento: string | null;
    unidade?: { id: number; nome: string } | null;
    funcao?: { id: number; nome: string } | null;
}

interface BirthdaysResponse {
    today: string;
    today_birthdays: BirthdayCollaborator[];
    month_birthdays: BirthdayCollaborator[];
}

function monthLabel(dateIso: string): string {
    const value = new Date(`${dateIso}T00:00:00`);

    if (Number.isNaN(value.getTime())) {
        return '-';
    }

    return value.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
    });
}

export default function RegistryBirthdaysPage() {
    const [loading, setLoading] = useState(true);
    const [rowsToday, setRowsToday] = useState<BirthdayCollaborator[]>([]);
    const [rowsMonth, setRowsMonth] = useState<BirthdayCollaborator[]>([]);
    const [today, setToday] = useState<string>('');
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    useEffect(() => {
        let mounted = true;

        apiGet<BirthdaysResponse>('/registry/colaboradores/birthdays')
            .then((response) => {
                if (!mounted) return;

                setToday(response.today);
                setRowsToday(response.today_birthdays ?? []);
                setRowsMonth(response.month_birthdays ?? []);
            })
            .catch(() => {
                if (!mounted) return;

                setNotification({
                    message: 'Não foi possível carregar os aniversariantes.',
                    variant: 'error',
                });
            })
            .finally(() => {
                if (mounted) {
                    setLoading(false);
                }
            });

        return () => {
            mounted = false;
        };
    }, []);

    const monthTitle = useMemo(() => {
        if (!today) return 'Mês atual';

        return monthLabel(today);
    }, [today]);

    return (
        <AdminLayout title="Cadastro - Aniversariantes" active="registry-birthdays" module="registry">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Aniversariantes</h2>
                    <p className="text-sm text-muted-foreground">
                        Consulta rápida para lembrar de parabenizar a equipe.
                    </p>
                </div>

                {notification ? (
                    <Notification message={notification.message} variant={notification.variant} />
                ) : null}

                {loading ? (
                    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando aniversariantes...
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="inline-flex items-center gap-2">
                                        <Gift className="size-4" />
                                        Aniversariantes de hoje
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {rowsToday.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Ninguém faz aniversário hoje.
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {rowsToday.map((item) => (
                                                <div key={item.id} className="rounded-md border px-3 py-2 text-sm">
                                                    <p className="font-medium">{item.nome}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.funcao?.nome ?? '-'} • {item.unidade?.nome ?? '-'}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="inline-flex items-center gap-2">
                                        <Cake className="size-4" />
                                        Aniversariantes de {monthTitle}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {rowsMonth.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Não há aniversariantes cadastrados neste mês.
                                        </p>
                                    ) : (
                                        <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                                            {rowsMonth.map((item) => (
                                                <div key={item.id} className="rounded-md border px-3 py-2 text-sm">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="font-medium">{item.nome}</p>
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatDateBR(item.data_nascimento)}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.funcao?.nome ?? '-'} • {item.unidade?.nome ?? '-'}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </>
                )}
            </div>
        </AdminLayout>
    );
}
