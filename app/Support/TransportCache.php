<?php

namespace App\Support;

use Closure;
use Illuminate\Support\Facades\Cache;

class TransportCache
{
    public static function version(string $domain): int
    {
        return (int) Cache::get(self::versionKey($domain), 1);
    }

    public static function bump(string $domain): int
    {
        $key = self::versionKey($domain);

        if (! Cache::has($key)) {
            Cache::put($key, 1, now()->addDays(30));
        }

        return (int) Cache::increment($key);
    }

    /**
     * @param  array<int, string>  $domains
     */
    public static function bumpMany(array $domains): void
    {
        foreach (array_values(array_unique($domains)) as $domain) {
            if ($domain === '') {
                continue;
            }

            self::bump($domain);
        }
    }

    /**
     * @param  array<string, scalar|array|null>  $fingerprint
     */
    public static function key(string $domain, array $fingerprint): string
    {
        return sprintf(
            'transport:%s:v%d:%s',
            $domain,
            self::version($domain),
            sha1((string) json_encode($fingerprint)),
        );
    }

    /**
     * @param  array<string, scalar|array|null>  $fingerprint
     */
    public static function remember(
        string $domain,
        array $fingerprint,
        \DateTimeInterface|\DateInterval|int $ttl,
        Closure $callback,
    ): mixed {
        return Cache::remember(self::key($domain, $fingerprint), $ttl, $callback);
    }

    private static function versionKey(string $domain): string
    {
        return 'transport:cache-version:'.$domain;
    }
}
