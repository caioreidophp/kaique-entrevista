import {
    clearAuthToken,
    getAuthToken,
    redirectToLogin,
} from '@/lib/transport-auth';
import { clearStoredUser } from '@/lib/transport-session';
import type { ApiValidationErrors } from '@/types/driver-interview';

const API_BASE = '/api';

export class ApiError extends Error {
    status: number;
    errors?: ApiValidationErrors;

    constructor(status: number, message: string, errors?: ApiValidationErrors) {
        super(message);
        this.status = status;
        this.errors = errors;
    }
}

interface RequestConfig {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    auth?: boolean;
}

interface CachedGetEntry {
    expiresAt: number;
    value: unknown;
}

const getCache = new Map<string, CachedGetEntry>();
const GET_CACHE_TTL_MS = 60_000;

const cacheableGetPaths = [
    '/reference/cities',
    '/registry/unidades',
    '/registry/funcoes',
    '/registry/tipos-pagamento',
    '/settings/two-factor',
];

const criticalActionFragments = [
    '/import',
    '/bulk',
    '/bill',
    '/unbill',
    '/backup',
    '/settings/password',
    '/registry/users',
];

function shouldCacheGet(path: string): boolean {
    return cacheableGetPaths.some((candidate) => path.startsWith(candidate));
}

function buildCacheKey(path: string): string {
    return path;
}

function getCachedGet<T>(path: string): T | null {
    const key = buildCacheKey(path);
    const cached = getCache.get(key);

    if (!cached) return null;

    if (cached.expiresAt < Date.now()) {
        getCache.delete(key);
        return null;
    }

    return cached.value as T;
}

function setCachedGet(path: string, value: unknown): void {
    const key = buildCacheKey(path);
    getCache.set(key, {
        value,
        expiresAt: Date.now() + GET_CACHE_TTL_MS,
    });
}

function invalidateGetCache(): void {
    getCache.clear();
}

function isCriticalAction(method: RequestConfig['method'], path: string): boolean {
    if (!method || method === 'GET') return false;

    return criticalActionFragments.some((fragment) => path.includes(fragment));
}

function hasRecentCriticalConfirmation(): boolean {
    if (typeof window === 'undefined') return true;

    const raw = window.sessionStorage.getItem('transport.critical-confirmed-at');
    const value = raw ? Number(raw) : 0;

    if (!Number.isFinite(value) || value <= 0) {
        return false;
    }

    return Date.now() - value < 5 * 60_000;
}

function markCriticalConfirmation(): void {
    if (typeof window === 'undefined') return;

    window.sessionStorage.setItem(
        'transport.critical-confirmed-at',
        String(Date.now()),
    );
}

function ensureCriticalActionConfirmation(method: RequestConfig['method'], path: string): boolean {
    if (!isCriticalAction(method, path)) {
        return true;
    }

    if (hasRecentCriticalConfirmation()) {
        return true;
    }

    if (typeof window === 'undefined') {
        return true;
    }

    const confirmed = window.confirm(
        'Ação crítica detectada. Confirma continuar com esta operação?',
    );

    if (confirmed) {
        markCriticalConfirmation();
    }

    return confirmed;
}

function normalizeApiErrorMessage(message?: string): string {
    const normalized = (message ?? '').trim();

    if (!normalized) {
        return 'Erro ao processar requisição.';
    }

    const lower = normalized.toLowerCase();

    if (lower === 'unauthenticated.') {
        return 'Sessão expirada. Faça login novamente.';
    }

    if (lower === 'this action is unauthorized.') {
        return 'Você não tem permissão para executar esta ação.';
    }

    if (lower === 'the given data was invalid.') {
        return 'Os dados informados são inválidos.';
    }

    if (lower === 'forbidden') {
        return 'Acesso negado.';
    }

    if (lower === 'not found' || lower === 'not found.') {
        return 'Recurso não encontrado.';
    }

    return normalized;
}

function contextualizeErrorMessage(path: string, method: string, message: string): string {
    const lowerPath = path.toLowerCase();

    if (lowerPath.includes('/import') && method !== 'GET') {
        return `${message}\nRevise as linhas sinalizadas e tente importar novamente.`;
    }

    if (method === 'DELETE') {
        return `${message}\nConfirme se não existem vínculos ativos antes de excluir.`;
    }

    if (lowerPath.includes('/launch-batch')) {
        return `${message}\nVerifique duplicidades e filtros antes de relançar o lote.`;
    }

    return message;
}

function isFormDataBody(value: unknown): value is FormData {
    return typeof FormData !== 'undefined' && value instanceof FormData;
}

async function request<T>(
    path: string,
    config: RequestConfig = {},
): Promise<T> {
    const { method = 'GET', body, auth = true } = config;

    if (!ensureCriticalActionConfirmation(method, path)) {
        throw new ApiError(400, 'Ação crítica cancelada pelo usuário.');
    }

    if (method === 'GET' && shouldCacheGet(path)) {
        const cached = getCachedGet<T>(path);

        if (cached !== null) {
            return cached;
        }
    }

    const hasFormDataBody = isFormDataBody(body);

    const headers: HeadersInit = {
        Accept: 'application/json',
    };

    if (body !== undefined && !hasFormDataBody) {
        headers['Content-Type'] = 'application/json';
    }

    if (auth) {
        const token = getAuthToken();

        if (!token) {
            clearStoredUser();
            redirectToLogin();
            throw new ApiError(401, 'Sessão expirada. Faça login novamente.');
        }

        headers.Authorization = `Bearer ${token}`;
    }

    if (isCriticalAction(method, path)) {
        headers['X-Confirm-Action'] = 'yes';
    }

    const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body:
            body === undefined
                ? undefined
                : hasFormDataBody
                  ? body
                  : JSON.stringify(body),
    });

    if (response.status === 401) {
        clearAuthToken();
        clearStoredUser();
        redirectToLogin();
        throw new ApiError(401, 'Não autorizado. Faça login novamente.');
    }

    if (response.status === 204) {
        return undefined as T;
    }

    const json = (await response.json()) as {
        message?: string;
        errors?: ApiValidationErrors;
    } & T;

    if (!response.ok) {
        const normalizedMessage = normalizeApiErrorMessage(json.message);

        throw new ApiError(
            response.status,
            contextualizeErrorMessage(path, method, normalizedMessage),
            json.errors,
        );
    }

    if (method !== 'GET') {
        invalidateGetCache();
    } else if (shouldCacheGet(path)) {
        setCachedGet(path, json);
    }

    return json as T;
}

export function apiGet<T>(path: string, auth = true): Promise<T> {
    return request<T>(path, { method: 'GET', auth });
}

export function apiPost<T>(
    path: string,
    body?: unknown,
    auth = true,
): Promise<T> {
    return request<T>(path, { method: 'POST', body, auth });
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'PUT', body, auth: true });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'PATCH', body, auth: true });
}

export function apiDelete(path: string): Promise<void> {
    return request<void>(path, { method: 'DELETE', auth: true });
}

export async function apiDownload(path: string, fallbackFileName: string): Promise<void> {
    const token = getAuthToken();

    if (!token) {
        clearStoredUser();
        redirectToLogin();
        throw new ApiError(401, 'Sessão expirada. Faça login novamente.');
    }

    const response = await fetch(`${API_BASE}${path}`, {
        method: 'GET',
        headers: {
            Accept: 'application/octet-stream',
            Authorization: `Bearer ${token}`,
        },
    });

    if (response.status === 401) {
        clearAuthToken();
        clearStoredUser();
        redirectToLogin();
        throw new ApiError(401, 'Não autorizado. Faça login novamente.');
    }

    if (!response.ok) {
        let message = 'Erro ao baixar arquivo.';

        try {
            const json = (await response.json()) as {
                message?: string;
                errors?: ApiValidationErrors;
            };

            message = normalizeApiErrorMessage(json.message);
        } catch {
            // ignore parse error and keep fallback
        }

        throw new ApiError(response.status, message);
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get('content-disposition') ?? '';
    const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
    const fileName = match?.[1] ?? fallbackFileName;

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
}
