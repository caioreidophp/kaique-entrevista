<?php

namespace App\Http\Middleware;

use App\Models\ServiceAccount;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateServiceAccount
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! (bool) config('transport_features.service_accounts', true)) {
            return response()->json([
                'message' => 'Integrações por service account estão desabilitadas.',
            ], 404);
        }

        $rawKey = $this->extractKey($request);

        if ($rawKey === '') {
            return $this->unauthorized('Service account key ausente.');
        }

        [$prefix] = explode('.', $rawKey, 2) + [null, null];
        $prefix = (string) $prefix;

        if ($prefix === '') {
            return $this->unauthorized('Formato de service account key inválido.');
        }

        $hash = hash('sha256', $rawKey);

        $account = ServiceAccount::query()
            ->where('key_prefix', $prefix)
            ->where('key_hash', $hash)
            ->where('is_active', true)
            ->whereNull('revoked_at')
            ->first();

        if (! $account) {
            return $this->unauthorized('Service account key inválida ou revogada.');
        }

        $account->update([
            'last_used_at' => now(),
            'last_used_ip' => (string) ($request->ip() ?? ''),
        ]);

        $request->attributes->set('service_account', $account);

        return $next($request);
    }

    private function extractKey(Request $request): string
    {
        $headerKey = trim((string) $request->header('X-Service-Account-Key', ''));

        if ($headerKey !== '') {
            return $headerKey;
        }

        $authorization = trim((string) $request->header('Authorization', ''));

        if (str_starts_with(strtolower($authorization), 'bearer ')) {
            return trim(substr($authorization, 7));
        }

        return '';
    }

    private function unauthorized(string $message): JsonResponse
    {
        return response()->json([
            'message' => $message,
        ], 401);
    }
}
