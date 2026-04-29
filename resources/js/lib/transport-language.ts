export type TransportLanguage = 'pt-BR' | 'en-US';

export const TRANSPORT_LANGUAGE_STORAGE_KEY = 'transport.language';
export const TRANSPORT_LANGUAGE_EVENT = 'transport:language-changed';
const DEFAULT_LANGUAGE: TransportLanguage = 'pt-BR';

export function normalizeTransportLanguage(value: unknown): TransportLanguage {
    if (value === 'en-US' || value === 'pt-BR') {
        return value;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();

        if (normalized === 'en' || normalized === 'en-us') {
            return 'en-US';
        }

        if (normalized === 'pt' || normalized === 'pt-br') {
            return 'pt-BR';
        }
    }

    return DEFAULT_LANGUAGE;
}

export function getStoredTransportLanguage(): TransportLanguage {
    if (typeof window === 'undefined') {
        return DEFAULT_LANGUAGE;
    }

    return normalizeTransportLanguage(
        window.localStorage.getItem(TRANSPORT_LANGUAGE_STORAGE_KEY),
    );
}

export function setStoredTransportLanguage(language: TransportLanguage): void {
    if (typeof window === 'undefined') {
        return;
    }

    const normalizedLanguage = normalizeTransportLanguage(language);

    window.localStorage.setItem(
        TRANSPORT_LANGUAGE_STORAGE_KEY,
        normalizedLanguage,
    );
    document.documentElement.lang = normalizedLanguage;
    window.dispatchEvent(
        new CustomEvent<{ language: TransportLanguage }>(
            TRANSPORT_LANGUAGE_EVENT,
            {
                detail: {
                    language: normalizedLanguage,
                },
            },
        ),
    );
}

export function getTransportIntlLocale(): string {
    if (typeof window === 'undefined') {
        return DEFAULT_LANGUAGE;
    }

    return normalizeTransportLanguage(
        window.localStorage.getItem(TRANSPORT_LANGUAGE_STORAGE_KEY),
    );
}
