import { Link } from '@inertiajs/react';
import { Download, LoaderCircle, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { Notification } from '@/components/transport/notification';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet } from '@/lib/api-client';
import { getAuthToken } from '@/lib/transport-auth';
import type {
    DriverInterview,
    GuepStatus,
    HrStatus,
    InterviewCurriculumStatus,
} from '@/types/driver-interview';

interface ShowPageProps {
    interviewId: number;
}

function statusLabel(status: HrStatus): string {
    if (status === 'aprovado') return 'Aprovado';
    if (status === 'reprovado') return 'Reprovado';
    if (status === 'em_analise') return 'Em análise';
    if (status === 'aguardando_vaga') return 'Aguardando vaga';
    if (status === 'guep') return 'GUEP';
    return 'Teste prático';
}

function guepLabel(status: GuepStatus): string {
    if (status === 'nao_fazer') return 'Não fazer';
    if (status === 'a_fazer') return 'A fazer';
    if (status === 'aprovado') return 'Aprovado';
    if (status === 'reprovado') return 'Reprovado';
    return 'Aguardando';
}

function curriculumStatusLabel(status: InterviewCurriculumStatus): string {
    if (status === 'recusado') return 'Recusado';
    if (status === 'aguardando_entrevista') return 'Aguardando - Entrevista';
    if (status === 'aprovado_entrevista') return 'Aprovado - Entrevista';
    if (status === 'reprovado_entrevista') return 'Reprovado - Entrevista';
    return 'Pendente';
}

function Item({
    label,
    value,
}: {
    label: string;
    value: string | number | boolean | null;
}) {
    const displayValue =
        typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : (value ?? '-');

    return (
        <div className="space-y-1 print:space-y-0.5">
            <p className="text-xs text-muted-foreground uppercase print:text-[10px]">
                {label}
            </p>
            <p className="text-sm print:text-[12px] print:leading-tight">
                {displayValue}
            </p>
        </div>
    );
}

function AttachmentLink({
    label,
    url,
    fileName,
}: {
    label: string;
    url: string | null;
    fileName: string | null;
}) {
    return (
        <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase">{label}</p>
            {url ? (
                <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                    <Download className="size-3.5" />
                    {fileName?.trim() || 'Abrir arquivo'}
                </a>
            ) : (
                <p className="text-sm">-</p>
            )}
        </div>
    );
}

export default function TransportInterviewsShowPage({
    interviewId,
}: ShowPageProps) {
    const [item, setItem] = useState<DriverInterview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = useState(false);

    useEffect(() => {
        apiGet<{ data: DriverInterview }>(`/driver-interviews/${interviewId}`)
            .then((response) => setItem(response.data))
            .catch(() => setError('Não foi possível carregar a entrevista.'))
            .finally(() => setLoading(false));
    }, [interviewId]);

    async function handleOpenPdf(): Promise<void> {
        const token = getAuthToken();

        if (!token) {
            setError('Sessão expirada. Faça login novamente.');
            return;
        }

        setPdfLoading(true);

        try {
            const response = await fetch(
                `/api/driver-interviews/${interviewId}/pdf`,
                {
                    headers: {
                        Accept: 'application/pdf',
                        Authorization: `Bearer ${token}`,
                    },
                },
            );

            if (!response.ok) {
                throw new Error('Não autorizado para gerar PDF.');
            }

            const blob = await response.blob();
            const fileUrl = URL.createObjectURL(blob);
            window.open(fileUrl, '_blank', 'noopener,noreferrer');
            window.setTimeout(() => URL.revokeObjectURL(fileUrl), 30000);
        } catch {
            setError('Não foi possível gerar o PDF desta entrevista.');
        } finally {
            setPdfLoading(false);
        }
    }

    return (
        <AdminLayout title="Visualizar entrevista" active="interviews">
            <div className="transport-print space-y-6 print:space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:mb-1">
                    <div>
                        <h2 className="text-2xl font-semibold print:text-xl">
                            Visualizar entrevista
                        </h2>
                        <p className="text-sm text-muted-foreground print:text-xs">
                            Detalhes completos da ficha de entrevista do
                            motorista.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end print:hidden">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => window.print()}
                        >
                            <Printer className="size-4" />
                            Imprimir
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleOpenPdf}
                        >
                            {pdfLoading ? (
                                <>
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Gerando...
                                </>
                            ) : (
                                <>
                                    <Download className="size-4" />
                                    Gerar PDF
                                </>
                            )}
                        </Button>
                        <Button asChild>
                            <Link
                                href={`/transport/interviews/${interviewId}/edit`}
                            >
                                Editar
                            </Link>
                        </Button>
                    </div>
                </div>

                {error ? (
                    <Notification message={error} variant="error" />
                ) : null}

                {loading ? (
                    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando dados da entrevista...
                    </p>
                ) : item ? (
                    <div className="space-y-4 print:space-y-2">
                        <Card className="print:break-inside-avoid print:shadow-none">
                            <CardHeader className="print:px-4 print:py-3">
                                <CardTitle className="print:text-lg">
                                    {item.full_name}{' '}
                                    <Badge
                                        variant="secondary"
                                        className="ml-2 align-middle"
                                    >
                                        {statusLabel(item.hr_status)}
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-3 print:grid-cols-3 print:gap-2 print:px-4 print:pt-0 print:pb-4">
                                <Item
                                    label="Nome preferido"
                                    value={item.preferred_name}
                                />
                                <Item
                                    label="Data de nascimento"
                                    value={item.birth_date}
                                />
                                <Item
                                    label="Entrevistador"
                                    value={item.author?.name ?? '-'}
                                />
                                <Item label="Telefone" value={item.phone} />
                                <Item label="E-mail" value={item.email} />
                                <Item label="Cidade" value={item.city} />
                                <Item
                                    label="Unidade (contratação)"
                                    value={item.hiring_unidade?.nome ?? null}
                                />
                                <Item
                                    label="Estado civil"
                                    value={item.marital_status}
                                />
                                <Item
                                    label="Possui filhos"
                                    value={item.has_children}
                                />
                            </CardContent>
                        </Card>

                        <Card className="print:break-inside-avoid print:shadow-none">
                            <CardHeader className="print:px-4 print:py-3">
                                <CardTitle className="print:text-base">
                                    Documentos e habilitação
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-3 print:grid-cols-3 print:gap-2 print:px-4 print:pt-0 print:pb-4">
                                <Item label="CPF" value={item.cpf} />
                                <Item label="RG" value={item.rg} />
                                <Item label="CNH" value={item.cnh_number} />
                                <Item
                                    label="Categoria"
                                    value={item.cnh_category}
                                />
                                <Item
                                    label="Validade CNH"
                                    value={item.cnh_expiration_date}
                                />
                                <Item label="EAR" value={item.ear} />
                                <AttachmentLink
                                    label="Foto do candidato"
                                    url={item.candidate_photo_url}
                                    fileName={item.candidate_photo_original_name}
                                />
                                <AttachmentLink
                                    label="Anexo CNH"
                                    url={item.cnh_attachment_url}
                                    fileName={item.cnh_attachment_original_name}
                                />
                                <AttachmentLink
                                    label="Carteira de Trabalho"
                                    url={item.work_card_attachment_url}
                                    fileName={item.work_card_attachment_original_name}
                                />
                                <AttachmentLink
                                    label="Currículo"
                                    url={item.curriculum?.document_url ?? null}
                                    fileName={item.curriculum?.document_original_name ?? null}
                                />
                                <Item
                                    label="Status currículo"
                                    value={
                                        item.curriculum
                                            ? curriculumStatusLabel(
                                                  item.curriculum.status,
                                              )
                                            : 'Sem vínculo'
                                    }
                                />
                            </CardContent>
                        </Card>

                        <Card className="print:break-inside-avoid print:shadow-none">
                            <CardHeader className="print:px-4 print:py-3">
                                <CardTitle className="print:text-base">
                                    Experiência e disponibilidade
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2 print:grid-cols-2 print:gap-2 print:px-4 print:pt-0 print:pb-4">
                                <Item
                                    label="Última empresa"
                                    value={item.last_company}
                                />
                                <Item
                                    label="Última função"
                                    value={item.last_role}
                                />
                                <Item
                                    label="Última cidade"
                                    value={item.last_city}
                                />
                                <Item
                                    label="Período última empresa"
                                    value={`${item.last_period_start} até ${item.last_period_end}`}
                                />
                                <Item
                                    label="Motivo última saída"
                                    value={item.last_exit_reason}
                                />
                                <Item
                                    label="Saída última empresa"
                                    value={
                                        item.last_exit_type === 'despensa'
                                            ? 'Dispensa'
                                            : item.last_exit_type
                                    }
                                />
                                <Item
                                    label="Observação última empresa"
                                    value={item.last_company_observation}
                                />
                                <Item
                                    label="Penúltima empresa"
                                    value={item.previous_company}
                                />
                                <Item
                                    label="Penúltima função"
                                    value={item.previous_role}
                                />
                                <Item
                                    label="Penúltima cidade"
                                    value={item.previous_city}
                                />
                                <Item
                                    label="Período penúltima"
                                    value={`${item.previous_period_start} até ${item.previous_period_end}`}
                                />
                                <Item
                                    label="Motivo penúltima saída"
                                    value={item.previous_exit_reason}
                                />
                                <Item
                                    label="Saída penúltima empresa"
                                    value={
                                        item.previous_exit_type === 'despensa'
                                            ? 'Dispensa'
                                            : item.previous_exit_type
                                    }
                                />
                                <Item
                                    label="Observação penúltima empresa"
                                    value={item.previous_company_observation}
                                />
                                <Item
                                    label="Trabalho noturno"
                                    value={item.night_shift_experience}
                                />
                                <Item
                                    label="Transporte de aves vivas"
                                    value={
                                        item.live_animals_transport_experience
                                    }
                                />
                                <Item
                                    label="Acidente"
                                    value={item.accident_history}
                                />
                                <Item
                                    label="Detalhes do acidente"
                                    value={item.accident_details}
                                />
                                <Item
                                    label="Disponibilidade de escala"
                                    value={item.schedule_availability}
                                />
                                <Item
                                    label="Início disponível"
                                    value={item.start_availability_date}
                                />
                                <Item
                                    label="Conhece alguém na empresa"
                                    value={item.knows_company_contact}
                                />
                                <Item
                                    label="Contato conhecido"
                                    value={item.contact_name}
                                />
                            </CardContent>
                        </Card>

                        <Card className="print:break-inside-avoid print:shadow-none">
                            <CardHeader className="print:px-4 print:py-3">
                                <CardTitle className="print:text-base">
                                    Avaliação final
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-3 print:grid-cols-3 print:gap-2 print:px-4 print:pt-0 print:pb-4">
                                <Item
                                    label="Último salário"
                                    value={item.last_salary.toLocaleString(
                                        'pt-BR',
                                        {
                                            style: 'currency',
                                            currency: 'BRL',
                                        },
                                    )}
                                />
                                <Item
                                    label="Pretensão salarial"
                                    value={item.salary_expectation.toLocaleString(
                                        'pt-BR',
                                        {
                                            style: 'currency',
                                            currency: 'BRL',
                                        },
                                    )}
                                />
                                <Item
                                    label="Observação salarial"
                                    value={item.salary_observation}
                                />
                                <Item
                                    label="Interesse"
                                    value={item.candidate_interest}
                                />
                                <Item
                                    label="Atende disponibilidade"
                                    value={item.availability_matches}
                                />
                                <Item
                                    label="Nota geral"
                                    value={item.overall_score}
                                />
                                <Item
                                    label="Parecer RH"
                                    value={statusLabel(item.hr_status)}
                                />
                                <Item
                                    label="Status GUEP"
                                    value={guepLabel(item.guep_status)}
                                />
                            </CardContent>
                        </Card>

                        <Card className="print:break-inside-avoid print:shadow-none">
                            <CardHeader className="print:px-4 print:py-3">
                                <CardTitle className="print:text-base">
                                    Observações
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm print:space-y-2 print:px-4 print:pt-0 print:pb-4 print:text-[12px] print:leading-tight">
                                <p>
                                    <strong>Experiência relevante:</strong>{' '}
                                    {item.relevant_experience}
                                </p>
                                <p>
                                    <strong>Tipos de caminhão:</strong>{' '}
                                    {item.truck_types_operated}
                                </p>
                                <p>
                                    <strong>
                                        Expectativas sobre a empresa:
                                    </strong>{' '}
                                    {item.expectations_about_company}
                                </p>
                                <p>
                                    <strong>Postura e comunicação:</strong>{' '}
                                    {item.posture_communication}
                                </p>
                                <p>
                                    <strong>Experiência percebida:</strong>{' '}
                                    {item.perceived_experience}
                                </p>
                                <p>
                                    <strong>Observações gerais:</strong>{' '}
                                    {item.general_observations}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                ) : null}
            </div>
        </AdminLayout>
    );
}
