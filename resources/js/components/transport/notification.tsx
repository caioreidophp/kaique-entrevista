import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

type NotificationVariant = 'success' | 'error' | 'info';

interface NotificationProps {
    message: string;
    variant?: NotificationVariant;
}

const variantClasses: Record<NotificationVariant, string> = {
    success: 'border-primary/30 bg-primary/10 text-foreground',
    error: 'border-destructive/30 bg-destructive/10 text-foreground',
    info: 'border-border bg-muted/70 text-foreground',
};

const IconByVariant = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
};

export function Notification({ message, variant = 'info' }: NotificationProps) {
    const Icon = IconByVariant[variant];

    return (
        <div
            role="status"
            aria-live="polite"
            className={`pointer-events-none fixed top-4 right-4 z-[120] max-w-[min(92vw,420px)] rounded-md border px-3 py-2 text-sm shadow-sm backdrop-blur-sm ${variantClasses[variant]}`}
        >
            <div className="flex items-start gap-2">
                <Icon className="mt-0.5 size-4 shrink-0" />
            <span className="whitespace-pre-line">{message}</span>
            </div>
        </div>
    );
}
