<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DriverInterviewController;
use App\Http\Controllers\Api\FreightCanceledLoadController;
use App\Http\Controllers\Api\FreightController;
use App\Http\Controllers\Api\HomeController;
use App\Http\Controllers\Api\NextStepController;
use App\Http\Controllers\Api\OnboardingController;
use App\Http\Controllers\Api\PayrollController;
use App\Http\Controllers\Api\PayrollDescontoController;
use App\Http\Controllers\Api\PayrollEmprestimoController;
use App\Http\Controllers\Api\PayrollPensaoController;
use App\Http\Controllers\Api\PayrollVacationController;
use App\Http\Controllers\Api\ReferenceCityController;
use App\Http\Controllers\Api\Registry\AviarioController;
use App\Http\Controllers\Api\Registry\ColaboradorController;
use App\Http\Controllers\Api\Registry\FuncaoController;
use App\Http\Controllers\Api\Registry\PlacaFrotaController;
use App\Http\Controllers\Api\Registry\RegistryUserController;
use App\Http\Controllers\Api\Registry\RolePermissionController;
use App\Http\Controllers\Api\Registry\TipoPagamentoController;
use App\Http\Controllers\Api\Registry\UnidadeController;
use App\Http\Controllers\Api\TransportInsightsController;
use App\Http\Controllers\Api\TransportSettingsController;
use Illuminate\Support\Facades\Route;

Route::post('login', [AuthController::class, 'login'])
    ->middleware('throttle:transport-login');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('me', [AuthController::class, 'me']);
    Route::put('settings/password', [TransportSettingsController::class, 'updatePassword'])
        ->middleware('throttle:transport-heavy');
    Route::get('settings/backup', [TransportSettingsController::class, 'downloadBackup'])
        ->middleware('throttle:transport-backup');
    Route::post('users', [TransportSettingsController::class, 'storeUser'])
        ->middleware('throttle:transport-heavy');

    Route::get('home', HomeController::class);
    Route::get('dashboard/summary', DashboardController::class);
    Route::get('insights/pending', [TransportInsightsController::class, 'pending'])
        ->middleware('throttle:transport-heavy');
    Route::get('payroll/dashboard', [PayrollController::class, 'dashboard']);
    Route::get('payroll/summary', [PayrollController::class, 'summary']);
    Route::get('payroll/launch-candidates', [PayrollController::class, 'launchCandidates']);
    Route::post('payroll/launch-batch', [PayrollController::class, 'launchBatch'])
        ->middleware('throttle:transport-heavy');
    Route::post('payroll/launch-discount-preview', [PayrollController::class, 'launchDiscountPreview'])
        ->middleware('throttle:transport-heavy');
    Route::get('payroll/reports/unidade', [PayrollController::class, 'reportByUnit'])
        ->middleware('throttle:transport-heavy');
    Route::get('payroll/reports/colaborador', [PayrollController::class, 'reportByCollaborator'])
        ->middleware('throttle:transport-heavy');
    Route::apiResource('payroll/pagamentos', PayrollController::class)
        ->middleware('throttle:transport-heavy');
    Route::apiResource('payroll/descontos', PayrollDescontoController::class)
        ->parameters(['descontos' => 'desconto'])
        ->middleware('throttle:transport-heavy')
        ->only(['index', 'store', 'update', 'destroy']);
    Route::apiResource('payroll/emprestimos', PayrollEmprestimoController::class)
        ->parameters(['emprestimos' => 'emprestimo'])
        ->middleware('throttle:transport-heavy')
        ->only(['index', 'store', 'update', 'destroy']);
    Route::apiResource('payroll/pensoes', PayrollPensaoController::class)
        ->parameters(['pensoes' => 'pensao'])
        ->middleware('throttle:transport-heavy')
        ->only(['index', 'store', 'update', 'destroy']);
    Route::get('payroll/vacations/dashboard', [PayrollVacationController::class, 'dashboard']);
    Route::get('payroll/vacations/candidates', [PayrollVacationController::class, 'candidates']);
    Route::get('payroll/vacations/launched', [PayrollVacationController::class, 'launched']);
    Route::get('payroll/vacations/collaborators/{colaborador}', [PayrollVacationController::class, 'collaboratorHistory']);
    Route::get('payroll/vacations', [PayrollVacationController::class, 'index']);
    Route::post('payroll/vacations', [PayrollVacationController::class, 'store'])
        ->middleware('throttle:transport-heavy');
    Route::put('payroll/vacations/{feriasLancamento}', [PayrollVacationController::class, 'update'])
        ->middleware('throttle:transport-heavy');
    Route::get('freight/dashboard', [FreightController::class, 'dashboard']);
    Route::get('freight/monthly-unit-report', [FreightController::class, 'monthlyUnitReport'])
        ->middleware('throttle:transport-heavy');
    Route::get('freight/timeline', [FreightController::class, 'timeline'])
        ->middleware('throttle:transport-heavy');
    Route::get('freight/operational-report', [FreightController::class, 'operationalReport'])
        ->middleware('throttle:transport-heavy');
    Route::get('freight/spot-entries', [FreightController::class, 'spotIndex']);
    Route::post('freight/spot-entries', [FreightController::class, 'storeSpot'])
        ->middleware('throttle:transport-uploads');
    Route::get('freight/canceled-loads', [FreightCanceledLoadController::class, 'index']);
    Route::delete('freight/canceled-loads/{canceledLoad}', [FreightCanceledLoadController::class, 'destroy'])
        ->middleware('throttle:transport-uploads');
    Route::put('freight/canceled-loads/{canceledLoad}/trip-number', [FreightCanceledLoadController::class, 'updateTripNumber'])
        ->middleware('throttle:transport-uploads');
    Route::post('freight/canceled-loads/bill', [FreightCanceledLoadController::class, 'bill'])
        ->middleware('throttle:transport-uploads');
    Route::post('freight/canceled-loads/{canceledLoad}/unbill', [FreightCanceledLoadController::class, 'unbillOne'])
        ->middleware('throttle:transport-uploads');
    Route::post('freight/canceled-load-batches/{batch}/unbill', [FreightCanceledLoadController::class, 'unbillBatch'])
        ->middleware('throttle:transport-uploads');
    Route::delete('freight/canceled-load-batches/{batch}', [FreightCanceledLoadController::class, 'destroyBatch'])
        ->middleware('throttle:transport-uploads');
    Route::apiResource('freight/entries', FreightController::class)
        ->only(['index', 'store', 'update', 'destroy'])
        ->middleware('throttle:transport-heavy');
    Route::post('freight/entries/import-spreadsheet-preview', [FreightController::class, 'previewSpreadsheet'])
        ->middleware('throttle:transport-import');
    Route::post('freight/entries/import-spreadsheet', [FreightController::class, 'importSpreadsheet'])
        ->middleware('throttle:transport-import');
    Route::get('driver-interviews/{driverInterview}/pdf', [DriverInterviewController::class, 'pdf'])
        ->middleware('throttle:transport-heavy');
    Route::patch('driver-interviews/{driverInterview}/statuses', [DriverInterviewController::class, 'updateStatuses'])
        ->middleware('throttle:transport-heavy');
    Route::get('next-steps/candidates', [NextStepController::class, 'index'])
        ->name('api.next-steps.index');
    Route::patch('next-steps/{driverInterview}/hiring-status', [NextStepController::class, 'markHired'])
        ->middleware('throttle:transport-heavy')
        ->name('api.next-steps.hiring-status');
    Route::get('next-steps/{driverInterview}/documents/{document}/preview', [NextStepController::class, 'preview'])
        ->whereIn('document', ['checklist', 'raca-etnia'])
        ->name('api.next-steps.documents.preview');
    Route::get('next-steps/{driverInterview}/documents/{document}/pdf', [NextStepController::class, 'pdf'])
        ->whereIn('document', ['checklist', 'raca-etnia'])
        ->middleware('throttle:transport-heavy')
        ->name('api.next-steps.documents.pdf');

    Route::get('onboardings', [OnboardingController::class, 'index'])
        ->name('api.onboarding.index');
    Route::get('onboardings/summary', [OnboardingController::class, 'summary'])
        ->name('api.onboarding.summary');
    Route::get('onboardings/{onboarding}', [OnboardingController::class, 'show'])
        ->name('api.onboarding.show');
    Route::patch('onboardings/{onboarding}/assign', [OnboardingController::class, 'assign'])
        ->middleware('throttle:transport-heavy')
        ->name('api.onboarding.assign');
    Route::post('onboardings/{onboarding}/complete', [OnboardingController::class, 'complete'])
        ->middleware('throttle:transport-heavy')
        ->name('api.onboarding.complete');
    Route::patch('onboarding-items/{onboardingItem}', [OnboardingController::class, 'updateItem'])
        ->middleware('throttle:transport-heavy')
        ->name('api.onboarding.items.update');
    Route::post('onboarding-items/{onboardingItem}/attachments', [OnboardingController::class, 'uploadAttachment'])
        ->middleware('throttle:transport-uploads')
        ->name('api.onboarding.items.attachments.store');
    Route::get('onboarding-attachments/{onboardingItemAttachment}/download', [OnboardingController::class, 'downloadAttachment'])
        ->name('api.onboarding.attachments.download');

    Route::apiResource('driver-interviews', DriverInterviewController::class)
        ->middleware('throttle:transport-heavy');

    Route::get('activity-log', [ActivityLogController::class, 'index']);
    Route::get('reference/cities', [ReferenceCityController::class, 'index']);

    Route::prefix('registry')->group(function (): void {
        Route::get('unidades', [UnidadeController::class, 'index']);
        Route::apiResource('funcoes', FuncaoController::class)
            ->middleware('throttle:transport-heavy');
        Route::get('colaboradores/export-csv', [ColaboradorController::class, 'exportCsv']);
        Route::post('placas-frota/bulk', [PlacaFrotaController::class, 'bulkStore'])
            ->middleware('throttle:transport-heavy');
        Route::apiResource('placas-frota', PlacaFrotaController::class)
            ->parameters(['placas-frota' => 'placaFrota'])
            ->middleware('throttle:transport-heavy')
            ->only(['index', 'store', 'update', 'destroy']);
        Route::post('aviarios/bulk', [AviarioController::class, 'bulkStore'])
            ->middleware('throttle:transport-heavy');
        Route::post('aviarios/import-spreadsheet', [AviarioController::class, 'importSpreadsheet'])
            ->middleware('throttle:transport-import');
        Route::get('aviarios/export-csv', [AviarioController::class, 'exportCsv']);
        Route::apiResource('aviarios', AviarioController::class)
            ->parameters(['aviarios' => 'aviario'])
            ->middleware('throttle:transport-heavy')
            ->only(['index', 'store', 'update', 'destroy']);
        Route::apiResource('tipos-pagamento', TipoPagamentoController::class)
            ->parameters(['tipos-pagamento' => 'tipoPagamento'])
            ->middleware('throttle:transport-heavy');
        Route::post('colaboradores/import-spreadsheet', [ColaboradorController::class, 'importSpreadsheet'])
            ->middleware('throttle:transport-import');
        Route::post('colaboradores/{colaborador}/foto-3x4', [ColaboradorController::class, 'uploadPhoto'])
            ->middleware('throttle:transport-uploads');
        Route::apiResource('colaboradores', ColaboradorController::class)
            ->parameters(['colaboradores' => 'colaborador'])
            ->middleware('throttle:transport-heavy')
            ->only(['index', 'store', 'show', 'update', 'destroy']);
        Route::get('users', [RegistryUserController::class, 'index']);
        Route::post('users', [RegistryUserController::class, 'store'])
            ->middleware('throttle:transport-heavy');
        Route::put('users/{user}', [RegistryUserController::class, 'update'])
            ->middleware('throttle:transport-heavy');
        Route::delete('users/{user}', [RegistryUserController::class, 'destroy'])
            ->middleware('throttle:transport-heavy');
        Route::get('role-permissions', [RolePermissionController::class, 'index']);
        Route::put('role-permissions/{role}', [RolePermissionController::class, 'update'])
            ->middleware('throttle:transport-heavy');
    });
});
