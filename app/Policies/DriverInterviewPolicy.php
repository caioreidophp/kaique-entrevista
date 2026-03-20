<?php

namespace App\Policies;

use App\Models\DriverInterview;
use App\Models\User;

class DriverInterviewPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('interviews.list');
    }

    public function view(User $user, DriverInterview $driverInterview): bool
    {
        if (! $user->hasPermission('interviews.list')) {
            return false;
        }

        if ($user->hasPermission('visibility.interviews.other-authors')) {
            return true;
        }

        return $driverInterview->author_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('interviews.create');
    }

    public function update(User $user, DriverInterview $driverInterview): bool
    {
        if (! $user->hasPermission('interviews.update')) {
            return false;
        }

        if ($user->hasPermission('visibility.interviews.other-authors')) {
            return true;
        }

        return $driverInterview->author_id === $user->id;
    }

    public function delete(User $user, DriverInterview $driverInterview): bool
    {
        if (! $user->hasPermission('interviews.delete')) {
            return false;
        }

        if ($user->hasPermission('visibility.interviews.other-authors')) {
            return true;
        }

        return $driverInterview->author_id === $user->id;
    }

    public function print(User $user, DriverInterview $driverInterview): bool
    {
        if (! $user->hasPermission('interviews.pdf')) {
            return false;
        }

        if ($user->hasPermission('visibility.interviews.other-authors')) {
            return true;
        }

        return $driverInterview->author_id === $user->id;
    }
}
