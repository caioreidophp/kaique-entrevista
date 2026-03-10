import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

type NotificationVariant = 'success' | 'error' | 'info';

interface NotificationProps {
    message: string;
    variant?: NotificationVariant;
}

const variantClasses: Record<NotificationVariant, string> = {
    success: 'border-primary/30 bg-primary/10 text-foreground',
    error: 'border-destructive/30 bg-destructive/10 text-foreground',
    info: 'border-border bg-muted/40 text-foreground',
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
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${variantClasses[variant]}`}
        >
            <Icon className="size-4" />
            <span className="whitespace-pre-line">{message}</span>
        </div>
    );
}
