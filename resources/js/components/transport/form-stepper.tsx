import { Check } from 'lucide-react';

type StepState = 'pending' | 'complete' | 'warning';

interface FormStepperProps {
    steps: string[];
    currentStep: number;
    onStepClick: (index: number) => void;
    stepStates?: StepState[];
    emphasizeWarnings?: boolean;
}

export function FormStepper({
    steps,
    currentStep,
    onStepClick,
    stepStates,
    emphasizeWarnings = false,
}: FormStepperProps) {
    const topRow = steps.slice(0, 4);
    const bottomRow = steps.slice(4);

    const renderRow = (rowSteps: string[], offset: number) => (
        <div className="grid gap-3 md:grid-cols-4">
            {rowSteps.map((step, index) => {
                const absoluteIndex = index + offset;
                const isCurrent = absoluteIndex === currentStep;
                const isCompleted = absoluteIndex < currentStep;
                const stepState = stepStates?.[absoluteIndex] ?? 'pending';
                const showWarning = isCompleted && stepState === 'warning';
                const warningEmphasized = showWarning && emphasizeWarnings;

                return (
                    <button
                        key={step}
                        type="button"
                        onClick={() => onStepClick(absoluteIndex)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition sm:text-sm ${
                            isCurrent
                                ? 'border-primary bg-primary/10 shadow-xs'
                                                                : warningEmphasized
                                                                    ? 'border-destructive/50 bg-destructive/5'
                                : isCompleted
                                  ? 'border-primary/50 bg-primary/5'
                                  : 'hover:bg-background'
                        }`}
                    >
                        <span
                            className={`inline-flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
                                isCurrent
                                    ? 'border-primary bg-primary text-primary-foreground'
                                                                        : warningEmphasized
                                                                            ? 'border-destructive/50 bg-destructive/15 text-destructive'
                                    : isCompleted
                                      ? 'border-primary/50 bg-primary/20 text-foreground'
                                      : 'border-border bg-background text-muted-foreground'
                            }`}
                        >
                            {showWarning ? (
                                '!'
                            ) : isCompleted ? (
                                <Check className="size-3.5" />
                            ) : (
                                absoluteIndex + 1
                            )}
                        </span>
                        <span className="leading-tight">{step}</span>
                    </button>
                );
            })}

            {rowSteps.length < 4
                ? Array.from({ length: 4 - rowSteps.length }).map(
                      (_, index) => (
                          <div
                              key={`empty-${offset}-${index}`}
                              className="hidden md:block"
                          />
                      ),
                  )
                : null}
        </div>
    );

    return (
        <div className="rounded-xl border bg-muted/20 p-4">
            <div className="space-y-3">
                {renderRow(topRow, 0)}
                {bottomRow.length > 0 ? renderRow(bottomRow, 4) : null}
            </div>
        </div>
    );
}
