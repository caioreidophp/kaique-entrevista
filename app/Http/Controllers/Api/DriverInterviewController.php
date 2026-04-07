<?php

namespace App\Http\Controllers\Api;

use App\Enums\HrStatus;
use App\Enums\InterviewCurriculumStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDriverInterviewRequest;
use App\Http\Requests\UpdateDriverInterviewAttachmentsRequest;
use App\Http\Requests\UpdateDriverInterviewRequest;
use App\Http\Requests\UpdateDriverInterviewStatusesRequest;
use App\Http\Resources\DriverInterviewListResource;
use App\Http\Resources\DriverInterviewResource;
use App\Models\DriverInterview;
use App\Models\InterviewCurriculum;
use App\Models\User;
use App\Support\InterviewCurriculumStatusService;
use App\Support\PdfBranding;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class DriverInterviewController extends Controller
{
    public function __construct(
        private readonly InterviewCurriculumStatusService $curriculumStatusService,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', DriverInterview::class);

        $perPage = min(max((int) $request->integer('per_page', 15), 1), 100);

        $query = DriverInterview::query()
            ->select([
                'id',
                'author_id',
                'full_name',
                'hiring_unidade_id',
                'hr_status',
                'hr_rejection_reason',
                'guep_status',
                'curriculum_id',
                'candidate_photo_path',
                'cnh_attachment_path',
                'work_card_attachment_path',
                'created_at',
            ])
            ->with([
                'author:id,name,email',
                'hiringUnidade:id,nome,slug',
                'curriculum:id,full_name,status',
            ])
            ->latest('id');

        if (! $request->user()->hasPermission('visibility.interviews.other-authors')) {
            $query->where('author_id', $request->user()->id);
        }

        if ($request->filled('name')) {
            $name = (string) $request->string('name');
            $query->where('full_name', 'like', "%{$name}%");
        }

        if ($request->filled('status')) {
            $query->where('hr_status', (string) $request->string('status'));
        }

        if ($request->filled('author_id') && $request->user()->hasPermission('visibility.interviews.other-authors')) {
            $query->where('author_id', (int) $request->integer('author_id'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', (string) $request->string('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', (string) $request->string('date_to'));
        }

        return DriverInterviewListResource::collection(
            $query->paginate($perPage)->withQueryString(),
        );
    }

    public function store(StoreDriverInterviewRequest $request): DriverInterviewResource
    {
        $this->authorize('create', DriverInterview::class);

        $data = $request->validated();
        $curriculum = $this->resolveCurriculumForInterview(
            isset($data['curriculum_id']) ? (int) $data['curriculum_id'] : null,
            $request,
        );

        $data['guep_status'] = $data['hr_status'] === HrStatus::Reprovado->value
            ? 'nao_fazer'
            : 'aguardando';

        if ($data['hr_status'] === HrStatus::Reprovado->value && empty($data['hr_rejection_reason'])) {
            $data['hr_rejection_reason'] = 'Não informado';
        }

        $data['curriculum_id'] = $curriculum?->id;

        $interview = DB::transaction(function () use ($data, $request): DriverInterview {
            $interview = DriverInterview::query()->create([
                ...$data,
                'user_id' => $request->user()->id,
                'author_id' => $request->user()->id,
            ]);

            $this->curriculumStatusService->syncFromInterview($interview);

            return $interview;
        });

        return new DriverInterviewResource($interview->load($this->interviewRelations()));
    }

    public function show(DriverInterview $driverInterview): DriverInterviewResource
    {
        $this->authorize('view', $driverInterview);

        return new DriverInterviewResource($driverInterview->load($this->interviewRelations()));
    }

    public function update(UpdateDriverInterviewRequest $request, DriverInterview $driverInterview): DriverInterviewResource
    {
        $this->authorize('update', $driverInterview);

        $data = $request->validated();
        $currentCurriculum = $driverInterview->curriculum;
        $nextCurriculum = $this->resolveCurriculumForInterview(
            isset($data['curriculum_id']) ? (int) $data['curriculum_id'] : null,
            $request,
            $driverInterview,
        );
        $nextCurriculumId = $nextCurriculum?->id;
        $previousCurriculumId = (int) ($driverInterview->curriculum_id ?? 0);
        $nextHrStatus = (string) ($data['hr_status'] ?? $driverInterview->hr_status->value);

        if (array_key_exists('hr_rejection_reason', $data)) {
            $data['hr_rejection_reason'] = trim((string) $data['hr_rejection_reason']) ?: null;
        }

        if ($nextHrStatus === HrStatus::Reprovado->value) {
            $data['guep_status'] = 'nao_fazer';
            if (! ($data['hr_rejection_reason'] ?? null)) {
                $data['hr_rejection_reason'] = $driverInterview->hr_rejection_reason ?: 'Não informado';
            }
        } else {
            $data['hr_rejection_reason'] = null;
        }

        $data['curriculum_id'] = $nextCurriculumId;

        DB::transaction(function () use (
            $data,
            $driverInterview,
            $previousCurriculumId,
            $nextCurriculumId,
            $currentCurriculum,
        ): void {
            $driverInterview->update($data);

            if ($previousCurriculumId > 0 && $previousCurriculumId !== $nextCurriculumId) {
                $this->curriculumStatusService->releaseToPending($currentCurriculum?->refresh());
            }

            $this->curriculumStatusService->syncFromInterview($driverInterview->refresh());
        });

        return new DriverInterviewResource($driverInterview->refresh()->load($this->interviewRelations()));
    }

    public function updateStatuses(
        UpdateDriverInterviewStatusesRequest $request,
        DriverInterview $driverInterview
    ): DriverInterviewResource {
        $this->authorize('update', $driverInterview);

        $data = $request->validated();
        $nextHrStatus = (string) ($data['hr_status'] ?? $driverInterview->hr_status->value);

        if (array_key_exists('hr_rejection_reason', $data)) {
            $data['hr_rejection_reason'] = trim((string) $data['hr_rejection_reason']) ?: null;
        }

        if ($nextHrStatus === HrStatus::Reprovado->value) {
            $data['guep_status'] = 'nao_fazer';
            if (! ($data['hr_rejection_reason'] ?? null)) {
                $data['hr_rejection_reason'] = $driverInterview->hr_rejection_reason ?: 'Não informado';
            }
        } else {
            $data['hr_rejection_reason'] = null;
        }

        $driverInterview->update($data);

        $this->curriculumStatusService->syncFromInterview($driverInterview->refresh());

        return new DriverInterviewResource($driverInterview->refresh()->load($this->interviewRelations()));
    }

    public function updateAttachments(
        UpdateDriverInterviewAttachmentsRequest $request,
        DriverInterview $driverInterview
    ): DriverInterviewResource {
        $this->authorize('update', $driverInterview);

        $validated = $request->validated();
        $updates = [];

        if ((bool) ($validated['remove_candidate_photo'] ?? false)) {
            $this->clearAttachment(
                $driverInterview,
                'candidate_photo_path',
                'candidate_photo_original_name',
            );

            $updates['candidate_photo_path'] = null;
            $updates['candidate_photo_original_name'] = null;
        }

        if ((bool) ($validated['remove_cnh_attachment'] ?? false)) {
            $this->clearAttachment(
                $driverInterview,
                'cnh_attachment_path',
                'cnh_attachment_original_name',
            );

            $updates['cnh_attachment_path'] = null;
            $updates['cnh_attachment_original_name'] = null;
        }

        if ((bool) ($validated['remove_work_card_attachment'] ?? false)) {
            $this->clearAttachment(
                $driverInterview,
                'work_card_attachment_path',
                'work_card_attachment_original_name',
            );

            $updates['work_card_attachment_path'] = null;
            $updates['work_card_attachment_original_name'] = null;
        }

        $candidatePhoto = $request->file('candidate_photo_file');

        if ($candidatePhoto instanceof UploadedFile) {
            $stored = $this->replaceAttachment(
                $driverInterview,
                $candidatePhoto,
                'candidate_photo_path',
                'candidate-photo',
            );

            $updates['candidate_photo_path'] = $stored;
            $updates['candidate_photo_original_name'] = $candidatePhoto->getClientOriginalName();
        }

        $cnhAttachment = $request->file('cnh_attachment_file');

        if ($cnhAttachment instanceof UploadedFile) {
            $stored = $this->replaceAttachment(
                $driverInterview,
                $cnhAttachment,
                'cnh_attachment_path',
                'cnh',
            );

            $updates['cnh_attachment_path'] = $stored;
            $updates['cnh_attachment_original_name'] = $cnhAttachment->getClientOriginalName();
        }

        $workCardAttachment = $request->file('work_card_attachment_file');

        if ($workCardAttachment instanceof UploadedFile) {
            $stored = $this->replaceAttachment(
                $driverInterview,
                $workCardAttachment,
                'work_card_attachment_path',
                'work-card',
            );

            $updates['work_card_attachment_path'] = $stored;
            $updates['work_card_attachment_original_name'] = $workCardAttachment->getClientOriginalName();
        }

        if ($updates !== []) {
            $driverInterview->update($updates);
        }

        return new DriverInterviewResource($driverInterview->refresh()->load($this->interviewRelations()));
    }

    public function destroy(DriverInterview $driverInterview): Response
    {
        $this->authorize('delete', $driverInterview);

        $curriculum = $driverInterview->curriculum;

        $driverInterview->delete();

        $this->curriculumStatusService->releaseToPending($curriculum?->refresh());

        return response()->noContent();
    }

    public function pdf(DriverInterview $driverInterview): Response
    {
        $this->authorize('print', $driverInterview);

        $pdf = Pdf::loadView('pdf.driver-interview', [
            'interview' => $driverInterview->load('author:id,name,email'),
            'logoDataUri' => PdfBranding::logoDataUri(),
        ]);

        return response(
            $pdf->output(),
            200,
            [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'inline; filename="entrevista-'.$driverInterview->id.'.pdf"',
            ],
        );
    }

    private function replaceAttachment(
        DriverInterview $driverInterview,
        UploadedFile $file,
        string $pathField,
        string $folder,
    ): string {
        $this->clearAttachment($driverInterview, $pathField, null);

        return $file->store("driver-interviews/{$driverInterview->id}/{$folder}", 'public');
    }

    private function clearAttachment(
        DriverInterview $driverInterview,
        string $pathField,
        ?string $nameField,
    ): void {
        $currentPath = (string) ($driverInterview->{$pathField} ?? '');

        if ($currentPath !== '') {
            Storage::disk('public')->delete($currentPath);
        }

        $driverInterview->{$pathField} = null;

        if ($nameField !== null) {
            $driverInterview->{$nameField} = null;
        }
    }

    /**
     * @return array<int, string>
     */
    private function interviewRelations(): array
    {
        return [
            'author:id,name,email',
            'hiringUnidade:id,nome,slug',
            'curriculum:id,full_name,status,document_path,document_original_name,cnh_attachment_path,cnh_attachment_original_name,work_card_attachment_path,work_card_attachment_original_name',
        ];
    }

    private function resolveCurriculumForInterview(
        ?int $curriculumId,
        Request $request,
        ?DriverInterview $currentInterview = null,
    ): ?InterviewCurriculum {
        if (! $curriculumId) {
            return null;
        }

        $curriculum = InterviewCurriculum::query()->findOrFail($curriculumId);

        $this->ensureCurriculumVisibleToUser($request->user(), $curriculum);

        $belongsToCurrentInterview =
            $currentInterview !== null
            && (int) $currentInterview->curriculum_id === $curriculum->id;

        if (! $belongsToCurrentInterview) {
            abort_unless(
                $curriculum->status === InterviewCurriculumStatus::Pendente,
                422,
                'Somente currículos pendentes podem ser vinculados à entrevista.'
            );

            $linkedElsewhere = DriverInterview::query()
                ->where('curriculum_id', $curriculum->id)
                ->when(
                    $currentInterview !== null,
                    fn ($query) => $query->where('id', '!=', $currentInterview->id),
                )
                ->exists();

            abort_if(
                $linkedElsewhere,
                422,
                'Este currículo já está vinculado a outra entrevista.'
            );
        }

        return $curriculum;
    }

    private function ensureCurriculumVisibleToUser(User $user, InterviewCurriculum $curriculum): void
    {
        if ($user->hasPermission('visibility.interviews.other-authors')) {
            return;
        }

        abort_unless(
            (int) $curriculum->author_id === (int) $user->id,
            403,
            'Você não possui permissão para utilizar este currículo.'
        );
    }
}
