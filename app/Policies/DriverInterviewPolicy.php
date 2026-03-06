<?php

namespace App\Policies;

use App\Models\DriverInterview;
use App\Models\User;

class DriverInterviewPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isMasterAdmin() || $user->isAdmin() || $user->isUsuario();
    }

    public function view(User $user, DriverInterview $driverInterview): bool
    {
        if ($user->isMasterAdmin()) {
            return true;
        }

        return $driverInterview->author_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->isMasterAdmin() || $user->isAdmin() || $user->isUsuario();
    }

    public function update(User $user, DriverInterview $driverInterview): bool
    {
        if ($user->isMasterAdmin()) {
            return true;
        }

        return $driverInterview->author_id === $user->id;
    }

    public function delete(User $user, DriverInterview $driverInterview): bool
    {
        if ($user->isMasterAdmin()) {
            return true;
        }

        return $driverInterview->author_id === $user->id;
    }

    public function print(User $user, DriverInterview $driverInterview): bool
    {
        if ($user->isMasterAdmin()) {
            return true;
        }

        return $driverInterview->author_id === $user->id;
    }
}
