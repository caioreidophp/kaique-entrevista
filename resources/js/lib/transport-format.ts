function normalizeNumberInput(value: string | number | null | undefined): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined) return 0;

    const raw = String(value).trim().replace(/\s/g, '');
    if (!raw) return 0;

    const direct = Number(raw);
    if (Number.isFinite(direct)) return direct;

    const ptBr = Number(raw.replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(ptBr)) return ptBr;

    const usStyle = Number(raw.replace(/,/g, ''));
    if (Number.isFinite(usStyle)) return usStyle;

    return 0;
}

export function toNumberSafe(value: string | number | null | undefined): number {
    return normalizeNumberInput(value);
}

export function formatCurrencyBR(value: string | number | null | undefined): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(normalizeNumberInput(value));
}

export function formatIntegerBR(value: string | number | null | undefined): string {
    return new Intl.NumberFormat('pt-BR', {
        maximumFractionDigits: 0,
    }).format(Math.round(normalizeNumberInput(value)));
}

export function formatPercentBR(value: string | number | null | undefined, digits = 2): string {
    return `${new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
    }).format(normalizeNumberInput(value))}%`;
}

export function formatDecimalBR(value: string | number | null | undefined, digits = 2): string {
    const safeDigits = Math.max(0, Math.min(6, digits));

    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: safeDigits,
        maximumFractionDigits: safeDigits,
    }).format(normalizeNumberInput(value));
}

export function moneyMaskBR(value: string): string {
    const clean = value.replace(/[^\d,]/g, '');
    if (!clean) return '';

    const firstCommaIndex = clean.indexOf(',');
    const hasComma = firstCommaIndex >= 0;

    const integerRaw = hasComma ? clean.slice(0, firstCommaIndex) : clean;
    const decimalRaw = hasComma ? clean.slice(firstCommaIndex + 1).replace(/,/g, '') : '';

    const integerDigits = integerRaw.replace(/\D/g, '');
    const integerFormatted = integerDigits ? formatIntegerBR(Number(integerDigits)) : '0';

    return hasComma ? `${integerFormatted},${decimalRaw}` : integerFormatted;
}

export function integerThousandsMaskBR(value: string): string {
    const digits = value.replace(/\D/g, '');

    if (!digits) return '';

    return formatIntegerBR(Number(digits));
}

export function decimalThousandsMaskBR(value: string): string {
    const clean = value.replace(/[^\d,]/g, '');
    if (!clean) return '';

    const firstCommaIndex = clean.indexOf(',');
    const hasComma = firstCommaIndex >= 0;

    const integerRaw = hasComma ? clean.slice(0, firstCommaIndex) : clean;
    const decimalRaw = hasComma ? clean.slice(firstCommaIndex + 1).replace(/,/g, '') : '';

    const integerDigits = integerRaw.replace(/\D/g, '');
    const integerFormatted = integerDigits ? formatIntegerBR(Number(integerDigits)) : '0';

    return hasComma ? `${integerFormatted},${decimalRaw}` : integerFormatted;
}

export function formatDateBR(value: string | null | undefined, empty = '-'): string {
    if (!value) return empty;

    const datePart = /^\d{4}-\d{2}-\d{2}/.exec(value)?.[0];

    if (datePart) {
        const [year, month, day] = datePart.split('-');
        if (year && month && day) {
            return `${day}/${month}/${year}`;
        }
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('pt-BR');
    }

    return value;
}

export function formatDateTimeBR(value: string | null | undefined, empty = '-'): string {
    if (!value) return empty;

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString('pt-BR');
    }

    return value;
}
