<?php

namespace App\Http\Controllers\Api;

use App\Enums\HrStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\MarkInterviewAsHiredRequest;
use App\Http\Resources\NextStepCandidateResource;
use App\Models\Colaborador;
use App\Models\DriverInterview;
use App\Support\InterviewDocumentService;
use App\Support\OnboardingService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class NextStepController extends Controller
{
    public function __construct(
        private readonly InterviewDocumentService $documents,
        private readonly OnboardingService $onboardingService,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', DriverInterview::class);

        $perPage = min(max((int) $request->integer('per_page', 15), 1), 100);

        $query = DriverInterview::query()
            ->with('onboarding:id,driver_interview_id,status')
            ->where('hr_status', HrStatus::Aprovado->value)
            ->latest('id');

        if (! $request->user()->isMasterAdmin()) {
            $query->where('author_id', $request->user()->id);
        }

        return NextStepCandidateResource::collection(
            $query->paginate($perPage)->withQueryString(),
        );
    }

    public function preview(DriverInterview $driverInterview, string $document): Response
    {
        $this->authorize('print', $driverInterview);
        $this->ensureApproved($driverInterview);

        return response()->view(
            $this->documents->documentView($document),
            $this->documents->viewData($driverInterview->load('author:id,name,email'), $document, 'preview'),
        );
    }

    public function pdf(Request $request, DriverInterview $driverInterview, string $document): Response
    {
        $this->authorize('print', $driverInterview);
        $this->ensureApproved($driverInterview);

        $pdf = Pdf::loadView(
            $this->documents->documentView($document),
            $this->documents->viewData($driverInterview->load('author:id,name,email'), $document, 'pdf'),
        );

        $download = $request->boolean('download');
        $filename = $this->documents->fileName($document, $driverInterview);

        return response(
            $pdf->output(),
            200,
            [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => ($download ? 'attachment' : 'inline').'; filename="'.$filename.'"',
            ],
        );
    }

    public function markHired(MarkInterviewAsHiredRequest $request, DriverInterview $driverInterview): Response
    {
        $this->authorize('update', $driverInterview);
        $this->ensureApproved($driverInterview);

        $data = $request->validated();

        if (! $data['foi_contratado']) {
            $driverInterview->update([
                'foi_contratado' => false,
                'colaborador_id' => null,
            ]);

            $driverInterview->onboarding()?->delete();

            return response([
                'data' => [
                    'foi_contratado' => false,
                    'colaborador_id' => null,
                    'onboarding_id' => null,
                    'onboarding_status' => null,
                ],
            ], 200);
        }

        $colaboradorId = isset($data['colaborador_id'])
            ? (int) $data['colaborador_id']
            : null;

        $colaborador = null;

        if ($colaboradorId) {
            $colaborador = Colaborador::query()->findOrFail($colaboradorId);

            abort_if(
                $colaborador->cpf !== $driverInterview->cpf,
                422,
                'CPF do colaborador não corresponde ao candidato da entrevista.',
            );
        }

        $driverInterview->update([
            'foi_contratado' => true,
            'colaborador_id' => $colaborador?->id,
        ]);

        $onboarding = $this->onboardingService->createForInterview(
            $driverInterview->refresh(),
            $request->user(),
        );

        return response([
            'data' => [
                'foi_contratado' => true,
                'colaborador_id' => $colaborador?->id,
                'onboarding_id' => $onboarding->id,
                'onboarding_status' => $onboarding->status,
            ],
        ], 200);
    }

    private function ensureApproved(DriverInterview $driverInterview): void
    {
        abort_unless(
            $driverInterview->hr_status === HrStatus::Aprovado,
            422,
            'Documento disponível apenas para candidatos aprovados.',
        );
    }
}
