<?php

namespace App\Policies;

use App\Models\Onboarding;
use App\Models\User;

class OnboardingPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isMasterAdmin() || $user->isAdmin() || $user->isUsuario();
    }

    public function view(User $user, Onboarding $onboarding): bool
    {
        if ($user->isMasterAdmin()) {
            return true;
        }

        if ($onboarding->responsavel_user_id === $user->id) {
            return true;
        }

        return $onboarding->interview?->author_id === $user->id;
    }

    public function update(User $user, Onboarding $onboarding): bool
    {
        if ($user->isMasterAdmin()) {
            return true;
        }

        if ($onboarding->responsavel_user_id === $user->id) {
            return true;
        }

        return $onboarding->interview?->author_id === $user->id;
    }
}
