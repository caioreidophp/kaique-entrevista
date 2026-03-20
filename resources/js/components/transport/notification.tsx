import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type NotificationVariant = 'success' | 'error' | 'info';

interface NotificationProps {
    message: string;
    variant?: NotificationVariant;
    autoHideMs?: number;
    onClose?: () => void;
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

export function Notification({
    message,
    variant = 'info',
    autoHideMs = 5000,
    onClose,
}: NotificationProps) {
    const Icon = IconByVariant[variant];
    const [dismissedKey, setDismissedKey] = useState<string | null>(null);
    const notificationKey = useMemo(() => `${variant}:${message}`, [variant, message]);
    const isVisible = dismissedKey !== notificationKey;

    useEffect(() => {
        if (autoHideMs <= 0 || !isVisible) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setDismissedKey(notificationKey);
            onClose?.();
        }, autoHideMs);

        return () => window.clearTimeout(timeoutId);
    }, [autoHideMs, isVisible, notificationKey, onClose]);

    if (!isVisible) {
        return null;
    }

    return (
        <div
            role="status"
            aria-live="polite"
            className={`fixed top-4 right-4 z-[120] max-w-[min(92vw,420px)] rounded-md border px-3 py-2 text-sm shadow-sm backdrop-blur-sm ${variantClasses[variant]}`}
        >
            <div className="flex items-start gap-2">
                <Icon className="mt-0.5 size-4 shrink-0" />
                <span className="whitespace-pre-line">{message}</span>
                <button
                    type="button"
                    className="ml-2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    onClick={() => {
                        setDismissedKey(notificationKey);
                        onClose?.();
                    }}
                    aria-label="Fechar notificação"
                >
                    ×
                </button>
            </div>
        </div>
    );
}
