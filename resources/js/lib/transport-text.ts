export function normalizeTextPtBr(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR')
        .trim();
}

export function compareTextPtBr(first: string, second: string): number {
    const baseComparison = first.localeCompare(second, 'pt-BR', {
        sensitivity: 'base',
        numeric: true,
    });

    if (baseComparison !== 0) {
        return baseComparison;
    }

    const normalizedFirst = normalizeTextPtBr(first);
    const normalizedSecond = normalizeTextPtBr(second);

    if (normalizedFirst !== normalizedSecond) {
        return normalizedFirst.localeCompare(normalizedSecond, 'pt-BR', {
            numeric: true,
        });
    }

    return first.localeCompare(second, 'pt-BR', {
        sensitivity: 'variant',
        numeric: true,
    });
}

export function includesTextPtBr(value: string, search: string): boolean {
    const normalizedSearch = normalizeTextPtBr(search);

    if (!normalizedSearch) {
        return true;
    }

    return normalizeTextPtBr(value).includes(normalizedSearch);
}

export function startsWithTextPtBr(value: string, search: string): boolean {
    const normalizedSearch = normalizeTextPtBr(search);

    if (!normalizedSearch) {
        return true;
    }

    return normalizeTextPtBr(value).startsWith(normalizedSearch);
}