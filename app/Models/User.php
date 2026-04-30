<?php

namespace App\Models;

use App\Support\RolePermissionCatalog;
use App\Models\UserAccessScope;
// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, TwoFactorAuthenticatable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    public function isMasterAdmin(): bool
    {
        return $this->role === 'master_admin';
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin' || $this->role === null;
    }

    public function isUsuario(): bool
    {
        return $this->role === 'usuario';
    }

    public function hasPermission(string $permissionKey): bool
    {
        if ($this->isMasterAdmin()) {
            return true;
        }

        return RolePermissionCatalog::isAllowed((string) $this->role, $permissionKey);
    }

    public function accessScopes(): HasMany
    {
        return $this->hasMany(UserAccessScope::class);
    }

    /**
     * @return array<string, array{module_key:string,data_scope:string,allowed_unit_ids:array<int, int>,metadata:array<string, mixed>}>
     */
    public function resolvedAccessScopes(): array
    {
        if ($this->isMasterAdmin()) {
            return [];
        }

        return $this->accessScopes
            ->mapWithKeys(function (UserAccessScope $scope): array {
                return [
                    (string) $scope->module_key => [[
                        'module_key' => (string) $scope->module_key,
                        'data_scope' => (string) ($scope->data_scope ?: 'all'),
                        'allowed_unit_ids' => collect((array) ($scope->allowed_unit_ids ?? []))
                            ->map(fn ($unitId): int => (int) $unitId)
                            ->filter(fn (int $unitId): bool => $unitId > 0)
                            ->values()
                            ->all(),
                        'metadata' => is_array($scope->metadata) ? $scope->metadata : [],
                    ]],
                ];
            })
            ->map(fn (array $rows): array => $rows[0])
            ->all();
    }

    public function dataScopeFor(string $moduleKey): string
    {
        if ($this->isMasterAdmin()) {
            return 'all';
        }

        $scopes = $this->resolvedAccessScopes();

        return (string) ($scopes[$moduleKey]['data_scope'] ?? 'all');
    }

    /**
     * @return array<int, int>
     */
    public function allowedUnitIdsFor(string $moduleKey): array
    {
        if ($this->isMasterAdmin()) {
            return [];
        }

        $scopes = $this->resolvedAccessScopes();

        return collect((array) ($scopes[$moduleKey]['allowed_unit_ids'] ?? []))
            ->map(fn ($unitId): int => (int) $unitId)
            ->filter(fn (int $unitId): bool => $unitId > 0)
            ->values()
            ->all();
    }

    public function canAccessUnit(string $moduleKey, ?int $unitId): bool
    {
        if ($this->isMasterAdmin()) {
            return true;
        }

        $scope = $this->dataScopeFor($moduleKey);

        if ($scope !== 'units') {
            return true;
        }

        if (! $unitId || $unitId <= 0) {
            return false;
        }

        return in_array($unitId, $this->allowedUnitIdsFor($moduleKey), true);
    }

    public function interviews(): HasMany
    {
        return $this->hasMany(DriverInterview::class, 'author_id');
    }

    public function pagamentosLancados(): HasMany
    {
        return $this->hasMany(Pagamento::class, 'autor_id');
    }

    public function colaborador(): HasOne
    {
        return $this->hasOne(Colaborador::class);
    }

    public function onboardingsResponsaveis(): HasMany
    {
        return $this->hasMany(Onboarding::class, 'responsavel_user_id');
    }

    public function onboardingEvents(): HasMany
    {
        return $this->hasMany(OnboardingEvent::class, 'performed_by');
    }

    public function quickAccesses(): HasMany
    {
        return $this->hasMany(UserQuickAccess::class);
    }
}
