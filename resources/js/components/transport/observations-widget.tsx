import { MessageSquareMore, Minimize2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const textAreaClassName =
    'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50';

interface ObservationsWidgetProps {
    postureCommunication: string;
    perceivedExperience: string;
    generalObservations: string;
    onChange: (
        field:
            | 'posture_communication'
            | 'perceived_experience'
            | 'general_observations',
        value: string,
    ) => void;
    errors: Record<string, string>;
}

export function ObservationsWidget({
    postureCommunication,
    perceivedExperience,
    generalObservations,
    onChange,
    errors,
}: ObservationsWidgetProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2 print:hidden">
            {open ? (
                <div className="w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border bg-card p-4 shadow-xl">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">
                            Observações da entrevista
                        </h3>
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                        >
                            <Minimize2 className="size-4" />
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <p className="text-xs font-medium">
                                Postura / Comunicação
                            </p>
                            <textarea
                                className={textAreaClassName}
                                value={postureCommunication}
                                onChange={(event) =>
                                    onChange(
                                        'posture_communication',
                                        event.target.value,
                                    )
                                }
                            />
                            {errors.posture_communication ? (
                                <p className="text-xs text-destructive">
                                    {errors.posture_communication}
                                </p>
                            ) : null}
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs font-medium">
                                Experiência percebida
                            </p>
                            <textarea
                                className={textAreaClassName}
                                value={perceivedExperience}
                                onChange={(event) =>
                                    onChange(
                                        'perceived_experience',
                                        event.target.value,
                                    )
                                }
                            />
                            {errors.perceived_experience ? (
                                <p className="text-xs text-destructive">
                                    {errors.perceived_experience}
                                </p>
                            ) : null}
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs font-medium">
                                Observações gerais
                            </p>
                            <textarea
                                className={textAreaClassName}
                                value={generalObservations}
                                onChange={(event) =>
                                    onChange(
                                        'general_observations',
                                        event.target.value,
                                    )
                                }
                            />
                            {errors.general_observations ? (
                                <p className="text-xs text-destructive">
                                    {errors.general_observations}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}

            <Button
                type="button"
                className="shadow-lg"
                onClick={() => setOpen((prev) => !prev)}
            >
                <MessageSquareMore className="size-4" />
                Observações
            </Button>
        </div>
    );
}
