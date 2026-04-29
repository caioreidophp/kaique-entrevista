<?php

namespace App\Http\Middleware;

use App\Support\TransportPanelGuard;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class EnsureTransportPanelAuthenticated
{
    public function handle(Request $request, Closure $next): Response
    {
        $guardCookie = (string) $request->cookie(TransportPanelGuard::COOKIE_NAME, '');
        $parsed = TransportPanelGuard::parseCookieValue($guardCookie);

        if (! is_array($parsed)) {
            return redirect()->route('transport.login');
        }

        $tokenIsValid = PersonalAccessToken::query()
            ->whereKey($parsed['token_id'])
            ->where('tokenable_type', 'App\\Models\\User')
            ->where('tokenable_id', $parsed['user_id'])
            ->where(function ($query): void {
                $query->whereNull('expires_at')
                    ->orWhere('expires_at', '>=', now());
            })
            ->exists();

        if (! $tokenIsValid) {
            return redirect()->route('transport.login')
                ->withCookie(cookie()->forget(TransportPanelGuard::COOKIE_NAME));
        }

        return $next($request);
    }
}

