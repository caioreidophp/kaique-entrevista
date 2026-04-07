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
    timeoutMs?: number;
    retries?: number;
}

interface CachedGetEntry {
    expiresAt: number;
    value: unknown;
}

interface ApiClientErrorEventDetail {
    path: string;
    method: RequestConfig['method'];
    status: number;
    message: string;
}

const getCache = new Map<string, CachedGetEntry>();
const inFlightGetRequests = new Map<string, Promise<unknown>>();
const GET_CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 20_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const DEFAULT_RETRIES = 2;

const cacheableGetPaths = [
    '/reference/cities',
    '/registry/unidades',
    '/registry/funcoes',
    '/registry/tipos-pagamento',
    '/settings/two-factor',
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

function dispatchApiClientError(detail: ApiClientErrorEventDetail): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(
        new CustomEvent<ApiClientErrorEventDetail>('transport:api-error', {
            detail,
        }),
    );
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

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

function shouldRetry(status: number): boolean {
    return status === 0 || status === 408 || status === 429 || status >= 500;
}

function isIdempotent(method: RequestConfig['method']): boolean {
    return method === 'GET' || method === 'PUT' || method === 'DELETE';
}

async function request<T>(
    path: string,
    config: RequestConfig = {},
): Promise<T> {
    const {
        method = 'GET',
        body,
        auth = true,
        timeoutMs = REQUEST_TIMEOUT_MS,
        retries = DEFAULT_RETRIES,
    } = config;

    if (method === 'GET' && shouldCacheGet(path)) {
        const cached = getCachedGet<T>(path);

        if (cached !== null) {
            return cached;
        }
    }

    if (method === 'GET') {
        const pending = inFlightGetRequests.get(path);

        if (pending) {
            return pending as Promise<T>;
        }
    }

    const operation = (async (): Promise<T> => {
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

        let response: Response | null = null;
        let lastError: ApiError | null = null;
        const maxAttempts = isIdempotent(method) ? retries + 1 : 1;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            const abortController = new AbortController();
            const timeoutId = window.setTimeout(
                () => abortController.abort(),
                timeoutMs,
            );

            try {
                response = await fetch(`${API_BASE}${path}`, {
                    method,
                    headers,
                    signal: abortController.signal,
                    body:
                        body === undefined
                            ? undefined
                            : hasFormDataBody
                              ? body
                              : JSON.stringify(body),
                });

                if (!shouldRetry(response.status) || attempt === maxAttempts) {
                    break;
                }

                const backoffMs = Math.min(2_000, 250 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 120);
                await delay(backoffMs);
            } catch (error) {
                let fallback = new ApiError(
                    500,
                    'Falha inesperada na comunicação com o servidor.',
                );

                if (error instanceof DOMException && error.name === 'AbortError') {
                    fallback = new ApiError(
                        408,
                        'A requisição demorou mais do que o esperado. Tente novamente.',
                    );
                } else if (error instanceof TypeError) {
                    fallback = new ApiError(
                        0,
                        'Falha de conexão. Verifique sua internet e tente novamente.',
                    );
                }

                lastError = fallback;

                if (attempt === maxAttempts || !isIdempotent(method)) {
                    dispatchApiClientError({
                        path,
                        method,
                        status: fallback.status,
                        message: fallback.message,
                    });

                    throw fallback;
                }

                const backoffMs = Math.min(2_000, 250 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 120);
                await delay(backoffMs);
            } finally {
                window.clearTimeout(timeoutId);
            }
        }

        if (!response) {
            throw (lastError ?? new ApiError(500, 'Falha inesperada na comunicação com o servidor.'));
        }

        if (response.status === 401) {
            clearAuthToken();
            clearStoredUser();
            redirectToLogin();
            throw new ApiError(401, 'Não autorizado. Faça login novamente.');
        }

        if (response.status === 204) {
            return undefined as T;
        }

        let json: ({
            message?: string;
            errors?: ApiValidationErrors;
        } & T) | null = null;

        try {
            json = (await response.json()) as {
                message?: string;
                errors?: ApiValidationErrors;
            } & T;
        } catch {
            json = null;
        }

        if (!response.ok) {
            const normalizedMessage = normalizeApiErrorMessage(json?.message);
            const apiError = new ApiError(
                response.status,
                contextualizeErrorMessage(path, method, normalizedMessage),
                json?.errors,
            );

            dispatchApiClientError({
                path,
                method,
                status: apiError.status,
                message: apiError.message,
            });

            throw apiError;
        }

        const payload = (json ?? ({} as T)) as T;

        if (method !== 'GET') {
            invalidateGetCache();
        } else if (shouldCacheGet(path)) {
            setCachedGet(path, payload);
        }

        return payload;
    })();

    if (method === 'GET') {
        inFlightGetRequests.set(path, operation as Promise<unknown>);

        try {
            return await operation;
        } finally {
            inFlightGetRequests.delete(path);
        }
    }

    return operation;
}

export function apiGet<T>(path: string, auth = true): Promise<T> {
    return request<T>(path, { method: 'GET', auth });
}

export function apiGetWithConfig<T>(path: string, config: Omit<RequestConfig, 'method' | 'body'> = {}): Promise<T> {
    return request<T>(path, { ...config, method: 'GET' });
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

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), DOWNLOAD_TIMEOUT_MS);

    let response: Response;

    try {
        response = await fetch(`${API_BASE}${path}`, {
            method: 'GET',
            headers: {
                Accept: 'application/octet-stream',
                Authorization: `Bearer ${token}`,
            },
            signal: abortController.signal,
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw new ApiError(408, 'Download demorou além do esperado. Tente novamente.');
        }

        throw new ApiError(0, 'Falha de conexão durante download.');
    } finally {
        window.clearTimeout(timeoutId);
    }

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
