import { useCallback, useEffect, useState } from 'react';

export function usePersistedState<T>(key: string, initialValue: T) {
    const [value, setValue] = useState<T>(() => {
        if (typeof window === 'undefined') {
            return initialValue;
        }

        const raw = window.localStorage.getItem(key);

        if (!raw) {
            return initialValue;
        }

        try {
            return JSON.parse(raw) as T;
        } catch {
            window.localStorage.removeItem(key);
            return initialValue;
        }
    });

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        window.localStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);

    const reset = useCallback(() => {
        setValue(initialValue);
    }, [initialValue]);

    return [value, setValue, reset] as const;
}
