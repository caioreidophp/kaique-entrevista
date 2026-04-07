import { LoaderCircle, Save } from 'lucide-react';
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
import { ApiError, apiGet, apiPost } from '@/lib/api-client';

interface UnitItem {
    id: number;
    nome: string;
}

interface PlateItem {
    id: number;
    placa: string;
    unidade_id: number | null;
    unidade?: UnitItem;
}

interface FineInfractionItem {
    id: number;
    nome: string;
}

interface FineAuthorityItem {
    id: number;
    nome: string;
}

interface ReferenceResponse {
    unidades: UnitItem[];
    placas: PlateItem[];
    infracoes: FineInfractionItem[];
    orgaos: FineAuthorityItem[];
}

interface NotificationFormData {
    data: string;
    hora: string;
    placa_frota_id: string;
    multa_infracao_id: string;
    descricao: string;
    numero_auto_infracao: string;
    status: 'aguardando_motorista' | 'solicitado_boleto' | 'boleto_ok' | 'pago';
}

interface NotificationPayload {
    tipo_registro: 'notificacao';
    data: string;
    hora: string;
    placa_frota_id: number;
    multa_infracao_id: number;
    descricao: string | null;
    numero_auto_infracao: string | null;
    multa_orgao_autuador_id: number;
    status: 'aguardando_motorista' | 'solicitado_boleto' | 'boleto_ok' | 'pago';
}

function todayDateString(): string {
    return new Date().toISOString().slice(0, 10);
}

const emptyForm = (): NotificationFormData => ({
    data: todayDateString(),
    hora: '00:00',
    placa_frota_id: '',
    multa_infracao_id: '',
    descricao: '',
    numero_auto_infracao: '',
    status: 'aguardando_motorista',
});

function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

export default function TransportFinesLaunchNotificationPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const [references, setReferences] = useState<ReferenceResponse | null>(null);
    const [form, setForm] = useState<NotificationFormData>(emptyForm);
    const [orgaoInput, setOrgaoInput] = useState('');
    const [confirmNewOrgaoOpen, setConfirmNewOrgaoOpen] = useState(false);
    const [pendingPayload, setPendingPayload] = useState<Omit<NotificationPayload, 'multa_orgao_autuador_id'> | null>(null);

    async function loadReferences(): Promise<void> {
        setLoading(true);

        try {
            const response = await apiGet<ReferenceResponse>('/fines/reference');
            setReferences(response);
        } catch {
            setNotification({
                message: 'Não foi possível carregar placas, infrações e órgãos.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadReferences();
    }, []);

    const sortedPlates = useMemo(() => {
        return [...(references?.placas ?? [])].sort((a, b) => a.placa.localeCompare(b.placa));
    }, [references?.placas]);

    const sortedInfractions = useMemo(() => {
        return [...(references?.infracoes ?? [])].sort((a, b) => a.nome.localeCompare(b.nome));
    }, [references?.infracoes]);

    const sortedOrgaos = useMemo(() => {
        return [...(references?.orgaos ?? [])].sort((a, b) => a.nome.localeCompare(b.nome));
    }, [references?.orgaos]);

    const filteredOrgaos = useMemo(() => {
        const term = normalizeText(orgaoInput);

        if (!term) {
            return sortedOrgaos.slice(0, 8);
        }

        return sortedOrgaos
            .filter((item) => normalizeText(item.nome).includes(term))
            .slice(0, 8);
    }, [orgaoInput, sortedOrgaos]);

    const matchingOrgao = useMemo(() => {
        const term = normalizeText(orgaoInput);

        if (!term) return null;

        return sortedOrgaos.find((item) => normalizeText(item.nome) === term) ?? null;
    }, [orgaoInput, sortedOrgaos]);

    async function submitNotification(payload: NotificationPayload): Promise<void> {
        setSaving(true);
        setNotification(null);

        try {
            await apiPost('/fines', payload);

            setNotification({
                message: 'Notificação lançada com sucesso.',
                variant: 'success',
            });

            setForm(emptyForm());
            setOrgaoInput('');
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
                    message: 'Não foi possível lançar a notificação.',
                    variant: 'error',
                });
            }
        } finally {
            setSaving(false);
            setPendingPayload(null);
        }
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();

        const payloadWithoutOrgao: Omit<NotificationPayload, 'multa_orgao_autuador_id'> = {
            tipo_registro: 'notificacao',
            data: form.data,
            hora: form.hora,
            placa_frota_id: Number(form.placa_frota_id),
            multa_infracao_id: Number(form.multa_infracao_id),
            descricao: form.descricao.trim() || null,
            numero_auto_infracao: form.numero_auto_infracao.trim() || null,
            status: form.status,
        };

        const orgaoName = orgaoInput.trim();

        if (!orgaoName) {
            setNotification({
                message: 'Informe o órgão atuador.',
                variant: 'error',
            });
            return;
        }

        if (matchingOrgao) {
            await submitNotification({
                ...payloadWithoutOrgao,
                multa_orgao_autuador_id: matchingOrgao.id,
            });
            return;
        }

        setPendingPayload(payloadWithoutOrgao);
        setConfirmNewOrgaoOpen(true);
    }

    async function confirmCreateOrgaoAndSubmit(): Promise<void> {
        if (!pendingPayload) {
            setConfirmNewOrgaoOpen(false);
            return;
        }

        try {
            const response = await apiPost<{ data: FineAuthorityItem }>('/fines/orgaos', {
                nome: orgaoInput.trim(),
            });

            const newOrgao = response.data;

            setReferences((previous) => {
                if (!previous) return previous;

                const exists = previous.orgaos.some((item) => item.id === newOrgao.id);

                return {
                    ...previous,
                    orgaos: exists ? previous.orgaos : [...previous.orgaos, newOrgao],
                };
            });

            setConfirmNewOrgaoOpen(false);

            await submitNotification({
                ...pendingPayload,
                multa_orgao_autuador_id: newOrgao.id,
            });
        } catch (error) {
            setConfirmNewOrgaoOpen(false);

            if (error instanceof ApiError) {
                setNotification({
                    message: error.message,
                    variant: 'error',
                });
            } else {
                setNotification({
                    message: 'Não foi possível cadastrar o órgão atuador.',
                    variant: 'error',
                });
            }
        }
    }

    return (
        <AdminLayout title="Gestão de Multas - Lançar Notificação" active="fines-launch-notification" module="fines">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Lançar Notificação</h2>
                    <p className="text-sm text-muted-foreground">
                        Registre notificações prévias sem valor final. Depois, na lista, transforme em multa quando chegar o restante das informações.
                    </p>
                </div>

                {notification ? (
                    <Notification message={notification.message} variant={notification.variant} />
                ) : null}

                <Card className="border-border/80">
                    <CardHeader>
                        <CardTitle>Novo lançamento</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando referências...
                            </div>
                        ) : (
                            <form className="space-y-4" onSubmit={handleSubmit}>
                                <div className="grid gap-4 md:grid-cols-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="data">Data *</Label>
                                        <Input
                                            id="data"
                                            type="date"
                                            value={form.data}
                                            onChange={(event) =>
                                                setForm((previous) => ({ ...previous, data: event.target.value }))
                                            }
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="hora">Hora *</Label>
                                        <Input
                                            id="hora"
                                            type="time"
                                            value={form.hora}
                                            onChange={(event) =>
                                                setForm((previous) => ({ ...previous, hora: event.target.value }))
                                            }
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Placa *</Label>
                                        <Select
                                            value={form.placa_frota_id || 'none'}
                                            onValueChange={(value) =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    placa_frota_id: value === 'none' ? '' : value,
                                                }))
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Selecione</SelectItem>
                                                {sortedPlates.map((plate) => (
                                                    <SelectItem key={plate.id} value={String(plate.id)}>
                                                        {plate.placa}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Infração *</Label>
                                        <Select
                                            value={form.multa_infracao_id || 'none'}
                                            onValueChange={(value) =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    multa_infracao_id: value === 'none' ? '' : value,
                                                }))
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Selecione</SelectItem>
                                                {sortedInfractions.map((infraction) => (
                                                    <SelectItem key={infraction.id} value={String(infraction.id)}>
                                                        {infraction.nome}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Status *</Label>
                                        <Select
                                            value={form.status}
                                            onValueChange={(value: NotificationFormData['status']) =>
                                                setForm((previous) => ({ ...previous, status: value }))
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="aguardando_motorista">Aguardando Motorista</SelectItem>
                                                <SelectItem value="solicitado_boleto">Solicitado Boleto</SelectItem>
                                                <SelectItem value="boleto_ok">Boleto OK</SelectItem>
                                                <SelectItem value="pago">Pago</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="descricao">Descrição</Label>
                                        <Input
                                            id="descricao"
                                            value={form.descricao}
                                            onChange={(event) =>
                                                setForm((previous) => ({ ...previous, descricao: event.target.value }))
                                            }
                                            placeholder="Campo livre"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="numero-auto">Nº Auto de Infração</Label>
                                        <Input
                                            id="numero-auto"
                                            value={form.numero_auto_infracao}
                                            onChange={(event) =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    numero_auto_infracao: event.target.value,
                                                }))
                                            }
                                            placeholder="Campo livre"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="orgao-atuador">Órgão Atuador *</Label>
                                    <Input
                                        id="orgao-atuador"
                                        value={orgaoInput}
                                        onChange={(event) => setOrgaoInput(event.target.value)}
                                        placeholder="Digite ou selecione um órgão"
                                        required
                                    />
                                    {filteredOrgaos.length > 0 ? (
                                        <div className="max-h-28 overflow-y-auto rounded-md border bg-muted/20 p-1 text-sm">
                                            {filteredOrgaos.map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    className="block w-full rounded px-2 py-1 text-left hover:bg-muted"
                                                    onClick={() => setOrgaoInput(item.nome)}
                                                >
                                                    {item.nome}
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="flex justify-end">
                                    <Button
                                        type="submit"
                                        disabled={
                                            saving
                                            || !form.data
                                            || !form.hora
                                            || !form.placa_frota_id
                                            || !form.multa_infracao_id
                                            || !orgaoInput.trim()
                                        }
                                    >
                                        {saving ? (
                                            <>
                                                <LoaderCircle className="size-4 animate-spin" />
                                                Lançando...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="size-4" />
                                                Lançar notificação
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={confirmNewOrgaoOpen} onOpenChange={setConfirmNewOrgaoOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cadastrar novo órgão?</DialogTitle>
                        <DialogDescription>
                            O órgão <strong>{orgaoInput.trim()}</strong> não foi encontrado. Deseja cadastrar e usar neste lançamento?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setConfirmNewOrgaoOpen(false);
                                setPendingPayload(null);
                            }}
                            disabled={saving}
                        >
                            Cancelar
                        </Button>
                        <Button type="button" onClick={() => void confirmCreateOrgaoAndSubmit()} disabled={saving}>
                            Confirmar e lançar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
