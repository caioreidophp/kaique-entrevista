export type TransportLanguage = 'pt-BR' | 'en-US';

export const TRANSPORT_LANGUAGE_STORAGE_KEY = 'transport.language';
export const TRANSPORT_LANGUAGE_EVENT = 'transport:language-changed';
const DEFAULT_LANGUAGE: TransportLanguage = 'pt-BR';

export function normalizeTransportLanguage(value: unknown): TransportLanguage {
    void value;

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

    void language;

    window.localStorage.setItem(TRANSPORT_LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE);
    document.documentElement.lang = DEFAULT_LANGUAGE;
    window.dispatchEvent(
        new CustomEvent<{ language: TransportLanguage }>(
            TRANSPORT_LANGUAGE_EVENT,
            {
                detail: {
                    language: DEFAULT_LANGUAGE,
                },
            },
        ),
    );
}

export function getTransportIntlLocale(): string {
    return DEFAULT_LANGUAGE;
}
