import { getTransportIntlLocale } from '@/lib/transport-language';

function normalizeNumberInput(value: string | number | null | undefined): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined) return 0;

    const raw = String(value)
        .trim()
        .replace(/\s/g, '')
        .replace(/[^0-9,.-]/g, '');

    if (!raw) return 0;

    const sanitized = raw.replace(/(?!^)-/g, '');
    const hasComma = sanitized.includes(',');
    const hasDot = sanitized.includes('.');

    const normalized = (() => {
        if (hasComma && hasDot) {
            const lastComma = sanitized.lastIndexOf(',');
            const lastDot = sanitized.lastIndexOf('.');

            if (lastComma > lastDot) {
                return sanitized.replace(/\./g, '').replace(',', '.');
            }

            return sanitized.replace(/,/g, '');
        }

        if (hasComma) {
            if (/^-?\d{1,3}(,\d{3})+$/.test(sanitized)) {
                return sanitized.replace(/,/g, '');
            }

            return sanitized.replace(/,/g, '.');
        }

        if (hasDot) {
            if (
                /^-?\d{1,3}(\.\d{3})+$/.test(sanitized)
                || /^-?\d+\.\d{3}$/.test(sanitized)
            ) {
                return sanitized.replace(/\./g, '');
            }
        }

        return sanitized;
    })();

    const direct = Number(normalized);
    if (Number.isFinite(direct)) return direct;

    const ptBr = Number(sanitized.replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(ptBr)) return ptBr;

    const usStyle = Number(sanitized.replace(/,/g, ''));
    if (Number.isFinite(usStyle)) return usStyle;

    const digitsOnly = sanitized.replace(/\D/g, '');
    if (digitsOnly) {
        const integerFallback = Number(digitsOnly);

        if (Number.isFinite(integerFallback)) {
            return integerFallback;
        }
    }

    return 0;
}

export function toNumberSafe(value: string | number | null | undefined): number {
    return normalizeNumberInput(value);
}

export function formatCurrencyBR(value: string | number | null | undefined): string {
    return new Intl.NumberFormat(getTransportIntlLocale(), {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(normalizeNumberInput(value));
}

export function formatIntegerBR(value: string | number | null | undefined): string {
    return new Intl.NumberFormat(getTransportIntlLocale(), {
        maximumFractionDigits: 0,
    }).format(Math.round(normalizeNumberInput(value)));
}

export function formatPercentBR(value: string | number | null | undefined, digits = 2): string {
    return `${new Intl.NumberFormat(getTransportIntlLocale(), {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
    }).format(normalizeNumberInput(value))}%`;
}

export function formatDecimalBR(value: string | number | null | undefined, digits = 2): string {
    const safeDigits = Math.max(0, Math.min(6, digits));

    return new Intl.NumberFormat(getTransportIntlLocale(), {
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

    const locale = getTransportIntlLocale();

    const datePart = /^\d{4}-\d{2}-\d{2}/.exec(value)?.[0];

    if (datePart) {
        const parsedDate = new Date(`${datePart}T00:00:00`);

        if (!Number.isNaN(parsedDate.getTime())) {
            return parsedDate.toLocaleDateString(locale);
        }
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString(locale);
    }

    return value;
}

export function formatDateTimeBR(value: string | null | undefined, empty = '-'): string {
    if (!value) return empty;

    const locale = getTransportIntlLocale();

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString(locale);
    }

    return value;
}
