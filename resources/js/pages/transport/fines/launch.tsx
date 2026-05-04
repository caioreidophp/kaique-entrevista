import { router } from '@inertiajs/react';
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
import { ApiError, apiGet, apiPost, apiPut } from '@/lib/api-client';

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

interface DriverItem {
    id: number;
    nome: string;
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
    motoristas: DriverItem[];
    infracoes: FineInfractionItem[];
    orgaos: FineAuthorityItem[];
}

interface FineFormData {
    data: string;
    hora: string;
    placa_frota_id: string;
    multa_infracao_id: string;
    descricao: string;
    numero_auto_infracao: string;
    colaborador_id: string;
    indicado_condutor: boolean;
    culpa: 'empresa' | 'motorista';
    valor: string;
    tipo_valor: 'normal' | '20_percent' | '40_percent';
    vencimento: string;
    status: 'aguardando_motorista' | 'solicitado_boleto' | 'boleto_ok' | 'pago';
    descontar: boolean;
}

interface FinePayload {
    tipo_registro: 'multa';
    data: string;
    hora: string;
    placa_frota_id: number;
    multa_infracao_id: number;
    descricao: string | null;
    numero_auto_infracao: string | null;
    multa_orgao_autuador_id: number;
    colaborador_id: number;
    indicado_condutor: boolean;
    culpa: 'empresa' | 'motorista';
    valor: string;
    tipo_valor: 'normal' | '20_percent' | '40_percent';
    vencimento: string;
    status: 'aguardando_motorista' | 'solicitado_boleto' | 'boleto_ok' | 'pago';
    descontar: boolean;
}

interface FineShowResponse {
    data: {
        id: number;
        tipo_registro: 'multa' | 'notificacao';
        data: string;
        hora: string | null;
        placa_frota_id: number;
        multa_infracao_id: number;
        descricao: string | null;
        numero_auto_infracao: string | null;
        multa_orgao_autuador_id: number;
        colaborador_id: number | null;
        indicado_condutor: boolean;
        culpa: 'empresa' | 'motorista';
        valor: string;
        tipo_valor: 'normal' | '20_percent' | '40_percent';
        vencimento: string | null;
        status: 'aguardando_motorista' | 'solicitado_boleto' | 'boleto_ok' | 'pago';
        descontar: boolean;
        orgao_autuador?: {
            id: number;
            nome: string;
        } | null;
    };
}

interface FineSubmitResponse {
    data?: FineShowResponse['data'];
    approval_required?: boolean;
    approval_id?: number;
    approval_uuid?: string;
    message?: string;
}

function todayDateString(): string {
    return new Date().toISOString().slice(0, 10);
}

const emptyForm = (): FineFormData => ({
    data: todayDateString(),
    hora: '00:00',
    placa_frota_id: '',
    multa_infracao_id: '',
    descricao: '',
    numero_auto_infracao: '',
    colaborador_id: '',
    indicado_condutor: false,
    culpa: 'empresa',
    valor: '',
    tipo_valor: 'normal',
    vencimento: todayDateString(),
    status: 'aguardando_motorista',
    descontar: false,
});

function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

export default function TransportFinesLaunchPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const [references, setReferences] = useState<ReferenceResponse | null>(null);
    const [form, setForm] = useState<FineFormData>(emptyForm);
    const [orgaoInput, setOrgaoInput] = useState('');
    const [confirmNewOrgaoOpen, setConfirmNewOrgaoOpen] = useState(false);
    const [pendingFinePayload, setPendingFinePayload] = useState<Omit<FinePayload, 'multa_orgao_autuador_id'> | null>(null);
    const [notificationIdForConversion, setNotificationIdForConversion] = useState<number | null>(null);

    async function loadReferences(): Promise<void> {
        setLoading(true);

        try {
            const response = await apiGet<ReferenceResponse>('/fines/reference');
            setReferences(response);
        } catch {
            setNotification({
                message: 'Não foi possível carregar placas, infrações, motoristas e órgãos.',
                variant: 'error',
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadReferences();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const fromNotificationId = Number(params.get('from_notification_id') ?? '');

        if (!Number.isFinite(fromNotificationId) || fromNotificationId <= 0) {
            return;
        }

        setNotificationIdForConversion(fromNotificationId);

        void (async () => {
            try {
                const response = await apiGet<FineShowResponse>(`/fines/${fromNotificationId}?tipo_registro=notificacao`);
                const row = response.data;

                setForm((previous) => ({
                    ...previous,
                    data: row.data,
                    hora: (row.hora ?? '00:00').slice(0, 5),
                    placa_frota_id: String(row.placa_frota_id ?? ''),
                    multa_infracao_id: String(row.multa_infracao_id ?? ''),
                    descricao: row.descricao ?? '',
                    numero_auto_infracao: row.numero_auto_infracao ?? '',
                    colaborador_id: row.colaborador_id ? String(row.colaborador_id) : '',
                    indicado_condutor: row.indicado_condutor,
                    culpa: row.culpa,
                    valor: row.valor ? String(row.valor) : '',
                    tipo_valor: row.tipo_valor,
                    vencimento: row.vencimento ?? todayDateString(),
                    status: row.status,
                    descontar: row.descontar,
                }));

                setOrgaoInput(row.orgao_autuador?.nome ?? '');
            } catch {
                setNotification({
                    message: 'Não foi possível carregar a notificação para transformação em multa.',
                    variant: 'error',
                });
                setNotificationIdForConversion(null);
            }
        })();
    }, []);

    const sortedPlates = useMemo(() => {
        return [...(references?.placas ?? [])].sort((a, b) => a.placa.localeCompare(b.placa));
    }, [references?.placas]);

    const sortedDrivers = useMemo(() => {
        return [...(references?.motoristas ?? [])].sort((a, b) => a.nome.localeCompare(b.nome));
    }, [references?.motoristas]);

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

    async function submitFine(payload: FinePayload): Promise<void> {
        setSaving(true);
        setNotification(null);

        try {
            let response: FineSubmitResponse;

            if (notificationIdForConversion) {
                response = await apiPut<FineSubmitResponse>(`/fines/${notificationIdForConversion}`, payload);
            } else {
                response = await apiPost<FineSubmitResponse>('/fines', payload);
            }

            if (response.approval_required) {
                setNotification({
                    message:
                        response.message ??
                        'Solicitacao enviada para aprovacao financeira. A operacao sera concluida apos aprovacao.',
                    variant: 'info',
                });
                return;
            }

            if (payload.culpa === 'motorista' && payload.descontar) {
                const params = new URLSearchParams({
                    prefill_fine_discount: '1',
                    colaborador_id: String(payload.colaborador_id),
                    valor: String(payload.valor),
                    data_referencia: payload.data,
                    origem: 'multa',
                });

                router.visit(`/transport/payroll/adjustments?${params.toString()}`);
                return;
            }

            setNotification({
                message: notificationIdForConversion ? 'Notificação transformada em multa com sucesso.' : 'Multa lançada com sucesso.',
                variant: 'success',
            });

            if (notificationIdForConversion) {
                router.visit('/transport/fines/list');
                return;
            }

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
                    message: 'Não foi possível lançar a multa.',
                    variant: 'error',
                });
            }
        } finally {
            setSaving(false);
            setPendingFinePayload(null);
        }
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();

        const payloadWithoutOrgao: Omit<FinePayload, 'multa_orgao_autuador_id'> = {
            tipo_registro: 'multa',
            data: form.data,
            hora: form.hora,
            placa_frota_id: Number(form.placa_frota_id),
            multa_infracao_id: Number(form.multa_infracao_id),
            descricao: form.descricao.trim() || null,
            numero_auto_infracao: form.numero_auto_infracao.trim() || null,
            colaborador_id: Number(form.colaborador_id),
            indicado_condutor: form.indicado_condutor,
            culpa: form.culpa,
            valor: form.valor,
            tipo_valor: form.tipo_valor,
            vencimento: form.vencimento,
            status: form.status,
            descontar: form.culpa === 'motorista' ? form.descontar : false,
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
            await submitFine({
                ...payloadWithoutOrgao,
                multa_orgao_autuador_id: matchingOrgao.id,
            });
            return;
        }

        setPendingFinePayload(payloadWithoutOrgao);
        setConfirmNewOrgaoOpen(true);
    }

    async function confirmCreateOrgaoAndSubmit(): Promise<void> {
        if (!pendingFinePayload) {
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

            await submitFine({
                ...pendingFinePayload,
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
        <AdminLayout title="Gestão de Multas - Lançar" active="fines-launch" module="fines">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Lançar Multas</h2>
                    <p className="text-sm text-muted-foreground">
                        Registre a multa e, quando for culpa do motorista com desconto ativo, direcione para Descontos com pré-preenchimento.
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
                                <div className="grid gap-4 md:grid-cols-3">
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

                                    <div className="space-y-2">
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

                                <div className="grid gap-4 md:grid-cols-2">
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

                                    <div className="space-y-2">
                                        <Label>Motorista *</Label>
                                        <Select
                                            value={form.colaborador_id || 'none'}
                                            onValueChange={(value) =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    colaborador_id: value === 'none' ? '' : value,
                                                }))
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Selecione</SelectItem>
                                                {sortedDrivers.map((driver) => (
                                                    <SelectItem key={driver.id} value={String(driver.id)}>
                                                        {driver.nome}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label>Indicado condutor *</Label>
                                        <Select
                                            value={form.indicado_condutor ? '1' : '0'}
                                            onValueChange={(value) =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    indicado_condutor: value === '1',
                                                }))
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">Sim</SelectItem>
                                                <SelectItem value="0">Não</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Culpa *</Label>
                                        <Select
                                            value={form.culpa}
                                            onValueChange={(value: 'empresa' | 'motorista') =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    culpa: value,
                                                    descontar: value === 'motorista' ? previous.descontar : false,
                                                }))
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="empresa">Empresa</SelectItem>
                                                <SelectItem value="motorista">Motorista</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="valor">Valor *</Label>
                                        <Input
                                            id="valor"
                                            type="text"
                                            inputMode="decimal"
                                            value={form.valor}
                                            onChange={(event) =>
                                                setForm((previous) => ({ ...previous, valor: event.target.value }))
                                            }
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-4">
                                    <div className="space-y-2">
                                        <Label>Tipo Valor *</Label>
                                        <Select
                                            value={form.tipo_valor}
                                            onValueChange={(value: FineFormData['tipo_valor']) =>
                                                setForm((previous) => ({ ...previous, tipo_valor: value }))
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="normal">Normal</SelectItem>
                                                <SelectItem value="20_percent">20%</SelectItem>
                                                <SelectItem value="40_percent">40%</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="vencimento">Vencimento *</Label>
                                        <Input
                                            id="vencimento"
                                            type="date"
                                            value={form.vencimento}
                                            onChange={(event) =>
                                                setForm((previous) => ({ ...previous, vencimento: event.target.value }))
                                            }
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Status *</Label>
                                        <Select
                                            value={form.status}
                                            onValueChange={(value: FineFormData['status']) =>
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

                                    <div className="space-y-2">
                                        <Label>Descontar</Label>
                                        <Select
                                            value={form.descontar ? '1' : '0'}
                                            onValueChange={(value) =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    descontar: value === '1',
                                                }))
                                            }
                                            disabled={form.culpa !== 'motorista'}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="0">Não</SelectItem>
                                                <SelectItem value="1">Sim</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {form.culpa === 'motorista' && form.descontar ? (
                                    <p className="text-sm text-muted-foreground">
                                        Ao lançar, você será redirecionado para Pagamentos {'>'} Descontos com motorista, valor e data pré-preenchidos.
                                    </p>
                                ) : null}

                                <div className="flex justify-end">
                                    <Button
                                        type="submit"
                                        disabled={
                                            saving
                                            || !form.data
                                            || !form.hora
                                            || !form.placa_frota_id
                                            || !form.multa_infracao_id
                                            || !form.colaborador_id
                                            || !orgaoInput.trim()
                                            || !form.valor.trim()
                                            || !form.vencimento
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
                                                {notificationIdForConversion ? 'Transformar em multa' : 'Lançar multa'}
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
                                setPendingFinePayload(null);
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
