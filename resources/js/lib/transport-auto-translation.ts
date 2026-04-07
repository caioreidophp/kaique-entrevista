import type { TransportLanguage } from '@/lib/transport-language';

const TRANSLATION_CACHE_KEY = 'transport.translation.cache.en-US.v1';
const MAX_CACHE_ENTRIES = 5000;
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label'] as const;

type TranslatableAttribute = (typeof TRANSLATABLE_ATTRIBUTES)[number];

const EXCLUDED_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'TEXTAREA',
    'INPUT',
    'SELECT',
    'OPTION',
    'CODE',
    'PRE',
    'KBD',
]);

const STATIC_TRANSLATIONS: Record<string, string> = {
    'Gestão de Fretes': 'Freight Management',
    Configurações: 'Settings',
    'Lista de Fretes': 'Freight List',
    'Lançar Fretes': 'Launch Freight',
    'Lançar Férias': 'Launch Vacation',
    'Lista de Férias': 'Vacation List',
    'Dashboard de Fretes': 'Freight Dashboard',
    'Dashboard Pagamentos': 'Payroll Dashboard',
    Entrevistas: 'Interviews',
    'Próximos Passos': 'Next Steps',
    Colaboradores: 'Collaborators',
    Usuários: 'Users',
    Funções: 'Functions',
    'Tipo de Pagamentos': 'Payment Types',
    'Placas e Aviários': 'Plates and Aviaries',
    Pendências: 'Pending Items',
};

let translationCache: Map<string, string> | null = null;
let cachePersistTimeout: number | null = null;
const inFlightTranslations = new Map<string, Promise<string>>();

type AttributeOriginals = Map<HTMLElement, Map<TranslatableAttribute, string>>;
type AttributeQueue = Map<HTMLElement, Set<TranslatableAttribute>>;

function normalizeText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function shouldTranslateText(value: string): boolean {
    const trimmed = normalizeText(value);

    if (trimmed.length < 2 || trimmed.length > 500) {
        return false;
    }

    if (/^[\d\s.,:/()[\]{}%+\-]+$/.test(trimmed)) {
        return false;
    }

    if (
        /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(trimmed)
        || /^https?:\/\//i.test(trimmed)
        || trimmed.startsWith('/')
    ) {
        return false;
    }

    if (trimmed.includes('`')) {
        return false;
    }

    const lettersOnly = trimmed.replace(/[^A-Za-zÀ-ÿ]/g, '');

    if (lettersOnly.length === 0) {
        return false;
    }

    return true;
}

function withOriginalPadding(original: string, translated: string): string {
    const leading = original.match(/^\s*/)?.[0] ?? '';
    const trailing = original.match(/\s*$/)?.[0] ?? '';

    return `${leading}${translated}${trailing}`;
}

function getTranslationCache(): Map<string, string> {
    if (translationCache) {
        return translationCache;
    }

    const cache = new Map<string, string>(Object.entries(STATIC_TRANSLATIONS));

    if (typeof window !== 'undefined') {
        try {
            const raw = window.localStorage.getItem(TRANSLATION_CACHE_KEY);

            if (raw) {
                const parsed = JSON.parse(raw) as Record<string, unknown>;

                if (parsed && typeof parsed === 'object') {
                    Object.entries(parsed).forEach(([key, value]) => {
                        if (typeof key === 'string' && typeof value === 'string') {
                            cache.set(key, value);
                        }
                    });
                }
            }
        } catch {
            // Ignore invalid local cache and keep in-memory defaults.
        }
    }

    translationCache = cache;

    return cache;
}

function trimCache(cache: Map<string, string>): void {
    while (cache.size > MAX_CACHE_ENTRIES) {
        const oldestKey = cache.keys().next().value;

        if (typeof oldestKey !== 'string') {
            break;
        }

        cache.delete(oldestKey);
    }
}

function scheduleCachePersist(): void {
    if (typeof window === 'undefined') {
        return;
    }

    if (cachePersistTimeout !== null) {
        return;
    }

    cachePersistTimeout = window.setTimeout(() => {
        cachePersistTimeout = null;

        try {
            const cache = getTranslationCache();
            trimCache(cache);
            window.localStorage.setItem(
                TRANSLATION_CACHE_KEY,
                JSON.stringify(Object.fromEntries(cache.entries())),
            );
        } catch {
            // Ignore persist failures (quota/private mode).
        }
    }, 900);
}

function extractTranslatedText(payload: unknown): string {
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
        return '';
    }

    return (payload[0] as unknown[])
        .map((part) => (Array.isArray(part) ? String(part[0] ?? '') : ''))
        .join('');
}

async function translatePtToEn(text: string): Promise<string> {
    const normalized = normalizeText(text);
    const cache = getTranslationCache();

    const cached = cache.get(normalized);

    if (cached) {
        return cached;
    }

    const inFlight = inFlightTranslations.get(normalized);

    if (inFlight) {
        return inFlight;
    }

    const promise = (async () => {
        try {
            const endpoint = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=pt&tl=en&dt=t&q=${encodeURIComponent(normalized)}`;
            const response = await fetch(endpoint, {
                headers: {
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                return normalized;
            }

            const payload = (await response.json()) as unknown;
            const translated = normalizeText(extractTranslatedText(payload));
            const safeValue = translated || normalized;

            cache.set(normalized, safeValue);
            trimCache(cache);
            scheduleCachePersist();

            return safeValue;
        } catch {
            return normalized;
        } finally {
            inFlightTranslations.delete(normalized);
        }
    })();

    inFlightTranslations.set(normalized, promise);

    return promise;
}

function isExcludedElement(element: Element): boolean {
    if (EXCLUDED_TAGS.has(element.tagName)) {
        return true;
    }

    return Boolean(element.closest('[data-transport-translate="off"]'));
}

function queueAttribute(
    element: HTMLElement,
    attribute: TranslatableAttribute,
    attributeOriginals: AttributeOriginals,
    pendingAttributes: AttributeQueue,
    refreshOriginal: boolean,
): void {
    if (isExcludedElement(element)) {
        return;
    }

    const value = element.getAttribute(attribute);

    if (!value || !shouldTranslateText(value)) {
        return;
    }

    let originals = attributeOriginals.get(element);

    if (!originals) {
        originals = new Map<TranslatableAttribute, string>();
        attributeOriginals.set(element, originals);
    }

    if (refreshOriginal || !originals.has(attribute)) {
        originals.set(attribute, value);
    }

    let queuedAttributes = pendingAttributes.get(element);

    if (!queuedAttributes) {
        queuedAttributes = new Set<TranslatableAttribute>();
        pendingAttributes.set(element, queuedAttributes);
    }

    queuedAttributes.add(attribute);
}

function queueElementAttributes(
    element: HTMLElement,
    attributeOriginals: AttributeOriginals,
    pendingAttributes: AttributeQueue,
    refreshOriginal: boolean,
): void {
    TRANSLATABLE_ATTRIBUTES.forEach((attribute) => {
        queueAttribute(
            element,
            attribute,
            attributeOriginals,
            pendingAttributes,
            refreshOriginal,
        );
    });
}

export function mountTransportAutoTranslation(
    root: HTMLElement,
    language: TransportLanguage,
): () => void {
    if (language !== 'en-US') {
        return () => {
            // Nothing to clean when translation mode is disabled.
        };
    }

    const textOriginals = new Map<Text, string>();
    const attributeOriginals: AttributeOriginals = new Map();
    const pendingTextNodes = new Set<Text>();
    const pendingAttributes: AttributeQueue = new Map();

    let disposed = false;
    let applying = false;
    let scheduled = false;

    function scheduleRun(): void {
        if (scheduled || disposed) {
            return;
        }

        scheduled = true;

        window.setTimeout(() => {
            void processPending();
        }, 0);
    }

    function queueTextNode(node: Text, refreshOriginal: boolean): void {
        const parent = node.parentElement;

        if (!parent || isExcludedElement(parent)) {
            return;
        }

        const value = node.textContent ?? '';

        if (!shouldTranslateText(value)) {
            return;
        }

        if (refreshOriginal || !textOriginals.has(node)) {
            textOriginals.set(node, value);
        }

        pendingTextNodes.add(node);
        scheduleRun();
    }

    function queueNodeTree(node: Node, refreshOriginal = false): void {
        if (node instanceof Text) {
            queueTextNode(node, refreshOriginal);
            return;
        }

        if (!(node instanceof HTMLElement) || isExcludedElement(node)) {
            return;
        }

        queueElementAttributes(node, attributeOriginals, pendingAttributes, refreshOriginal);

        const textWalker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);

        while (textWalker.nextNode()) {
            const currentText = textWalker.currentNode;

            if (currentText instanceof Text) {
                queueTextNode(currentText, refreshOriginal);
            }
        }

        const elementWalker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);

        while (elementWalker.nextNode()) {
            const currentElement = elementWalker.currentNode;

            if (currentElement instanceof HTMLElement) {
                queueElementAttributes(
                    currentElement,
                    attributeOriginals,
                    pendingAttributes,
                    refreshOriginal,
                );
            }
        }
    }

    async function processPending(): Promise<void> {
        scheduled = false;

        if (disposed) {
            return;
        }

        const textJobs = Array.from(pendingTextNodes)
            .filter((node) => node.isConnected)
            .map((node) => {
                const original = textOriginals.get(node) ?? node.textContent ?? '';

                if (!shouldTranslateText(original)) {
                    return null;
                }

                return {
                    node,
                    original,
                    normalized: normalizeText(original),
                };
            })
            .filter((job): job is { node: Text; original: string; normalized: string } => Boolean(job));

        pendingTextNodes.clear();

        const attributeJobs: Array<{
            element: HTMLElement;
            attribute: TranslatableAttribute;
            original: string;
            normalized: string;
        }> = [];

        pendingAttributes.forEach((attributes, element) => {
            if (!element.isConnected) {
                return;
            }

            const originals = attributeOriginals.get(element);

            if (!originals) {
                return;
            }

            attributes.forEach((attribute) => {
                const original = originals.get(attribute);

                if (!original || !shouldTranslateText(original)) {
                    return;
                }

                attributeJobs.push({
                    element,
                    attribute,
                    original,
                    normalized: normalizeText(original),
                });
            });
        });

        pendingAttributes.clear();

        if (textJobs.length === 0 && attributeJobs.length === 0) {
            return;
        }

        const uniqueOriginals = Array.from(
            new Set([
                ...textJobs.map((job) => job.normalized),
                ...attributeJobs.map((job) => job.normalized),
            ]),
        );

        const translations = new Map<string, string>();
        const batchSize = 6;

        for (let index = 0; index < uniqueOriginals.length; index += batchSize) {
            const batch = uniqueOriginals.slice(index, index + batchSize);

            const results = await Promise.all(
                batch.map((value) => translatePtToEn(value)),
            );

            batch.forEach((value, itemIndex) => {
                translations.set(value, results[itemIndex] ?? value);
            });

            if (disposed) {
                return;
            }
        }

        applying = true;

        try {
            textJobs.forEach((job) => {
                const translated = translations.get(job.normalized) ?? job.normalized;

                if (!job.node.isConnected || translated === job.normalized) {
                    return;
                }

                job.node.textContent = withOriginalPadding(job.original, translated);
            });

            attributeJobs.forEach((job) => {
                const translated = translations.get(job.normalized) ?? job.normalized;

                if (!job.element.isConnected || translated === job.normalized) {
                    return;
                }

                job.element.setAttribute(
                    job.attribute,
                    withOriginalPadding(job.original, translated),
                );
            });
        } finally {
            applying = false;
        }
    }

    const observer = new MutationObserver((mutations) => {
        if (disposed || applying) {
            return;
        }

        mutations.forEach((mutation) => {
            if (mutation.type === 'characterData' && mutation.target instanceof Text) {
                queueTextNode(mutation.target, true);
                return;
            }

            if (
                mutation.type === 'attributes'
                && mutation.target instanceof HTMLElement
                && mutation.attributeName
                && (TRANSLATABLE_ATTRIBUTES as readonly string[]).includes(mutation.attributeName)
            ) {
                queueAttribute(
                    mutation.target,
                    mutation.attributeName as TranslatableAttribute,
                    attributeOriginals,
                    pendingAttributes,
                    true,
                );
                scheduleRun();
                return;
            }

            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    queueNodeTree(node, true);
                });
            }
        });
    });

    observer.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    });

    queueNodeTree(root, true);

    return () => {
        disposed = true;
        observer.disconnect();

        applying = true;

        try {
            textOriginals.forEach((original, node) => {
                if (node.isConnected) {
                    node.textContent = original;
                }
            });

            attributeOriginals.forEach((attributes, element) => {
                if (!element.isConnected) {
                    return;
                }

                attributes.forEach((original, attribute) => {
                    element.setAttribute(attribute, original);
                });
            });
        } finally {
            applying = false;
        }
    };
}