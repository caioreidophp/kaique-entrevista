import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/transport/admin-layout';
import {
    hasMeaningfulInterviewDraftData,
    InterviewForm,
} from '@/components/transport/interview-form';
import { Notification } from '@/components/transport/notification';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { apiGet, apiPost } from '@/lib/api-client';
import { loadReferenceCitiesCached } from '@/lib/reference-cities-cache';
import type { DriverInterviewFormData } from '@/types/driver-interview';

const INTERVIEW_DRAFT_STORAGE_KEY = 'transport:interview:create-draft:v1';

interface InterviewDraftSnapshot {
    version: number;
    updatedAt: string;
    step: number;
    data: DriverInterviewFormData;
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

function isInterviewDraftSnapshot(
    value: unknown,
): value is InterviewDraftSnapshot {
    if (!value || typeof value !== 'object') return false;

    const draft = value as Partial<InterviewDraftSnapshot>;

    return Boolean(
        typeof draft.version === 'number' &&
        typeof draft.updatedAt === 'string' &&
        typeof draft.step === 'number' &&
        draft.data &&
        typeof draft.data === 'object',
    );
}

function formatDraftDate(value: string): string {
    const date = new Date(value);

    if (isNaN(date.getTime())) return value;

    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function TransportInterviewsCreatePage() {
    const [success, setSuccess] = useState<string | null>(null);
    const [draftSnapshot, setDraftSnapshot] =
        useState<InterviewDraftSnapshot | null>(null);
    const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
    const [draftResolved, setDraftResolved] = useState(false);
    const [initialDraftData, setInitialDraftData] = useState<
        Partial<DriverInterviewFormData> | undefined
    >(undefined);
    const [initialStep, setInitialStep] = useState<number>(0);
    const [currentStep, setCurrentStep] = useState<number>(0);
    const [currentCandidateName, setCurrentCandidateName] =
        useState<string>('');
    const [hiringUnitOptions, setHiringUnitOptions] = useState<UnitOption[]>(
        [],
    );
    const [cityOptions, setCityOptions] = useState<CityOption[]>([]);

    const dynamicTitle =
        currentStep > 0 && currentCandidateName.trim().length > 0
            ? currentCandidateName.trim()
            : 'Nova entrevista';

    useEffect(() => {
        if (typeof window === 'undefined') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDraftResolved(true);
            return;
        }

        const raw = window.localStorage.getItem(INTERVIEW_DRAFT_STORAGE_KEY);

        if (!raw) {
             
            setDraftResolved(true);
            return;
        }

        try {
            const parsed = JSON.parse(raw) as unknown;

            if (!isInterviewDraftSnapshot(parsed)) {
                window.localStorage.removeItem(INTERVIEW_DRAFT_STORAGE_KEY);
                 
                setDraftResolved(true);
                return;
            }

            if (!hasMeaningfulInterviewDraftData(parsed.data)) {
                window.localStorage.removeItem(INTERVIEW_DRAFT_STORAGE_KEY);
                setDraftResolved(true);
                return;
            }

            setDraftSnapshot(parsed);
            setResumeDialogOpen(true);
        } catch {
            window.localStorage.removeItem(INTERVIEW_DRAFT_STORAGE_KEY);
             
            setDraftResolved(true);
        }
    }, []);

    useEffect(() => {
        apiGet<WrappedResponse<UnitOption[]>>('/registry/unidades')
            .then((response) => setHiringUnitOptions(response.data))
            .catch(() => setHiringUnitOptions([]));
    }, []);

    useEffect(() => {
        loadReferenceCitiesCached()
            .then((cities) => setCityOptions(cities))
            .catch(() => setCityOptions([]));
    }, []);

    function handleResumeDraft(): void {
        if (!draftSnapshot) {
            setDraftResolved(true);
            setResumeDialogOpen(false);
            return;
        }

        setInitialDraftData(draftSnapshot.data);
        setInitialStep(draftSnapshot.step);
        setDraftResolved(true);
        setResumeDialogOpen(false);
    }

    function handleDiscardDraft(): void {
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(INTERVIEW_DRAFT_STORAGE_KEY);
        }

        setDraftSnapshot(null);
        setInitialDraftData(undefined);
        setInitialStep(0);
        setDraftResolved(true);
        setResumeDialogOpen(false);
    }

    async function handleSubmit(
        payload: Record<string, unknown>,
    ): Promise<void> {
        await apiPost('/driver-interviews', payload);
        setSuccess('Entrevista cadastrada com sucesso.');
        window.setTimeout(() => {
            router.visit('/transport/interviews');
        }, 700);
    }

    return (
        <AdminLayout title="Nova entrevista" active="create">
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">{dynamicTitle}</h2>
                </div>

                {success ? (
                    <Notification message={success} variant="success" />
                ) : null}

                <Dialog
                    open={resumeDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) {
                            handleDiscardDraft();
                        }
                    }}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                Retomar cadastro em andamento?
                            </DialogTitle>
                            <DialogDescription>
                                Encontramos um rascunho não finalizado.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
                            <p>
                                <span className="font-medium">Candidato:</span>{' '}
                                {draftSnapshot?.data.full_name?.trim() ||
                                    'Sem nome informado'}
                            </p>
                            <p>
                                <span className="font-medium">
                                    Última edição:
                                </span>{' '}
                                {draftSnapshot
                                    ? formatDraftDate(draftSnapshot.updatedAt)
                                    : '-'}
                            </p>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleDiscardDraft}
                            >
                                Não, começar do zero
                            </Button>
                            <Button type="button" onClick={handleResumeDraft}>
                                Sim, retomar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {draftResolved ? (
                    <InterviewForm
                        mode="create"
                        initialDraftData={initialDraftData}
                        initialStep={initialStep}
                        draftStorageKey={INTERVIEW_DRAFT_STORAGE_KEY}
                        hiringUnitOptions={hiringUnitOptions}
                        cityOptions={cityOptions}
                        onProgressChange={({ fullName, step }) => {
                            setCurrentCandidateName(fullName);
                            setCurrentStep(step);
                        }}
                        onSubmit={handleSubmit}
                    />
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Carregando rascunho...
                    </p>
                )}
            </div>
        </AdminLayout>
    );
}
