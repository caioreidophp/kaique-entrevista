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

function isFormDataBody(value: unknown): value is FormData {
    return typeof FormData !== 'undefined' && value instanceof FormData;
}

async function request<T>(
    path: string,
    config: RequestConfig = {},
): Promise<T> {
    const { method = 'GET', body, auth = true } = config;
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
        throw new ApiError(
            response.status,
            normalizeApiErrorMessage(json.message),
            json.errors,
        );
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
