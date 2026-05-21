import type { TransportLanguage } from '@/lib/transport-language';

const TRANSLATION_CACHE_KEY = 'transport.translation.cache.en-US.v2.curated';
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

const CURATED_TRANSLATIONS: Record<string, string> = {
    acao: 'Action',
    acoes: 'Actions',
    'acesso geral': 'General access',
    'aguardando - entrevista': 'Waiting - Interview',
    'aguardando entrevista': 'Waiting for interview',
    'alterar senha': 'Change password',
    anexos: 'Attachments',
    anterior: 'Previous',
    aparencia: 'Appearance',
    aprovado: 'Approved',
    arquivos: 'Files',
    ativo: 'Active',
    'avaliacao final': 'Final evaluation',
    'aves kaique geral': 'Kaique birds total',
    'aves transportadas': 'Birds transported',
    'baixar pdf': 'Download PDF',
    'buscar no menu': 'Search menu',
    cadastro: 'Registry',
    'cargas canceladas': 'Canceled loads',
    'central analitica': 'Analytics center',
    'central de fretes': 'Freight center',
    claro: 'Light',
    colaboradores: 'Collaborators',
    comentarios: 'Comments',
    configuracoes: 'Settings',
    convocados: 'Called',
    curriculo: 'Resume',
    curriculos: 'Resumes',
    dashboard: 'Dashboard',
    'dashboard executivo': 'Executive dashboard',
    'dashboard folha': 'Payroll dashboard',
    data: 'Date',
    'data entrevista': 'Interview date',
    'data de nascimento': 'Date of birth',
    descartados: 'Discarded',
    descricao: 'Description',
    'descontos/ajustes': 'Discounts/adjustments',
    disponibilidade: 'Availability',
    documentos: 'Documents',
    editar: 'Edit',
    email: 'Email',
    'em analise': 'Under review',
    entrevista: 'Interview',
    entrevistador: 'Interviewer',
    entrevistas: 'Interviews',
    excluir: 'Delete',
    'experiencia profissional': 'Professional experience',
    ferias: 'Vacation',
    filtros: 'Filters',
    folha: 'Payroll',
    frete: 'Freight',
    'frete kaique / caminhao': 'Kaique freight / truck',
    'frete kaique / km rodado': 'Kaique freight / km driven',
    'frete kaique por dia': 'Kaique freight per day',
    'frete total': 'Total freight',
    fretes: 'Freight',
    funcao: 'Role',
    funcoes: 'Roles',
    'gerar pdf': 'Generate PDF',
    'gestao de fretes': 'Freight management',
    imprimir: 'Print',
    idioma: 'Language',
    infrações: 'Violations',
    infracoes: 'Violations',
    'kaique transportes': 'Kaique Transportes',
    'km kaique geral': 'Kaique km total',
    'km rodado': 'Km driven',
    'lancar ferias': 'Add vacation',
    'lancar fretes': 'Add freight',
    'lancar fretes spot': 'Add spot freight',
    'lancar multas': 'Add fines',
    'lancar pagamentos': 'Add payments',
    'lancar notificacao': 'Add notice',
    'limpar filtros': 'Clear filters',
    'lista de candidatos': 'Candidate list',
    'lista de ferias': 'Vacation list',
    'lista de fretes': 'Freight list',
    'lista de multas': 'Fine list',
    'lista de pagamentos': 'Payment list',
    log: 'Log',
    'log de atividades': 'Activity log',
    'modo escuro': 'Dark mode',
    'motivo descarte': 'Discard reason',
    multas: 'Fines',
    nao: 'No',
    'nao fazer': 'Do not proceed',
    'navegacao do modulo': 'Module navigation',
    nome: 'Name',
    nota: 'Score',
    'nova entrevista': 'New interview',
    'novo curriculo': 'New resume',
    observacoes: 'Notes',
    onboarding: 'Onboarding',
    pagamentos: 'Payments',
    'painel cadastro': 'Registry panel',
    'painel entrevistas': 'Interview panel',
    'painel ferias': 'Vacation panel',
    'painel folha': 'Payroll panel',
    'painel fretes': 'Freight panel',
    'painel gestao de multas': 'Fine management panel',
    'painel programacao': 'Scheduling panel',
    pendencias: 'Pending items',
    pendente: 'Pending',
    pendentes: 'Pending',
    perfil: 'Profile',
    pesquisar: 'Search',
    'placas e aviarios': 'Plates and aviaries',
    proxima: 'Next',
    'proxima etapa': 'Next step',
    'proximos passos': 'Next steps',
    programacao: 'Scheduling',
    'programacao de viagens': 'Trip scheduling',
    'qual unidade?': 'Which unit?',
    reprovado: 'Rejected',
    sair: 'Sign out',
    salario: 'Salary',
    salvar: 'Save',
    'salvar senha': 'Save password',
    'salvando...': 'Saving...',
    'senha atual': 'Current password',
    sim: 'Yes',
    status: 'Status',
    'status guep': 'GUEP status',
    'status rh': 'HR status',
    telefone: 'Phone',
    'tipo de pagamentos': 'Payment types',
    'tipos de pagamento': 'Payment types',
    'todas as funcoes': 'All roles',
    'todas as unidades': 'All units',
    todos: 'All',
    unidade: 'Unit',
    unidades: 'Units',
    usuarios: 'Users',
    ver: 'View',
    visualizar: 'View',
    'visualizar entrevista': 'View interview',
    voltar: 'Back',
};

const PHRASE_TRANSLATIONS: Array<[RegExp, string]> = [
    [/\bcurr[ií]culos?\b/gi, 'resumes'],
    [/\bpr[oó]ximos passos\b/gi, 'next steps'],
    [/\blista de candidatos\b/gi, 'candidate list'],
    [/\bgest[aã]o de fretes\b/gi, 'freight management'],
    [/\bcentral de fretes\b/gi, 'freight center'],
    [/\bcentral anal[ií]tica\b/gi, 'analytics center'],
    [/\bcargas canceladas\b/gi, 'canceled loads'],
    [/\blan[cç]ar\b/gi, 'add'],
    [/\blista de\b/gi, 'list of'],
    [/\brelat[oó]rio por\b/gi, 'report by'],
    [/\bmodo escuro\b/gi, 'dark mode'],
    [/\bmodo claro\b/gi, 'light mode'],
    [/\bacesso geral\b/gi, 'general access'],
    [/\bnavega[cç][aã]o do m[oó]dulo\b/gi, 'module navigation'],
    [/\bcontrole de f[eé]rias\b/gi, 'vacation control'],
    [/\bsem observa[cç][oõ]es\b/gi, 'no notes'],
    [/\bsem resultados\b/gi, 'no results'],
];

const WORD_TRANSLATIONS: Record<string, string> = {
    acoes: 'actions',
    acao: 'action',
    adiantamento: 'advance',
    ajuste: 'adjustment',
    ajustes: 'adjustments',
    alterar: 'change',
    amparo: 'Amparo',
    analise: 'review',
    analitica: 'analytics',
    anexo: 'attachment',
    anexos: 'attachments',
    anterior: 'previous',
    aprovado: 'approved',
    aprovados: 'approved',
    arquivo: 'file',
    arquivos: 'files',
    atalho: 'shortcut',
    atalhos: 'shortcuts',
    ativo: 'active',
    ativos: 'active',
    avaliacao: 'evaluation',
    aviarios: 'aviaries',
    banco: 'bank',
    busca: 'search',
    buscar: 'search',
    cadastro: 'registry',
    candidato: 'candidate',
    candidatos: 'candidates',
    carga: 'load',
    cargas: 'loads',
    cidade: 'city',
    claro: 'light',
    colaborador: 'collaborator',
    colaboradores: 'collaborators',
    comentario: 'comment',
    comentarios: 'comments',
    competencia: 'period',
    configuracao: 'setting',
    configuracoes: 'settings',
    contratado: 'hired',
    convocado: 'called',
    convocados: 'called',
    criar: 'create',
    dados: 'data',
    dashboard: 'dashboard',
    data: 'date',
    desconto: 'discount',
    descontos: 'discounts',
    descricao: 'description',
    descartado: 'discarded',
    descartados: 'discarded',
    documento: 'document',
    documentos: 'documents',
    editar: 'edit',
    email: 'email',
    entrevista: 'interview',
    entrevistas: 'interviews',
    entrevistador: 'interviewer',
    excluir: 'delete',
    exportar: 'export',
    ferias: 'vacation',
    filtro: 'filter',
    filtros: 'filters',
    folha: 'payroll',
    frete: 'freight',
    fretes: 'freight',
    frota: 'fleet',
    funcao: 'role',
    funcoes: 'roles',
    geral: 'general',
    gerar: 'generate',
    historico: 'history',
    idioma: 'language',
    importar: 'import',
    imprimir: 'print',
    inativo: 'inactive',
    ingles: 'English',
    infracao: 'violation',
    infracoes: 'violations',
    itapetininga: 'Itapetininga',
    kaique: 'Kaique',
    limpar: 'clear',
    log: 'log',
    mensal: 'monthly',
    multa: 'fine',
    multas: 'fines',
    nao: 'no',
    navegacao: 'navigation',
    nome: 'name',
    nota: 'score',
    notificacao: 'notice',
    observacao: 'note',
    observacoes: 'notes',
    pagamento: 'payment',
    pagamentos: 'payments',
    painel: 'panel',
    pendencia: 'pending item',
    pendencias: 'pending items',
    pendente: 'pending',
    pendentes: 'pending',
    perfil: 'profile',
    pesquisar: 'search',
    placa: 'plate',
    placas: 'plates',
    portugues: 'Portuguese',
    proxima: 'next',
    proximo: 'next',
    programacao: 'scheduling',
    rejeitado: 'rejected',
    relatorio: 'report',
    reprovado: 'rejected',
    reprovados: 'rejected',
    rh: 'HR',
    salario: 'salary',
    sair: 'sign out',
    salvar: 'save',
    senha: 'password',
    sim: 'yes',
    status: 'status',
    telefone: 'phone',
    tipo: 'type',
    todos: 'all',
    transportes: 'Transportes',
    unidade: 'unit',
    unidades: 'units',
    usuario: 'user',
    usuarios: 'users',
    valor: 'amount',
    viagem: 'trip',
    viagens: 'trips',
    visualizar: 'view',
    voltar: 'back',
};

let translationCache: Map<string, string> | null = null;

type AttributeOriginals = Map<HTMLElement, Map<TranslatableAttribute, string>>;
type AttributeQueue = Map<HTMLElement, Set<TranslatableAttribute>>;

function normalizeText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function translationKey(value: string): string {
    return normalizeText(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR');
}

function shouldTranslateText(value: string): boolean {
    const trimmed = normalizeText(value);

    if (trimmed.length < 2 || trimmed.length > 500) {
        return false;
    }

    if (/^[\d\s.,:/()[\]{}%+-]+$/.test(trimmed)) {
        return false;
    }

    if (
        /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(trimmed) ||
        /^https?:\/\//i.test(trimmed) ||
        trimmed.startsWith('/')
    ) {
        return false;
    }

    return /[A-Za-zÀ-ÿ]/.test(trimmed) && !trimmed.includes('`');
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

    const cache = new Map<string, string>(Object.entries(CURATED_TRANSLATIONS));

    if (typeof window !== 'undefined') {
        try {
            const raw = window.localStorage.getItem(TRANSLATION_CACHE_KEY);
            const parsed = raw
                ? (JSON.parse(raw) as Record<string, unknown>)
                : null;

            if (parsed && typeof parsed === 'object') {
                Object.entries(parsed).forEach(([key, value]) => {
                    if (typeof key === 'string' && typeof value === 'string') {
                        cache.set(key, value);
                    }
                });
            }
        } catch {
            // Local cache is optional; keep curated defaults when unavailable.
        }
    }

    translationCache = cache;

    return cache;
}

function persistCuratedTranslation(key: string, value: string): void {
    if (typeof window === 'undefined') {
        return;
    }

    const cache = getTranslationCache();
    cache.set(key, value);

    try {
        window.localStorage.setItem(
            TRANSLATION_CACHE_KEY,
            JSON.stringify(Object.fromEntries(cache.entries())),
        );
    } catch {
        // Ignore quota/private mode failures.
    }
}

function translateKnownPatterns(normalized: string): string | null {
    const pageMatch = normalized.match(/^pagina\s+(\d+)\s+de\s+(\d+)$/i);

    if (pageMatch) {
        return `Page ${pageMatch[1]} of ${pageMatch[2]}`;
    }

    const daysWorked = normalized.match(/^(\d+)\s+dias trabalhados$/i);

    if (daysWorked) {
        return `${daysWorked[1]} working days`;
    }

    const launches = normalized.match(/^(\d+)\s+lancamento\(s\)$/i);

    if (launches) {
        return `${launches[1]} record(s)`;
    }

    return null;
}

function translateWithVocabulary(text: string): string {
    let translated = text;

    PHRASE_TRANSLATIONS.forEach(([pattern, replacement]) => {
        translated = translated.replace(pattern, replacement);
    });

    translated = translated.replace(
        /\b[A-Za-zÀ-ÿ]+\b/g,
        (word: string): string => {
            const key = translationKey(word);
            const replacement = WORD_TRANSLATIONS[key];

            if (!replacement) {
                return word;
            }

            if (/^[A-ZÀ-Ý]+$/.test(word) && word.length > 1) {
                return replacement.toLocaleUpperCase('en-US');
            }

            if (/^[A-ZÀ-Ý]/.test(word)) {
                return (
                    replacement.charAt(0).toLocaleUpperCase('en-US') +
                    replacement.slice(1)
                );
            }

            return replacement;
        },
    );

    return normalizeText(translated);
}

async function translatePtToEn(text: string): Promise<string> {
    const normalized = normalizeText(text);
    const key = translationKey(normalized);
    const cache = getTranslationCache();
    const cached = cache.get(key);

    if (cached) {
        return cached;
    }

    const patternTranslation = translateKnownPatterns(key);

    if (patternTranslation) {
        persistCuratedTranslation(key, patternTranslation);

        return patternTranslation;
    }

    const vocabularyTranslation = translateWithVocabulary(normalized);

    if (vocabularyTranslation !== normalized) {
        persistCuratedTranslation(key, vocabularyTranslation);

        return vocabularyTranslation;
    }

    return normalized;
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

        queueElementAttributes(
            node,
            attributeOriginals,
            pendingAttributes,
            refreshOriginal,
        );

        const textWalker = document.createTreeWalker(
            node,
            NodeFilter.SHOW_TEXT,
        );

        while (textWalker.nextNode()) {
            const currentText = textWalker.currentNode;

            if (currentText instanceof Text) {
                queueTextNode(currentText, refreshOriginal);
            }
        }

        const elementWalker = document.createTreeWalker(
            node,
            NodeFilter.SHOW_ELEMENT,
        );

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
                const original =
                    textOriginals.get(node) ?? node.textContent ?? '';

                if (!shouldTranslateText(original)) {
                    return null;
                }

                return {
                    node,
                    original,
                    normalized: normalizeText(original),
                    key: translationKey(original),
                };
            })
            .filter(
                (
                    job,
                ): job is {
                    node: Text;
                    original: string;
                    normalized: string;
                    key: string;
                } => Boolean(job),
            );

        pendingTextNodes.clear();

        const attributeJobs: Array<{
            element: HTMLElement;
            attribute: TranslatableAttribute;
            original: string;
            normalized: string;
            key: string;
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
                    key: translationKey(original),
                });
            });
        });

        pendingAttributes.clear();

        if (textJobs.length === 0 && attributeJobs.length === 0) {
            return;
        }

        const uniqueValues = Array.from(
            new Map(
                [...textJobs, ...attributeJobs].map((job) => [
                    job.key,
                    job.normalized,
                ]),
            ).entries(),
        );
        const translations = new Map<string, string>();

        for (const [key, value] of uniqueValues) {
            translations.set(key, await translatePtToEn(value));

            if (disposed) {
                return;
            }
        }

        applying = true;

        try {
            textJobs.forEach((job) => {
                const translated = translations.get(job.key) ?? job.normalized;

                if (!job.node.isConnected || translated === job.normalized) {
                    return;
                }

                job.node.textContent = withOriginalPadding(
                    job.original,
                    translated,
                );
            });

            attributeJobs.forEach((job) => {
                const translated = translations.get(job.key) ?? job.normalized;

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
            if (
                mutation.type === 'characterData' &&
                mutation.target instanceof Text
            ) {
                queueTextNode(mutation.target, true);
                return;
            }

            if (
                mutation.type === 'attributes' &&
                mutation.target instanceof HTMLElement &&
                mutation.attributeName &&
                (TRANSLATABLE_ATTRIBUTES as readonly string[]).includes(
                    mutation.attributeName,
                )
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
