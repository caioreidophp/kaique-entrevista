const TOKEN_KEY = 'transport_api_token';

export function getAuthToken(): string | null {
    return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
    window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
    window.localStorage.removeItem(TOKEN_KEY);
}

export function redirectToLogin(): void {
    window.location.href = '/transport/login';
}
