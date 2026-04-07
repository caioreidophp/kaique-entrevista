<?php

namespace App\Http\Controllers\Api;

use App\Enums\HrStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\MarkInterviewAsHiredRequest;
use App\Http\Resources\NextStepCandidateResource;
use App\Models\Colaborador;
use App\Models\DriverInterview;
use App\Support\InterviewCurriculumStatusService;
use App\Support\InterviewDocumentService;
use App\Support\OnboardingService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class NextStepController extends Controller
{
    public function __construct(
        private readonly InterviewDocumentService $documents,
        private readonly OnboardingService $onboardingService,
        private readonly InterviewCurriculumStatusService $curriculumStatusService,
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

            $this->curriculumStatusService->syncFromInterview($driverInterview->refresh());

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

        if ($colaborador) {
            $this->syncColaboradorFromInterview(
                $driverInterview->refresh()->load('curriculum'),
                $colaborador,
            );
        }

        $this->curriculumStatusService->syncFromInterview($driverInterview->refresh());

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

    private function syncColaboradorFromInterview(DriverInterview $interview, Colaborador $colaborador): void
    {
        $updates = [];

        if (! $colaborador->apelido && $interview->preferred_name) {
            $updates['apelido'] = $interview->preferred_name;
        }

        if (! $colaborador->rg && $interview->rg) {
            $updates['rg'] = $interview->rg;
        }

        if (! $colaborador->cnh && $interview->cnh_number) {
            $updates['cnh'] = $interview->cnh_number;
        }

        if (! $colaborador->validade_cnh && $interview->cnh_expiration_date) {
            $updates['validade_cnh'] = $interview->cnh_expiration_date;
        }

        if (! $colaborador->telefone && $interview->phone) {
            $updates['telefone'] = $interview->phone;
        }

        if (! $colaborador->email && $interview->email) {
            $updates['email'] = $interview->email;
        }

        if (! $colaborador->data_admissao && $interview->start_availability_date) {
            $updates['data_admissao'] = $interview->start_availability_date;
        }

        if ($updates !== []) {
            $colaborador->update($updates);
            $colaborador->refresh();
        }

        $this->copyAttachmentToColaborador(
            $interview->candidate_photo_path,
            'foto_3x4_path',
            null,
            $colaborador,
            'foto-3x4',
        );

        $this->copyAttachmentToColaborador(
            $interview->cnh_attachment_path ?: $interview->curriculum?->cnh_attachment_path,
            'cnh_attachment_path',
            'cnh_attachment_original_name',
            $colaborador,
            'cnh',
            $interview->cnh_attachment_original_name
                ?: $interview->curriculum?->cnh_attachment_original_name,
        );

        $this->copyAttachmentToColaborador(
            $interview->work_card_attachment_path ?: $interview->curriculum?->work_card_attachment_path,
            'work_card_attachment_path',
            'work_card_attachment_original_name',
            $colaborador,
            'work-card',
            $interview->work_card_attachment_original_name
                ?: $interview->curriculum?->work_card_attachment_original_name,
        );
    }

    private function copyAttachmentToColaborador(
        ?string $sourcePath,
        string $targetPathField,
        ?string $targetNameField,
        Colaborador $colaborador,
        string $folder,
        ?string $originalName = null,
    ): void {
        $normalizedSource = trim((string) $sourcePath);

        if ($normalizedSource === '' || ! Storage::disk('public')->exists($normalizedSource)) {
            return;
        }

        $extension = pathinfo($normalizedSource, PATHINFO_EXTENSION);
        $targetPath = "colaboradores/{$colaborador->id}/{$folder}/".Str::uuid().($extension ? ".{$extension}" : '');

        if (! Storage::disk('public')->copy($normalizedSource, $targetPath)) {
            return;
        }

        $currentTargetPath = trim((string) ($colaborador->{$targetPathField} ?? ''));

        if ($currentTargetPath !== '') {
            Storage::disk('public')->delete($currentTargetPath);
        }

        $updates = [
            $targetPathField => $targetPath,
        ];

        if ($targetNameField !== null) {
            $updates[$targetNameField] = $originalName;
        }

        $colaborador->update($updates);
    }
}
