import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
    const [debounced, setDebounced] = useState<T>(value);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebounced(value);
        }, delayMs);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [delayMs, value]);

    return debounced;
}
