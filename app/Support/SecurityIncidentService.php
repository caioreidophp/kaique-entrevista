<?php

namespace App\Support;

use App\Models\SecurityIncident;
use Illuminate\Support\Facades\Cache;

class SecurityIncidentService
{
    public static function report(
        string $code,
        string $message,
        array $context = [],
        string $severity = 'warning',
        string $source = 'application',
        int $dedupeMinutes = 5,
    ): ?SecurityIncident {
        if (! (bool) config('transport_features.security_incidents', true)) {
            return null;
        }

        $fingerprint = sha1((string) json_encode([
            'code' => $code,
            'source' => $source,
            'severity' => $severity,
            'ip' => (string) ($context['ip'] ?? ''),
            'path' => (string) ($context['path'] ?? ''),
            'status' => (string) ($context['status'] ?? ''),
        ]));

        $dedupeKey = 'security:incident:dedupe:'.$fingerprint;

        if (! Cache::add($dedupeKey, 1, now()->addMinutes(max(1, $dedupeMinutes)))) {
            return null;
        }

        return SecurityIncident::query()->create([
            'severity' => $severity,
            'source' => $source,
            'code' => $code,
            'message' => $message,
            'context' => $context,
            'occurred_at' => now(),
        ]);
    }
}
