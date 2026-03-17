import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError, apiGet, apiPost } from '@/lib/api-client';
import {
    decimalThousandsMaskBR,
    formatCurrencyBR,
    formatDateBR,
    formatIntegerBR,
    integerThousandsMaskBR,
    moneyMaskBR,
    toNumberSafe,
} from '@/lib/transport-format';
import type { FreightSpotEntry, FreightUnit } from '@/types/freight';

interface WrappedResponse<T> {
    data: T;
}

interface SpotPaginatedResponse {
    data: FreightSpotEntry[];
}

interface SpotFormData {
    data: string;
    unidade_origem_id: string;
    frete_spot: string;
    cargas: string;
    aves: string;
    km_rodado: string;
    obs: string;
}

const emptyForm: SpotFormData = {
    data: new Date().toISOString().slice(0, 10),
    unidade_origem_id: '',
    frete_spot: '',
    cargas: '',
    aves: '',
    km_rodado: '',
    obs: '',
};

function monthRange(month: string, year: string): { startDate: string; endDate: string } {
    const monthNumber = Math.min(12, Math.max(1, Number(month) || 1));
    const yearNumber = Number(year) || new Date().getFullYear();
    const lastDay = new Date(yearNumber, monthNumber, 0).getDate();
    const paddedMonth = String(monthNumber).padStart(2, '0');

    return {
        startDate: `${yearNumber}-${paddedMonth}-01`,
        endDate: `${yearNumber}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`,
    };
}

export default function TransportFreightSpotLaunchPage() {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const [form, setForm] = useState<SpotFormData>(emptyForm);
    const [units, setUnits] = useState<FreightUnit[]>([]);
    const [entries, setEntries] = useState<FreightSpotEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [month, setMonth] = useState(String(currentMonth));
    const [year, setYear] = useState(String(currentYear));
    const [notification, setNotification] = useState<{ message: string; variant: 'success' | 'error' | 'info' } | null>(null);

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
        () => [String(currentYear - 1), String(currentYear), String(currentYear + 1)],
        [currentYear],
    );

    async function loadData(): Promise<void> {
        const { startDate, endDate } = monthRange(month, year);

        setLoading(true);

        try {
            const [unitsResponse, entriesResponse] = await Promise.all([
                apiGet<WrappedResponse<FreightUnit[]>>('/registry/unidades'),
                apiGet<SpotPaginatedResponse>(`/freight/spot-entries?start_date=${startDate}&end_date=${endDate}&per_page=200`),
            ]);

            setUnits(unitsResponse.data);
            setEntries(entriesResponse.data);
            setForm((previous) => ({
                ...previous,
                unidade_origem_id: previous.unidade_origem_id || String(unitsResponse.data[0]?.id ?? ''),
            }));
        } catch {
            setNotification({ message: 'Não foi possível carregar os dados de frete spot.', variant: 'error' });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month, year]);

    async function handleSubmit(): Promise<void> {
        if (!form.unidade_origem_id || !form.frete_spot) {
            setNotification({ message: 'Unidade origem e frete spot são obrigatórios.', variant: 'info' });
            return;
        }

        setSaving(true);
        setNotification(null);

        try {
            await apiPost('/freight/spot-entries', {
                data: form.data,
                unidade_origem_id: Number(form.unidade_origem_id),
                frete_spot: toNumberSafe(form.frete_spot),
                cargas: toNumberSafe(form.cargas),
                aves: toNumberSafe(form.aves),
                km_rodado: toNumberSafe(form.km_rodado),
                obs: form.obs.trim() || null,
            });

            setNotification({ message: 'Frete spot lançado com sucesso.', variant: 'success' });
            setForm((previous) => ({ ...emptyForm, unidade_origem_id: previous.unidade_origem_id }));
            await loadData();
        } catch (error) {
            if (error instanceof ApiError) {
                setNotification({ message: error.message, variant: 'error' });
            } else {
                setNotification({ message: 'Não foi possível salvar o lançamento spot.', variant: 'error' });
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminLayout title="Gestão de Fretes - Lançar Fretes Spot" active="freight-spot" module="freight">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">Lançar Fretes Spot</h2>
                    <p className="text-sm text-muted-foreground">Registre os fretes fora da rota base para compor a visão de Frota (fora).</p>
                </div>

                {notification ? <Notification message={notification.message} variant={notification.variant} /> : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Lançamento Spot</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label htmlFor="spot-data">Data</Label>
                            <Input id="spot-data" type="date" value={form.data} onChange={(event) => setForm((prev) => ({ ...prev, data: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Frota origem</Label>
                            <Select
                                value={form.unidade_origem_id || undefined}
                                onValueChange={(value) => setForm((previous) => ({ ...previous, unidade_origem_id: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {units.map((unit) => (
                                        <SelectItem key={unit.id} value={String(unit.id)}>
                                            {unit.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="spot-frete">Frete Spot</Label>
                            <Input
                                id="spot-frete"
                                type="text"
                                inputMode="decimal"
                                value={form.frete_spot}
                                onChange={(event) => setForm((previous) => ({ ...previous, frete_spot: moneyMaskBR(event.target.value) }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="spot-cargas">Cargas</Label>
                            <Input
                                id="spot-cargas"
                                value={form.cargas}
                                onChange={(event) => setForm((previous) => ({ ...previous, cargas: integerThousandsMaskBR(event.target.value) }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="spot-aves">Aves</Label>
                            <Input
                                id="spot-aves"
                                value={form.aves}
                                onChange={(event) => setForm((previous) => ({ ...previous, aves: integerThousandsMaskBR(event.target.value) }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="spot-km">Km rodado</Label>
                            <Input
                                id="spot-km"
                                value={form.km_rodado}
                                onChange={(event) => setForm((previous) => ({ ...previous, km_rodado: decimalThousandsMaskBR(event.target.value) }))}
                            />
                        </div>
                        <div className="space-y-2 md:col-span-3">
                            <Label htmlFor="spot-obs">Obs.</Label>
                            <textarea
                                id="spot-obs"
                                rows={2}
                                className="flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                                value={form.obs}
                                onChange={(event) => setForm((previous) => ({ ...previous, obs: event.target.value }))}
                            />
                        </div>
                        <div className="md:col-span-3 flex justify-end">
                            <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
                                {saving ? (
                                    <>
                                        <LoaderCircle className="size-4 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    'Salvar frete spot'
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="grid gap-3 md:grid-cols-2">
                        <div>
                            <CardTitle>Lançamentos do período</CardTitle>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <Select value={month} onValueChange={setMonth}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {monthOptions.map((item) => (
                                        <SelectItem key={item.value} value={item.value}>
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Carregando...
                            </div>
                        ) : entries.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum frete spot lançado no período.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[760px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-2 pr-3 font-medium">Data</th>
                                            <th className="py-2 pr-3 font-medium">Frota origem</th>
                                            <th className="py-2 pr-3 font-medium">Frete Spot</th>
                                            <th className="py-2 pr-3 font-medium">Cargas</th>
                                            <th className="py-2 pr-3 font-medium">Aves</th>
                                            <th className="py-2 pr-3 font-medium">Km</th>
                                            <th className="py-2 pr-3 font-medium">Obs.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entries.map((entry) => (
                                            <tr key={entry.id} className="border-b last:border-b-0">
                                                <td className="py-2 pr-3">{formatDateBR(entry.data)}</td>
                                                <td className="py-2 pr-3">{entry.unidade_origem?.nome ?? '-'}</td>
                                                <td className="py-2 pr-3 font-semibold">{formatCurrencyBR(entry.frete_spot)}</td>
                                                <td className="py-2 pr-3">{entry.cargas}</td>
                                                <td className="py-2 pr-3">{entry.aves}</td>
                                                <td className="py-2 pr-3">{entry.km_rodado}</td>
                                                <td className="py-2 pr-3">{entry.obs ?? '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
