<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();

        if ((bool) env('APP_FORCE_HTTPS', false)) {
            URL::forceScheme('https');
        }
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        $this->configureRateLimiting();

        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null
        );
    }

    protected function configureRateLimiting(): void
    {
        RateLimiter::for('transport-login', function (Request $request): Limit {
            $email = (string) $request->input('email', 'anon');
            $key = mb_strtolower($email).'|'.$request->ip();

            return Limit::perMinute(8)
                ->by($key)
                ->response(fn () => response()->json([
                    'message' => 'Muitas tentativas de login. Aguarde 1 minuto e tente novamente.',
                ], 429));
        });

        RateLimiter::for('transport-uploads', function (Request $request): Limit {
            $limit = $this->adaptivePerMinuteLimit($request, [
                'guest' => 8,
                'usuario' => 12,
                'admin' => 20,
                'master_admin' => 30,
            ]);

            return $this->adaptiveLimitResponse($request, $limit, 'Muitas operações de upload em sequência. Aguarde e tente novamente.');
        });

        RateLimiter::for('transport-import', function (Request $request): Limit {
            $limit = $this->adaptivePerMinuteLimit($request, [
                'guest' => 2,
                'usuario' => 3,
                'admin' => 6,
                'master_admin' => 10,
            ]);

            return $this->adaptiveLimitResponse($request, $limit, 'Limite de importações atingido temporariamente. Aguarde e tente novamente.');
        });

        RateLimiter::for('transport-heavy', function (Request $request): Limit {
            $limit = $this->adaptivePerMinuteLimit($request, [
                'guest' => 20,
                'usuario' => 35,
                'admin' => 60,
                'master_admin' => 90,
            ]);

            return $this->adaptiveLimitResponse($request, $limit, 'Muitas requisições para endpoints críticos. Aguarde e tente novamente.');
        });

        RateLimiter::for('transport-backup', function (Request $request): Limit {
            $base = $request->user()?->isMasterAdmin() ? 4 : 2;

            return Limit::perHour(max(1, $base))
                ->by($this->rateLimitBucket($request))
                ->response(fn () => response()->json([
                    'message' => 'Muitas solicitações de backup. Aguarde e tente novamente.',
                ], 429));
        });
    }

    /**
     * @param array<string, int> $baseByRole
     */
    private function adaptivePerMinuteLimit(Request $request, array $baseByRole): int
    {
        $role = (string) ($request->user()?->role ?? 'guest');
        $base = (int) ($baseByRole[$role] ?? ($baseByRole['guest'] ?? 20));
        $risk = $this->requestRiskMultiplier($request);

        return max(4, (int) floor($base * $risk));
    }

    private function requestRiskMultiplier(Request $request): float
    {
        $path = trim((string) $request->path(), '/');
        $multiplier = 1.0;

        if (
            str_starts_with($path, 'api/registry/users')
            || str_starts_with($path, 'api/registry/role-permissions')
            || str_starts_with($path, 'api/users')
            || str_starts_with($path, 'api/settings/backup')
            || str_starts_with($path, 'api/payroll/launch-batch')
            || str_starts_with($path, 'api/freight/entries/import')
            || str_starts_with($path, 'api/system/')
            || str_starts_with($path, 'api/exports/async')
        ) {
            $multiplier *= 0.55;
        } elseif (str_contains($path, '/import') || str_contains($path, '/upload')) {
            $multiplier *= 0.75;
        }

        $attemptCounterKey = 'security:api:attempts:'.sha1((string) ($request->ip() ?? 'unknown'));
        $attempts = (int) Cache::get($attemptCounterKey, 0);

        if ($attempts >= 20) {
            $multiplier *= 0.5;
        } elseif ($attempts >= 10) {
            $multiplier *= 0.7;
        }

        return max(0.25, $multiplier);
    }

    private function adaptiveLimitResponse(Request $request, int $limit, string $message): Limit
    {
        return Limit::perMinute($limit)
            ->by($this->rateLimitBucket($request))
            ->response(fn () => response()->json([
                'message' => $message,
            ], 429));
    }

    private function rateLimitBucket(Request $request): string
    {
        return (string) ($request->user()?->id ? 'user:'.$request->user()->id : 'ip:'.$request->ip());
    }
}
