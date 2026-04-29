<?php

namespace App\Support;

final class TransportPanelGuard
{
    public const COOKIE_NAME = 'transport_panel_guard';

    public static function makeCookieValue(int $userId, int $tokenId, int $ttlMinutes = 10080): string
    {
        $expiresAt = now()->addMinutes(max(5, $ttlMinutes))->timestamp;
        $payload = implode('|', [$userId, $tokenId, $expiresAt]);
        $encodedPayload = self::base64UrlEncode($payload);
        $signature = self::sign($encodedPayload);

        return $encodedPayload.'.'.$signature;
    }

    /**
     * @return array{user_id:int,token_id:int,expires_at:int}|null
     */
    public static function parseCookieValue(?string $value): ?array
    {
        if (! is_string($value) || trim($value) === '' || ! str_contains($value, '.')) {
            return null;
        }

        [$encodedPayload, $signature] = explode('.', $value, 2);

        if (
            $encodedPayload === ''
            || $signature === ''
            || ! hash_equals(self::sign($encodedPayload), $signature)
        ) {
            return null;
        }

        $decoded = self::base64UrlDecode($encodedPayload);

        if (! is_string($decoded) || ! str_contains($decoded, '|')) {
            return null;
        }

        [$userIdRaw, $tokenIdRaw, $expiresAtRaw] = explode('|', $decoded, 3);

        $userId = (int) $userIdRaw;
        $tokenId = (int) $tokenIdRaw;
        $expiresAt = (int) $expiresAtRaw;

        if ($userId <= 0 || $tokenId <= 0 || $expiresAt <= 0) {
            return null;
        }

        if ($expiresAt < now()->timestamp) {
            return null;
        }

        return [
            'user_id' => $userId,
            'token_id' => $tokenId,
            'expires_at' => $expiresAt,
        ];
    }

    private static function sign(string $encodedPayload): string
    {
        $key = (string) config('app.key');

        return hash_hmac('sha256', $encodedPayload, $key);
    }

    private static function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $value): ?string
    {
        $padding = strlen($value) % 4;
        if ($padding > 0) {
            $value .= str_repeat('=', 4 - $padding);
        }

        $decoded = base64_decode(strtr($value, '-_', '+/'), true);

        return is_string($decoded) ? $decoded : null;
    }
}
