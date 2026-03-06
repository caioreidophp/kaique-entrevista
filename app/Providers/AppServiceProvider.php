<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Http\Request;
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

        RateLimiter::for('transport-uploads', fn (Request $request): Limit => Limit::perMinute(20)
            ->by((string) ($request->user()?->id ?? $request->ip())));

        RateLimiter::for('transport-import', fn (Request $request): Limit => Limit::perMinute(6)
            ->by((string) ($request->user()?->id ?? $request->ip())));
    }
}
