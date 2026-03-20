import { apiGet } from '@/lib/api-client';

const USER_KEY = 'transport_auth_user';

export interface TransportAuthUser {
    id: number;
    name: string;
    email: string;
    role: 'master_admin' | 'admin' | 'usuario';
    permissions: Record<string, boolean>;
}

let inMemoryUser: TransportAuthUser | null = null;
let pendingMeRequest: Promise<TransportAuthUser> | null = null;

export function getStoredUser(): TransportAuthUser | null {
    if (typeof window === 'undefined') {
        return inMemoryUser;
    }

    if (inMemoryUser) {
        return inMemoryUser;
    }

    const raw = window.localStorage.getItem(USER_KEY);

    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as TransportAuthUser;
        inMemoryUser = parsed;

        return parsed;
    } catch {
        window.localStorage.removeItem(USER_KEY);

        return null;
    }
}

export function storeUser(user: TransportAuthUser): void {
    inMemoryUser = user;

    if (typeof window !== 'undefined') {
        window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
}

export function clearStoredUser(): void {
    inMemoryUser = null;

    if (typeof window !== 'undefined') {
        window.localStorage.removeItem(USER_KEY);
    }
}

export async function fetchCurrentUser(
    force = false,
): Promise<TransportAuthUser> {
    const stored = getStoredUser();

    if (!force && stored) {
        return stored;
    }

    if (pendingMeRequest) {
        return pendingMeRequest;
    }

    pendingMeRequest = apiGet<{ user: TransportAuthUser }>('/me')
        .then((response) => {
            storeUser(response.user);

            return response.user;
        })
        .finally(() => {
            pendingMeRequest = null;
        });

    return pendingMeRequest;
}
