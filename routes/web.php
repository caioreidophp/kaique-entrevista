<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('/', function () {
    return Inertia::render('welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

Route::get('dashboard', function () {
    return Inertia::render('dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::prefix('transport')->group(function (): void {
    Route::get('login', function () {
        return Inertia::render('transport/login');
    })->name('transport.login');

    Route::get('home', function () {
        return Inertia::render('transport/home');
    })->name('transport.home');

    Route::get('dashboard', function () {
        return Inertia::render('transport/dashboard');
    })->name('transport.dashboard');

    if ((bool) config('transport_features.operations_hub', true)) {
        Route::get('pendencias', function () {
            return Inertia::render('transport/operations-hub');
        })->name('transport.pendencias');

        Route::get('operations-hub', function () {
            return redirect()->route('transport.pendencias');
        })->name('transport.operations-hub');
    }

    Route::prefix('payroll')->group(function (): void {
        Route::get('/', function () {
            return Inertia::render('transport/payroll/dashboard');
        })->name('transport.payroll.index');

        Route::get('dashboard', function () {
            return Inertia::render('transport/payroll/dashboard');
        })->name('transport.payroll.dashboard');

        Route::get('launch', function () {
            return Inertia::render('transport/payroll/launch');
        })->name('transport.payroll.launch');

        Route::get('list', function () {
            return Inertia::render('transport/payroll/list');
        })->name('transport.payroll.list');

        Route::get('adjustments', function () {
            return Inertia::render('transport/payroll/adjustments');
        })->name('transport.payroll.adjustments');

        Route::get('vacations', function () {
            return redirect()->route('transport.vacations.dashboard');
        })->name('transport.payroll.vacations');

        Route::get('reports/unit', function () {
            return Inertia::render('transport/payroll/report-unit');
        })->name('transport.payroll.report-unit');

        Route::get('reports/collaborator', function () {
            return Inertia::render('transport/payroll/report-collaborator');
        })->name('transport.payroll.report-collaborator');
    });

    Route::prefix('freight')->group(function (): void {
        Route::get('/', function () {
            return Inertia::render('transport/freight/dashboard');
        })->name('transport.freight.index');

        Route::get('dashboard', function () {
            return Inertia::render('transport/freight/dashboard');
        })->name('transport.freight.dashboard');

        Route::get('launch', function () {
            return Inertia::render('transport/freight/launch');
        })->name('transport.freight.launch');

        Route::get('list', function () {
            return Inertia::render('transport/freight/list');
        })->name('transport.freight.list');

        Route::get('spot', function () {
            return Inertia::render('transport/freight/spot');
        })->name('transport.freight.spot');

        Route::get('operational-report', function () {
            return Inertia::render('transport/freight/operational-report');
        })->name('transport.freight.operational-report');

        Route::get('monthly', function () {
            return Inertia::render('transport/freight/monthly');
        })->name('transport.freight.monthly');

        Route::get('timeline', function () {
            return Inertia::render('transport/freight/timeline');
        })->name('transport.freight.timeline');

        Route::get('canceled-loads', function () {
            return Inertia::render('transport/freight/canceled-loads');
        })->name('transport.freight.canceled-loads');
    });

    Route::prefix('programming')->group(function (): void {
        Route::get('/', function () {
            return redirect()->route('transport.programming.dashboard');
        })->name('transport.programming.index');

        Route::get('dashboard', function () {
            return Inertia::render('transport/programming/dashboard');
        })->name('transport.programming.dashboard');
    });

    Route::prefix('fines')->group(function (): void {
        Route::get('/', function () {
            return redirect()->route('transport.fines.dashboard');
        })->name('transport.fines.index');

        Route::get('dashboard', function () {
            return Inertia::render('transport/fines/dashboard');
        })->name('transport.fines.dashboard');

        Route::get('launch', function () {
            return Inertia::render('transport/fines/launch');
        })->name('transport.fines.launch');

        Route::get('launch-notification', function () {
            return Inertia::render('transport/fines/launch-notification');
        })->name('transport.fines.launch-notification');

        Route::get('list', function () {
            return Inertia::render('transport/fines/list');
        })->name('transport.fines.list');
    });

    Route::prefix('vacations')->group(function (): void {
        Route::get('dashboard', function () {
            return Inertia::render('transport/vacations/dashboard');
        })->name('transport.vacations.dashboard');

        Route::get('list', function () {
            return Inertia::render('transport/vacations/list');
        })->name('transport.vacations.list');

        Route::get('launch', function () {
            return Inertia::render('transport/vacations/launch');
        })->name('transport.vacations.launch');
    });

    Route::get('interviews', function () {
        return Inertia::render('transport/interviews/index');
    })->name('transport.interviews.index');

    Route::get('interviews/create', function () {
        return Inertia::render('transport/interviews/create');
    })->name('transport.interviews.create');

    Route::get('interviews/curriculums', function () {
        return Inertia::render('transport/interviews/curriculums');
    })->name('transport.interviews.curriculums');

    Route::get('next-steps', function () {
        return Inertia::render('transport/next-steps');
    })->name('transport.next-steps');

    Route::get('onboarding', function () {
        return Inertia::render('transport/onboarding/index');
    })->name('transport.onboarding.index');

    Route::get('interviews/{interviewId}', function (int $interviewId) {
        return Inertia::render('transport/interviews/show', [
            'interviewId' => $interviewId,
        ]);
    })->name('transport.interviews.show');

    Route::get('interviews/{interviewId}/edit', function (int $interviewId) {
        return Inertia::render('transport/interviews/edit', [
            'interviewId' => $interviewId,
        ]);
    })->name('transport.interviews.edit');

    Route::get('settings', function () {
        return Inertia::render('transport/settings');
    })->name('transport.settings');

    Route::prefix('registry')->group(function (): void {
        Route::get('collaborators', function () {
            return Inertia::render('transport/registry/collaborators');
        })->name('transport.registry.collaborators');

        Route::get('users', function () {
            return Inertia::render('transport/registry/users');
        })->name('transport.registry.users');

        Route::get('functions', function () {
            return Inertia::render('transport/registry/functions');
        })->name('transport.registry.functions');

        Route::get('payment-types', function () {
            return Inertia::render('transport/registry/payment-types');
        })->name('transport.registry.payment-types');

        Route::get('plates-aviaries', function () {
            return Inertia::render('transport/registry/plates-aviaries');
        })->name('transport.registry.plates-aviaries');

        Route::get('infractions', function () {
            return Inertia::render('transport/registry/infractions');
        })->name('transport.registry.infractions');
    });

    Route::get('activity-log', function () {
        return Inertia::render('transport/activity-log');
    })->name('transport.activity-log');
});

require __DIR__.'/settings.php';
