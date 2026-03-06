import { apiGet } from '@/lib/api-client';

interface CityOption {
    value: string;
    label: string;
}

interface WrappedResponse<T> {
    data: T;
}

interface CityCachePayload {
    updatedAt: number;
    data: CityOption[];
}

const CITY_CACHE_STORAGE_KEY = 'transport:reference-cities:v1';
const CITY_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

let memoryCache: CityOption[] | null = null;

function readStorageCache(): CityOption[] | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const raw = window.localStorage.getItem(CITY_CACHE_STORAGE_KEY);

    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as Partial<CityCachePayload>;

        if (
            typeof parsed.updatedAt !== 'number' ||
            !Array.isArray(parsed.data) ||
            Date.now() - parsed.updatedAt > CITY_CACHE_TTL_MS
        ) {
            window.localStorage.removeItem(CITY_CACHE_STORAGE_KEY);
            return null;
        }

        return parsed.data;
    } catch {
        window.localStorage.removeItem(CITY_CACHE_STORAGE_KEY);
        return null;
    }
}

function writeStorageCache(data: CityOption[]): void {
    if (typeof window === 'undefined') {
        return;
    }

    const payload: CityCachePayload = {
        updatedAt: Date.now(),
        data,
    };

    window.localStorage.setItem(CITY_CACHE_STORAGE_KEY, JSON.stringify(payload));
}

export async function loadReferenceCitiesCached(): Promise<CityOption[]> {
    if (memoryCache) {
        return memoryCache;
    }

    const storageCache = readStorageCache();

    if (storageCache) {
        memoryCache = storageCache;
        return storageCache;
    }

    const response = await apiGet<WrappedResponse<CityOption[]>>('/reference/cities');
    memoryCache = response.data;
    writeStorageCache(response.data);

    return response.data;
}
