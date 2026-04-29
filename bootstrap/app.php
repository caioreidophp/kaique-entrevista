<?php

use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\ApiRequestTelemetry;
use App\Http\Middleware\LogSensitiveApiActions;
use App\Http\Middleware\MonitorSuspiciousApiActivity;
use App\Http\Middleware\ResponseCompression;
use App\Http\Middleware\SetRequestContext;
use App\Http\Middleware\SetSecurityHeaders;
use App\Http\Middleware\TrackTokenActivity;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Support\Facades\Cache;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(SetRequestContext::class);

        if ((bool) env('TRANSPORT_FEATURE_RESPONSE_COMPRESSION', true)) {
            $middleware->append(ResponseCompression::class);
        }

        if ((bool) env('TRANSPORT_FEATURE_SECURITY_HEADERS', true)) {
            $middleware->append(SetSecurityHeaders::class);
        }

        if ((bool) env('TRANSPORT_FEATURE_SENSITIVE_AUDIT', true)) {
            $middleware->api(append: [
                LogSensitiveApiActions::class,
            ]);
        }

        if ((bool) env('TRANSPORT_FEATURE_API_GUARD', true)) {
            $middleware->api(append: [
                MonitorSuspiciousApiActivity::class,
            ]);
        }

        if ((bool) env('TRANSPORT_FEATURE_SESSION_MANAGEMENT', true)) {
            $middleware->api(append: [
                TrackTokenActivity::class,
            ]);
        }

        if ((bool) env('TRANSPORT_FEATURE_API_TELEMETRY', true)) {
            $middleware->api(append: [
                ApiRequestTelemetry::class,
            ]);
        }

        $middleware->encryptCookies(except: ['appearance', 'sidebar_state', 'transport_panel_guard']);
        $middleware->trustProxies(at: '*');

        $appEnv = (string) ($_ENV['APP_ENV'] ?? $_SERVER['APP_ENV'] ?? getenv('APP_ENV') ?: '');

        if ($appEnv === 'testing') {
            $middleware->validateCsrfTokens(except: ['*']);
        }

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->report(function (\Throwable $exception): void {
            $rows = Cache::get('telemetry:exceptions:recent', []);

            if (! is_array($rows)) {
                $rows = [];
            }

            $rows[] = [
                'timestamp' => now()->toIso8601String(),
                'type' => $exception::class,
                'message' => mb_substr($exception->getMessage(), 0, 1000),
            ];

            if (count($rows) > 100) {
                $rows = array_slice($rows, -100);
            }

            Cache::put('telemetry:exceptions:recent', $rows, now()->addHours(6));
        });
    })->create();
