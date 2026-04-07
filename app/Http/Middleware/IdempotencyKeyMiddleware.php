<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class IdempotencyKeyMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return $next($request);
        }

        $headerValue = trim((string) $request->header('Idempotency-Key', ''));
        if ($headerValue === '') {
            return $next($request);
        }

        $payloadKey = $this->payloadKey($request, $headerValue);
        $cachedPayload = Cache::get($payloadKey);

        if (is_array($cachedPayload)) {
            $response = new JsonResponse(
                $cachedPayload['body'] ?? null,
                (int) ($cachedPayload['status'] ?? 200),
            );
            $response->headers->set('Idempotency-Replayed', 'true');

            return $response;
        }

        $lockKey = $payloadKey.':lock';

        if (! Cache::add($lockKey, 1, now()->addSeconds(30))) {
            return response()->json([
                'message' => 'Uma requisição com esta chave de idempotência já está em processamento.',
            ], 409, [
                'Idempotency-Replayed' => 'true',
            ]);
        }

        /** @var Response $response */
        $response = $next($request);

        try {
            if (
                ! $response instanceof StreamedResponse
                && $response->getStatusCode() >= 200
                && $response->getStatusCode() < 500
                && str_contains(strtolower((string) $response->headers->get('Content-Type', 'application/json')), 'json')
            ) {
                $content = (string) $response->getContent();
                $decoded = json_decode($content, true);

                if (json_last_error() === JSON_ERROR_NONE) {
                    Cache::put($payloadKey, [
                        'status' => $response->getStatusCode(),
                        'body' => $decoded,
                    ], now()->addMinutes(30));
                }
            }
        } finally {
            Cache::forget($lockKey);
        }

        $response->headers->set('Idempotency-Replayed', 'false');

        return $response;
    }

    private function payloadKey(Request $request, string $headerValue): string
    {
        $scope = $request->user()?->id
            ? 'user:'.(int) $request->user()->id
            : 'ip:'.sha1((string) ($request->ip() ?? 'unknown'));

        $routeSignature = (string) ($request->route()?->uri() ?? $request->path());
        $method = strtoupper((string) $request->method());
        $fingerprint = sha1($method.'|'.$routeSignature.'|'.$scope.'|'.$headerValue);

        return 'idempotency:api:'.$fingerprint;
    }
}