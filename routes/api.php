<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DriverInterviewController;
use App\Http\Controllers\Api\FreightController;
use App\Http\Controllers\Api\HomeController;
use App\Http\Controllers\Api\NextStepController;
use App\Http\Controllers\Api\OnboardingController;
use App\Http\Controllers\Api\PayrollController;
use App\Http\Controllers\Api\ReferenceCityController;
use App\Http\Controllers\Api\Registry\ColaboradorController;
use App\Http\Controllers\Api\Registry\FuncaoController;
use App\Http\Controllers\Api\Registry\RegistryUserController;
use App\Http\Controllers\Api\Registry\UnidadeController;
use App\Http\Controllers\Api\TransportSettingsController;
use Illuminate\Support\Facades\Route;

Route::post('login', [AuthController::class, 'login'])
    ->middleware('throttle:transport-login');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('me', [AuthController::class, 'me']);
    Route::put('settings/password', [TransportSettingsController::class, 'updatePassword']);
    Route::post('users', [TransportSettingsController::class, 'storeUser']);

    Route::get('home', HomeController::class);
    Route::get('dashboard/summary', DashboardController::class);
    Route::get('payroll/dashboard', [PayrollController::class, 'dashboard']);
    Route::get('payroll/summary', [PayrollController::class, 'summary']);
    Route::get('payroll/launch-candidates', [PayrollController::class, 'launchCandidates']);
    Route::post('payroll/launch-batch', [PayrollController::class, 'launchBatch']);
    Route::get('payroll/reports/unidade', [PayrollController::class, 'reportByUnit']);
    Route::get('payroll/reports/colaborador', [PayrollController::class, 'reportByCollaborator']);
    Route::apiResource('payroll/pagamentos', PayrollController::class);
    Route::get('freight/dashboard', [FreightController::class, 'dashboard']);
    Route::get('freight/monthly-unit-report', [FreightController::class, 'monthlyUnitReport']);
    Route::get('freight/timeline', [FreightController::class, 'timeline']);
    Route::apiResource('freight/entries', FreightController::class)
        ->only(['index', 'store', 'update']);
    Route::get('driver-interviews/{driverInterview}/pdf', [DriverInterviewController::class, 'pdf']);
    Route::patch('driver-interviews/{driverInterview}/statuses', [DriverInterviewController::class, 'updateStatuses']);
    Route::get('next-steps/candidates', [NextStepController::class, 'index'])
        ->name('api.next-steps.index');
    Route::patch('next-steps/{driverInterview}/hiring-status', [NextStepController::class, 'markHired'])
        ->name('api.next-steps.hiring-status');
    Route::get('next-steps/{driverInterview}/documents/{document}/preview', [NextStepController::class, 'preview'])
        ->whereIn('document', ['checklist', 'raca-etnia'])
        ->name('api.next-steps.documents.preview');
    Route::get('next-steps/{driverInterview}/documents/{document}/pdf', [NextStepController::class, 'pdf'])
        ->whereIn('document', ['checklist', 'raca-etnia'])
        ->name('api.next-steps.documents.pdf');

    Route::get('onboardings', [OnboardingController::class, 'index'])
        ->name('api.onboarding.index');
    Route::get('onboardings/summary', [OnboardingController::class, 'summary'])
        ->name('api.onboarding.summary');
    Route::get('onboardings/{onboarding}', [OnboardingController::class, 'show'])
        ->name('api.onboarding.show');
    Route::patch('onboardings/{onboarding}/assign', [OnboardingController::class, 'assign'])
        ->name('api.onboarding.assign');
    Route::post('onboardings/{onboarding}/complete', [OnboardingController::class, 'complete'])
        ->name('api.onboarding.complete');
    Route::patch('onboarding-items/{onboardingItem}', [OnboardingController::class, 'updateItem'])
        ->name('api.onboarding.items.update');
    Route::post('onboarding-items/{onboardingItem}/attachments', [OnboardingController::class, 'uploadAttachment'])
        ->middleware('throttle:transport-uploads')
        ->name('api.onboarding.items.attachments.store');
    Route::get('onboarding-attachments/{onboardingItemAttachment}/download', [OnboardingController::class, 'downloadAttachment'])
        ->name('api.onboarding.attachments.download');

    Route::apiResource('driver-interviews', DriverInterviewController::class);

    Route::get('activity-log', [ActivityLogController::class, 'index']);
    Route::get('reference/cities', [ReferenceCityController::class, 'index']);

    Route::prefix('registry')->group(function (): void {
        Route::get('unidades', [UnidadeController::class, 'index']);
        Route::apiResource('funcoes', FuncaoController::class);
        Route::post('colaboradores/import-spreadsheet', [ColaboradorController::class, 'importSpreadsheet'])
            ->middleware('throttle:transport-import');
        Route::post('colaboradores/{colaborador}/foto-3x4', [ColaboradorController::class, 'uploadPhoto'])
            ->middleware('throttle:transport-uploads');
        Route::apiResource('colaboradores', ColaboradorController::class)
            ->parameters(['colaboradores' => 'colaborador'])
            ->only(['index', 'store', 'show', 'update', 'destroy']);
        Route::get('users', [RegistryUserController::class, 'index']);
        Route::post('users', [RegistryUserController::class, 'store']);
        Route::put('users/{user}', [RegistryUserController::class, 'update']);
        Route::delete('users/{user}', [RegistryUserController::class, 'destroy']);
    });
});
