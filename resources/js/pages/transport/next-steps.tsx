import { Link } from '@inertiajs/react';
import {
    ClipboardCheck,
    LoaderCircle,
    Printer,
    Search,
    SquareArrowOutUpRight,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiGet, ApiError, apiPatch } from '@/lib/api-client';
import { getAuthToken } from '@/lib/transport-auth';
import type {
    ApiPaginatedResponse,
    NextStepCandidate,
} from '@/types/driver-interview';

interface ColaboradorLookupResponse {
    data: Array<{ id: number }>;
}

interface HiringStatusResponse {
    data: {
        foi_contratado: boolean;
        colaborador_id: number | null;
        onboarding_id: number | null;
        onboarding_status: 'em_andamento' | 'bloqueado' | 'concluido' | null;
    };
}

function extractFileNameFromDisposition(
    headerValue: string | null,
): string | null {
    if (!headerValue) return null;

    const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);

    if (utf8Match?.[1]) {
        return decodeURIComponent(utf8Match[1]);
    }

    const plainMatch = headerValue.match(/filename="?([^";]+)"?/i);

    return plainMatch?.[1] ?? null;
}

function formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');

    if (digits.length === 11) {
        return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }

    if (digits.length === 10) {
        return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }

    return phone;
}

async function openProtectedHtml(
    url: string,
    autoPrint = false,
): Promise<void> {
    const token = getAuthToken();

    if (!token) {
        throw new Error('Sessão expirada. Faça login novamente.');
    }

    const response = await fetch(url, {
        headers: {
            Accept: 'text/html',
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Não foi possível abrir o documento.');
    }

    const html = await response.text();
    const withPrint = autoPrint
        ? html.replace(
              '</body>',
              '<script>window.onload=function(){window.print();}</script></body>',
          )
        : html;

    const blob = new Blob([withPrint], { type: 'text/html;charset=utf-8' });
    const htmlUrl = URL.createObjectURL(blob);

    window.open(htmlUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(htmlUrl), 60000);
}

async function downloadProtectedPdf(
    url: string,
    fallbackFileName: string,
): Promise<void> {
    const token = getAuthToken();

    if (!token) {
        throw new Error('Sessão expirada. Faça login novamente.');
    }

    const response = await fetch(url, {
        headers: {
            Accept: 'application/pdf',
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Não foi possível baixar o PDF.');
    }

    const blob = await response.blob();
    const fileUrl = URL.createObjectURL(blob);

    const disposition = response.headers.get('Content-Disposition');
    const filename =
        extractFileNameFromDisposition(disposition) ?? fallbackFileName;

    const anchor = document.createElement('a');
    anchor.href = fileUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60000);
}

function DocumentActions({
    title,
    previewUrl,
    downloadUrl,
    fallbackName,
    onBusy,
}: {
    title: string;
    previewUrl: string;
    downloadUrl: string;
    fallbackName: string;
    onBusy: (busy: boolean) => void;
}) {
    async function handleView(): Promise<void> {
        onBusy(true);
        try {
            await openProtectedHtml(previewUrl);
        } finally {
            onBusy(false);
        }
    }

    async function handlePrint(): Promise<void> {
        onBusy(true);
        try {
            await openProtectedHtml(previewUrl, true);
        } finally {
            onBusy(false);
        }
    }

    async function handleDownload(): Promise<void> {
        onBusy(true);
        try {
            await downloadProtectedPdf(downloadUrl, fallbackName);
        } finally {
            onBusy(false);
        }
    }

    return (
        <div className="rounded-md border bg-background p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{title}</p>
                <Badge variant="outline">Documento</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleView}
                >
                    <SquareArrowOutUpRight className="size-4" />
                    Visualizar
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handlePrint}
                >
                    <Printer className="size-4" />
                    Imprimir
                </Button>
                <Button type="button" size="sm" onClick={handleDownload}>
                    Baixar PDF
                </Button>
            </div>
        </div>
    );
}

export default function TransportNextStepsPage() {
    const [items, setItems] = useState<NextStepCandidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [hiringItemId, setHiringItemId] = useState<number | null>(null);

    async function load(page = 1): Promise<void> {
        setLoading(true);
        setError(null);

        try {
            const response = await apiGet<
                ApiPaginatedResponse<NextStepCandidate>
            >(`/next-steps/candidates?per_page=10&page=${page}`);
            setItems(response.data);
            setCurrentPage(response.meta.current_page);
            setLastPage(response.meta.last_page);
        } catch (fetchError) {
            if (fetchError instanceof ApiError) {
                setError(fetchError.message);
            } else {
                setError('Não foi possível carregar os próximos passos.');
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load(1);
    }, []);

    const filteredItems = useMemo(() => {
        const term = search.trim().toLowerCase();

        if (!term) return items;

        return items.filter((item) =>
            [item.full_name, item.cpf, item.email, item.phone]
                .join(' ')
                .toLowerCase()
                .includes(term),
        );
    }, [items, search]);

    async function handleHiringAction(
        candidate: NextStepCandidate,
        hired: boolean,
    ): Promise<void> {
        setHiringItemId(candidate.id);
        setError(null);

        try {
            if (!hired) {
                const response = await apiPatch<HiringStatusResponse>(
                    `/next-steps/${candidate.id}/hiring-status`,
                    {
                        foi_contratado: false,
                    },
                );

                setItems((previous) =>
                    previous.map((item) =>
                        item.id === candidate.id
                            ? {
                                  ...item,
                                  foi_contratado: response.data.foi_contratado,
                                  colaborador_id: response.data.colaborador_id,
                                  onboarding_id: response.data.onboarding_id,
                                  onboarding_status:
                                      response.data.onboarding_status,
                              }
                            : item,
                    ),
                );

                return;
            }

            if (candidate.colaborador_id) {
                const response = await apiPatch<HiringStatusResponse>(
                    `/next-steps/${candidate.id}/hiring-status`,
                    {
                        foi_contratado: true,
                        colaborador_id: candidate.colaborador_id,
                    },
                );

                setItems((previous) =>
                    previous.map((item) =>
                        item.id === candidate.id
                            ? {
                                  ...item,
                                  foi_contratado: response.data.foi_contratado,
                                  colaborador_id: response.data.colaborador_id,
                                  onboarding_id: response.data.onboarding_id,
                                  onboarding_status:
                                      response.data.onboarding_status,
                              }
                            : item,
                    ),
                );

                return;
            }

            const lookup = await apiGet<ColaboradorLookupResponse>(
                `/registry/colaboradores?cpf=${encodeURIComponent(candidate.cpf)}&per_page=1`,
            );

            const existing = lookup.data[0];

            if (existing) {
                const response = await apiPatch<HiringStatusResponse>(
                    `/next-steps/${candidate.id}/hiring-status`,
                    {
                        foi_contratado: true,
                        colaborador_id: existing.id,
                    },
                );

                setItems((previous) =>
                    previous.map((item) =>
                        item.id === candidate.id
                            ? {
                                  ...item,
                                  foi_contratado: response.data.foi_contratado,
                                  colaborador_id: response.data.colaborador_id,
                                  onboarding_id: response.data.onboarding_id,
                                  onboarding_status:
                                      response.data.onboarding_status,
                              }
                            : item,
                    ),
                );

                return;
            }

            const params = new URLSearchParams({
                foi_contratado: '1',
            });

            const response = await apiPatch<HiringStatusResponse>(
                `/next-steps/${candidate.id}/hiring-status`,
                {
                    foi_contratado: true,
                },
            );

            setItems((previous) =>
                previous.map((item) =>
                    item.id === candidate.id
                        ? {
                              ...item,
                              foi_contratado: response.data.foi_contratado,
                              colaborador_id: response.data.colaborador_id,
                              onboarding_id: response.data.onboarding_id,
                              onboarding_status:
                                  response.data.onboarding_status,
                          }
                        : item,
                ),
            );

            if (response.data.onboarding_id) {
                window.location.assign(
                    `/transport/onboarding?onboarding=${response.data.onboarding_id}&${params.toString()}`,
                );
            }
        } catch (actionError) {
            if (actionError instanceof ApiError) {
                setError(actionError.message);
            } else {
                setError('Não foi possível atualizar o status de contratação.');
            }
        } finally {
            setHiringItemId(null);
        }
    }

    return (
        <AdminLayout title="Próximos Passos" active="next-steps">
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold">
                            Próximos Passos
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Candidatos aprovados para geração dos documentos de
                            admissão.
                        </p>
                    </div>

                    <div className="relative w-full sm:w-80">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            placeholder="Buscar por nome, CPF, e-mail..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                </div>

                {error ? (
                    <Notification message={error} variant="error" />
                ) : null}

                {busy ? (
                    <Notification
                        message="Preparando documento..."
                        variant="info"
                    />
                ) : null}

                {loading ? (
                    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando candidatos aprovados...
                    </p>
                ) : filteredItems.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-sm text-muted-foreground">
                            Nenhum candidato aprovado encontrado.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {filteredItems.map((item) => (
                            <Card key={item.id}>
                                <CardHeader className="pb-3">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        <CardTitle className="text-lg">
                                            {item.full_name}
                                        </CardTitle>
                                        <Badge variant="secondary">
                                            Aprovado
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-3 md:grid-cols-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase">
                                                CPF
                                            </p>
                                            <p className="text-sm">
                                                {item.cpf}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase">
                                                E-mail
                                            </p>
                                            <p className="text-sm">
                                                {item.email}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase">
                                                Telefone
                                            </p>
                                            <p className="text-sm">
                                                {formatPhone(item.phone)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase">
                                                Estado civil
                                            </p>
                                            <p className="text-sm">
                                                {item.marital_status}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 lg:grid-cols-2">
                                        <DocumentActions
                                            title="Checklist"
                                            previewUrl={
                                                item.documents.checklist
                                                    .preview_url
                                            }
                                            downloadUrl={
                                                item.documents.checklist
                                                    .download_url
                                            }
                                            fallbackName={`Checklist-${item.full_name.replace(/\s+/g, '')}.pdf`}
                                            onBusy={setBusy}
                                        />
                                        <DocumentActions
                                            title="Raça e Etnia"
                                            previewUrl={
                                                item.documents['raca-etnia']
                                                    .preview_url
                                            }
                                            downloadUrl={
                                                item.documents['raca-etnia']
                                                    .download_url
                                            }
                                            fallbackName={`RacaEtnia-${item.full_name.replace(/\s+/g, '')}.pdf`}
                                            onBusy={setBusy}
                                        />
                                    </div>

                                    <div className="rounded-md border bg-muted/20 p-3">
                                        <p className="mb-2 text-sm font-medium">
                                            Foi Contratado?
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={
                                                    item.foi_contratado
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                                disabled={
                                                    hiringItemId === item.id
                                                }
                                                onClick={() =>
                                                    void handleHiringAction(
                                                        item,
                                                        true,
                                                    )
                                                }
                                            >
                                                {hiringItemId === item.id ? (
                                                    <>
                                                        <LoaderCircle className="size-4 animate-spin" />
                                                        Processando...
                                                    </>
                                                ) : (
                                                    'Sim'
                                                )}
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={
                                                    !item.foi_contratado
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                                disabled={
                                                    hiringItemId === item.id
                                                }
                                                onClick={() =>
                                                    void handleHiringAction(
                                                        item,
                                                        false,
                                                    )
                                                }
                                            >
                                                Não
                                            </Button>
                                            {item.colaborador_id ? (
                                                <Badge variant="outline">
                                                    Vinculado ao colaborador #
                                                    {item.colaborador_id}
                                                </Badge>
                                            ) : null}
                                            {item.onboarding_id ? (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    asChild
                                                >
                                                    <Link
                                                        href={`/transport/onboarding?onboarding=${item.onboarding_id}`}
                                                    >
                                                        <ClipboardCheck className="size-4" />
                                                        Abrir onboarding
                                                    </Link>
                                                </Button>
                                            ) : null}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Página {currentPage} de {lastPage}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={currentPage <= 1 || loading}
                            onClick={() => load(currentPage - 1)}
                        >
                            Anterior
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={currentPage >= lastPage || loading}
                            onClick={() => load(currentPage + 1)}
                        >
                            Próxima
                        </Button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
