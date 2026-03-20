<?php

namespace App\Models;

use App\Support\RolePermissionCatalog;
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
}
