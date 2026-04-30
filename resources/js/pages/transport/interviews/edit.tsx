import { router } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import { InterviewForm } from '@/components/transport/interview-form';
import { Notification } from '@/components/transport/notification';
import { apiGet, apiPut } from '@/lib/api-client';
import {
    splitInterviewPayload,
    syncInterviewAttachments,
} from '@/lib/interview-attachments';
import { loadReferenceCitiesCached } from '@/lib/reference-cities-cache';
import type {
    ApiPaginatedResponse,
    DriverInterview,
    InterviewCurriculumListItem,
} from '@/types/driver-interview';

interface EditPageProps {
    interviewId: number;
}

interface UnitOption {
    id: number;
    nome: string;
}

interface CityOption {
    value: string;
    label: string;
}

interface WrappedResponse<T> {
    data: T;
}

export default function TransportInterviewsEditPage({
    interviewId,
}: EditPageProps) {
    const [item, setItem] = useState<DriverInterview | null>(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hiringUnitOptions, setHiringUnitOptions] = useState<UnitOption[]>(
        [],
    );
    const [curriculumOptions, setCurriculumOptions] = useState<
        Array<{
            id: number;
            full_name: string;
            has_cnh_attachment?: boolean;
            has_work_card_attachment?: boolean;
        }>
    >([]);
    const [cityOptions, setCityOptions] = useState<CityOption[]>([]);

    useEffect(() => {
        apiGet<{ data: DriverInterview }>(`/driver-interviews/${interviewId}`)
            .then((response) => setItem(response.data))
            .catch(() => setError('Não foi possível carregar a entrevista.'))
            .finally(() => setLoading(false));
    }, [interviewId]);

    useEffect(() => {
        apiGet<WrappedResponse<UnitOption[]>>('/registry/unidades')
            .then((response) => setHiringUnitOptions(response.data))
            .catch(() => setHiringUnitOptions([]));
    }, []);

    useEffect(() => {
        apiGet<ApiPaginatedResponse<InterviewCurriculumListItem>>(
            '/interview-curriculums?tab=pendentes&per_page=200',
        )
            .then((response) => {
                const options = response.data.map((curriculum) => ({
                    id: curriculum.id,
                    full_name: curriculum.full_name,
                    has_cnh_attachment: curriculum.has_cnh_attachment,
                    has_work_card_attachment:
                        curriculum.has_work_card_attachment,
                }));

                if (
                    item?.curriculum &&
                    !options.some((option) => option.id === item.curriculum?.id)
                ) {
                    options.unshift({
                        id: item.curriculum.id,
                        full_name: item.curriculum.full_name,
                        has_cnh_attachment: Boolean(
                            item.curriculum.has_cnh_attachment,
                        ),
                        has_work_card_attachment: Boolean(
                            item.curriculum.has_work_card_attachment,
                        ),
                    });
                }

                setCurriculumOptions(options);
            })
            .catch(() => {
                if (item?.curriculum) {
                    setCurriculumOptions([
                        {
                            id: item.curriculum.id,
                            full_name: item.curriculum.full_name,
                            has_cnh_attachment: Boolean(
                                item.curriculum.has_cnh_attachment,
                            ),
                            has_work_card_attachment: Boolean(
                                item.curriculum.has_work_card_attachment,
                            ),
                        },
                    ]);

                    return;
                }

                setCurriculumOptions([]);
            });
    }, [item?.curriculum]);

    useEffect(() => {
        loadReferenceCitiesCached()
            .then((cities) => setCityOptions(cities))
            .catch(() => setCityOptions([]));
    }, []);

    async function handleSubmit(
        payload: Record<string, unknown>,
    ): Promise<void> {
        const { data, attachments } = splitInterviewPayload(payload);

        await apiPut(`/driver-interviews/${interviewId}`, data);
        await syncInterviewAttachments(interviewId, attachments);

        setMessage('Entrevista atualizada com sucesso.');
        window.setTimeout(() => {
            router.visit(`/transport/interviews/${interviewId}`);
        }, 700);
    }

    return (
        <AdminLayout title="Editar entrevista" active="interviews">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">
                        Editar entrevista
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Atualize os dados coletados durante a entrevista.
                    </p>
                </div>

                {error ? (
                    <Notification message={error} variant="error" />
                ) : null}
                {message ? (
                    <Notification message={message} variant="success" />
                ) : null}

                {loading ? (
                    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Carregando entrevista...
                    </p>
                ) : item ? (
                    <InterviewForm
                        mode="edit"
                        initialData={item}
                        hiringUnitOptions={hiringUnitOptions}
                        curriculumOptions={curriculumOptions}
                        cityOptions={cityOptions}
                        onSubmit={handleSubmit}
                    />
                ) : null}
            </div>
        </AdminLayout>
    );
}
