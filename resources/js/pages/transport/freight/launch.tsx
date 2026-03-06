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
import type { FreightEntry, FreightUnit } from '@/types/freight';

interface WrappedResponse<T> {
    data: T;
}

interface FormDataState {
    data: string;
    unidade_id: string;
    frete_total: string;
    cargas: string;
    aves: string;
    veiculos: string;
    km_rodado: string;
    frete_terceiros: string;
    viagens_terceiros: string;
    aves_terceiros: string;
    frete_liquido: string;
    cargas_liq: string;
    aves_liq: string;
    kaique: string;
    vdm: string;
    frete_programado: string;
    cargas_programadas: string;
    aves_programadas: string;
    cargas_canceladas_escaladas: string;
    nao_escaladas: string;
    placas: string;
    obs: string;
}

const emptyForm: FormDataState = {
    data: new Date().toISOString().slice(0, 10),
    unidade_id: '',
    frete_total: '',
    cargas: '',
    aves: '',
    veiculos: '',
    km_rodado: '',
    frete_terceiros: '',
    viagens_terceiros: '',
    aves_terceiros: '',
    frete_liquido: '',
    cargas_liq: '',
    aves_liq: '',
    kaique: '',
    vdm: '',
    frete_programado: '',
    cargas_programadas: '',
    aves_programadas: '',
    cargas_canceladas_escaladas: '',
    nao_escaladas: '',
    placas: '',
    obs: '',
};

function toNumberOrZero(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toIntegerString(value: number): string {
    return String(Math.max(0, Math.trunc(value)));
}

function toDecimalString(value: number): string {
    return Math.max(0, value).toFixed(2);
}

export default function TransportFreightLaunchPage() {
    const [unidades, setUnidades] = useState<FreightUnit[]>([]);
    const [form, setForm] = useState<FormDataState>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<{
        message: string;
        variant: 'success' | 'error' | 'info';
    } | null>(null);

    const freteLiquidoCalculado = useMemo(
        () =>
            Math.max(
                0,
                toNumberOrZero(form.frete_total) -
                    toNumberOrZero(form.frete_terceiros),
            ),
        [form.frete_total, form.frete_terceiros],
    );

    const cargasLiqCalculadas = useMemo(
        () =>
            Math.max(
                0,
                toNumberOrZero(form.cargas) -
                    toNumberOrZero(form.viagens_terceiros),
            ),
        [form.cargas, form.viagens_terceiros],
    );

    const avesLiqCalculadas = useMemo(
        () =>
            Math.max(
                0,
                toNumberOrZero(form.aves) - toNumberOrZero(form.aves_terceiros),
            ),
        [form.aves, form.aves_terceiros],
    );

    useEffect(() => {
        setForm((previous) => ({
            ...previous,
            frete_liquido: toDecimalString(freteLiquidoCalculado),
            cargas_liq: toIntegerString(cargasLiqCalculadas),
            aves_liq: toIntegerString(avesLiqCalculadas),
        }));
    }, [freteLiquidoCalculado, cargasLiqCalculadas, avesLiqCalculadas]);

    useEffect(() => {
        apiGet<WrappedResponse<FreightUnit[]>>('/registry/unidades')
            .then((response) => {
                setUnidades(response.data);
                if (response.data.length > 0) {
                    setForm((previous) => ({
                        ...previous,
                        unidade_id:
                            previous.unidade_id || String(response.data[0].id),
                    }));
                }
            })
            .catch(() => {
                setNotification({
                    message:
                        'Não foi possível carregar unidades para lançamento.',
                    variant: 'error',
                });
            })
            .finally(() => setLoading(false));
    }, []);

    async function handleSubmit(): Promise<void> {
        if (!form.data || !form.unidade_id || !form.frete_total) {
            setNotification({
                message: 'Data, unidade e frete são obrigatórios.',
                variant: 'error',
            });
            return;
        }

        setSaving(true);
        setNotification(null);

        try {
            const response = await apiPost<WrappedResponse<FreightEntry>>(
                '/freight/entries',
                {
                    data: form.data,
                    unidade_id: Number(form.unidade_id),
                    frete_total: toNumberOrZero(form.frete_total),
                    cargas: toNumberOrZero(form.cargas),
                    aves: toNumberOrZero(form.aves),
                    veiculos: toNumberOrZero(form.veiculos),
                    km_rodado: toNumberOrZero(form.km_rodado),
                    frete_terceiros: toNumberOrZero(form.frete_terceiros),
                    viagens_terceiros: toNumberOrZero(form.viagens_terceiros),
                    aves_terceiros: toNumberOrZero(form.aves_terceiros),
                    frete_liquido: toNumberOrZero(form.frete_liquido),
                    cargas_liq: toNumberOrZero(form.cargas_liq),
                    aves_liq: toNumberOrZero(form.aves_liq),
                    kaique: toNumberOrZero(form.kaique),
                    vdm: toNumberOrZero(form.vdm),
                    frete_programado: toNumberOrZero(form.frete_programado),
                    cargas_programadas: toNumberOrZero(form.cargas_programadas),
                    aves_programadas: toNumberOrZero(form.aves_programadas),
                    cargas_canceladas_escaladas: toNumberOrZero(
                        form.cargas_canceladas_escaladas,
                    ),
                    nao_escaladas: toNumberOrZero(form.nao_escaladas),
                    placas: form.placas || null,
                    obs: form.obs || null,
                },
            );

            setNotification({
                message: `Lançamento salvo com sucesso para ${response.data.unidade?.nome ?? 'a unidade selecionada'}.`,
                variant: 'success',
            });
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
                    message: 'Não foi possível salvar o lançamento.',
                    variant: 'error',
                });
            }
        } finally {
            setSaving(false);
        }
    }

    const sections = [
        [
            ['data', 'Data', 'date'],
            ['unidade_id', 'Unidade', 'select'],
            ['frete_total', 'Frete', 'number'],
            ['cargas', 'Cargas', 'number'],
            ['aves', 'Aves', 'number'],
            ['veiculos', 'Veículos', 'number'],
            ['km_rodado', 'Km rodado', 'number'],
        ],
        [
            ['frete_terceiros', 'Frete terceiros', 'number'],
            ['viagens_terceiros', 'Viagens Terceiros', 'number'],
            ['aves_terceiros', 'Aves Terceiros', 'number'],
            ['frete_liquido', 'Frete Líq.', 'number'],
            ['cargas_liq', 'Cargas Líq', 'number'],
            ['aves_liq', 'Aves Líq', 'number'],
            ['kaique', 'Kaique', 'number'],
            ['vdm', 'VDM', 'number'],
        ],
        [
            ['frete_programado', 'Frete Programado', 'number'],
            ['cargas_programadas', 'Cargas Programadas', 'number'],
            ['aves_programadas', 'Aves Programadas', 'number'],
            [
                'cargas_canceladas_escaladas',
                'Cargas Canceladas Escaladas',
                'number',
            ],
            ['nao_escaladas', 'Não Escaladas', 'number'],
        ],
    ] as const;

    return (
        <AdminLayout
            title="Gestão de Fretes - Lançar"
            active="freight-launch"
            module="freight"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Lançar Fretes</h2>
                    <p className="text-sm text-muted-foreground">
                        Um único lançamento para alimentar visão diária, mensal,
                        dashboard e linha do tempo.
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
                        <CardTitle>Lançamento diário por unidade</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando formulário...
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {sections.map((section, sectionIndex) => (
                                    <div
                                        key={sectionIndex}
                                        className="grid gap-3 md:grid-cols-3"
                                    >
                                        {section.map(([field, label, type]) => (
                                            <div
                                                key={field}
                                                className="space-y-2"
                                            >
                                                <Label htmlFor={field}>
                                                    {label}
                                                </Label>
                                                {type === 'select' ? (
                                                    <Select
                                                        value={form.unidade_id}
                                                        onValueChange={(
                                                            value,
                                                        ) =>
                                                            setForm(
                                                                (previous) => ({
                                                                    ...previous,
                                                                    unidade_id:
                                                                        value,
                                                                }),
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id={field}
                                                        >
                                                            <SelectValue placeholder="Selecione" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {unidades.map(
                                                                (unidade) => (
                                                                    <SelectItem
                                                                        key={
                                                                            unidade.id
                                                                        }
                                                                        value={String(
                                                                            unidade.id,
                                                                        )}
                                                                    >
                                                                        {
                                                                            unidade.nome
                                                                        }
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Input
                                                        id={field}
                                                        type={type}
                                                        step={
                                                            type === 'number'
                                                                ? '0.01'
                                                                : undefined
                                                        }
                                                        value={
                                                            form[
                                                                field as keyof FormDataState
                                                            ]
                                                        }
                                                        readOnly={
                                                            field ===
                                                                'frete_liquido' ||
                                                            field ===
                                                                'cargas_liq' ||
                                                            field === 'aves_liq'
                                                        }
                                                        onChange={(event) =>
                                                            setForm(
                                                                (previous) => ({
                                                                    ...previous,
                                                                    [field]:
                                                                        event
                                                                            .target
                                                                            .value,
                                                                }),
                                                            )
                                                        }
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ))}

                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="placas">Placas</Label>
                                        <Input
                                            id="placas"
                                            value={form.placas}
                                            onChange={(event) =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    placas: event.target.value,
                                                }))
                                            }
                                            placeholder="Ex.: ABC1D23, EFG4H56"
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="obs">Obs.</Label>
                                        <textarea
                                            id="obs"
                                            value={form.obs}
                                            className="flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                                            onChange={(
                                                event: React.ChangeEvent<HTMLTextAreaElement>,
                                            ) =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    obs: event.target.value,
                                                }))
                                            }
                                            rows={2}
                                        />
                                    </div>
                                </div>

                                <div className="rounded-md border bg-muted/20 p-3 text-sm">
                                    <p className="font-medium">
                                        Preenchimento automático dos campos
                                        líquidos
                                    </p>
                                    <p className="text-muted-foreground">
                                        Frete Líq:{' '}
                                        {freteLiquidoCalculado.toLocaleString(
                                            'pt-BR',
                                            {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            },
                                        )}{' '}
                                        • Cargas Líq: {cargasLiqCalculadas} •
                                        Aves Líq: {avesLiqCalculadas}
                                    </p>
                                </div>

                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        onClick={() => void handleSubmit()}
                                        disabled={saving}
                                    >
                                        {saving ? (
                                            <>
                                                <LoaderCircle className="size-4 animate-spin" />
                                                Salvando...
                                            </>
                                        ) : (
                                            'Salvar lançamento'
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
