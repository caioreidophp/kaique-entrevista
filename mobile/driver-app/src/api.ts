const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000/api').replace(/\/$/, '');

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string | null;
};

export async function apiLogin(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const response = await fetch(`${apiBaseUrl}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.token) {
    throw new Error(data?.message ?? 'Falha no login. Verifique email/senha e URL da API.');
  }

  return data;
}

export async function apiMe(token: string): Promise<AuthUser> {
  const response = await fetch(`${apiBaseUrl}/me`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.user) {
    throw new Error(data?.message ?? 'Sessão inválida. Faça login novamente.');
  }

  return data.user;
}

export { apiBaseUrl };
