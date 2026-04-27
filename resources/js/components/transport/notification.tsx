import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type NotificationVariant = 'success' | 'error' | 'info';

interface NotificationProps {
    message: string;
    variant?: NotificationVariant;
    autoHideMs?: number;
    onClose?: () => void;
}

const variantClasses: Record<NotificationVariant, string> = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    error: 'border-red-200 bg-red-50 text-red-950',
    info: 'border-slate-200 bg-slate-50 text-slate-900',
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
            className={`fixed top-4 right-4 z-[120] max-w-[min(92vw,440px)] rounded-lg border px-3 py-2 text-sm shadow-md backdrop-blur-sm ${variantClasses[variant]}`}
        >
            <div className="flex items-start gap-2">
                <Icon className="mt-0.5 size-4 shrink-0" />
                <span className="whitespace-pre-line leading-relaxed">{message}</span>
                <button
                    type="button"
                    className="ml-2 inline-flex size-5 items-center justify-center rounded text-current/70 transition-colors hover:bg-black/5 hover:text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    onClick={() => {
                        setDismissedKey(notificationKey);
                        onClose?.();
                    }}
                    aria-label="Fechar notificação"
                >
                    <X className="size-3.5" />
                </button>
            </div>
        </div>
    );
}
