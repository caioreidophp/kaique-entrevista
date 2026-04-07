<?php

namespace App\Http\Controllers\Api;

use App\Enums\InterviewCurriculumStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreInterviewCurriculumRequest;
use App\Http\Requests\UpdateInterviewCurriculumRequest;
use App\Http\Resources\InterviewCurriculumResource;
use App\Models\InterviewCurriculum;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InterviewCurriculumController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless(
            $request->user()->hasPermission('curriculums.list'),
            403,
            'Você não possui permissão para listar currículos.'
        );

        $perPage = min(max((int) $request->integer('per_page', 15), 1), 200);
        $tab = Str::of((string) $request->string('tab', 'pendentes'))->lower()->value();
        $includeId = max((int) $request->integer('include_id', 0), 0);

        $query = InterviewCurriculum::query()
            ->select([
                'id',
                'author_id',
                'full_name',
                'phone',
                'role_name',
                'unit_name',
                'observacao',
                'status',
                'document_path',
                'document_original_name',
                'cnh_attachment_path',
                'cnh_attachment_original_name',
                'work_card_attachment_path',
                'work_card_attachment_original_name',
                'created_at',
                'updated_at',
            ])
            ->with([
                'author:id,name,email',
                'linkedInterview:id,curriculum_id,full_name,hr_status,foi_contratado',
            ])
            ->latest('id');

        if (! $request->user()->hasPermission('visibility.interviews.other-authors')) {
            $query->where('author_id', $request->user()->id);
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));

            if ($search !== '') {
                $query->where('full_name', 'like', "%{$search}%");
            }
        }

        if ($tab === 'pendentes') {
            $query->where(function (Builder $builder) use ($includeId): void {
                $builder->where('status', InterviewCurriculumStatus::Pendente->value);

                if ($includeId > 0) {
                    $builder->orWhere('id', $includeId);
                }
            });
        } elseif ($tab === 'passados') {
            $query->where('status', '!=', InterviewCurriculumStatus::Pendente->value);
        }

        return InterviewCurriculumResource::collection(
            $query->paginate($perPage)->withQueryString(),
        );
    }

    public function store(StoreInterviewCurriculumRequest $request): JsonResponse
    {
        abort_unless(
            $request->user()->hasPermission('curriculums.create'),
            403,
            'Você não possui permissão para cadastrar currículos.'
        );

        $validated = $request->validated();

        $curriculum = DB::transaction(function () use ($request, $validated): InterviewCurriculum {
            /** @var \Illuminate\Http\UploadedFile $file */
            $file = $validated['curriculum_file'];
            /** @var \Illuminate\Http\UploadedFile|null $cnhAttachment */
            $cnhAttachment = $request->file('cnh_attachment_file');
            /** @var \Illuminate\Http\UploadedFile|null $workCardAttachment */
            $workCardAttachment = $request->file('work_card_attachment_file');

            $curriculum = InterviewCurriculum::query()->create([
                'author_id' => $request->user()->id,
                'full_name' => trim((string) $validated['full_name']),
                'phone' => trim((string) $validated['phone']),
                'role_name' => trim((string) $validated['role_name']),
                'unit_name' => trim((string) $validated['unit_name']),
                'observacao' => null,
                'document_path' => '',
                'document_original_name' => $file->getClientOriginalName(),
                'cnh_attachment_path' => null,
                'cnh_attachment_original_name' => $cnhAttachment?->getClientOriginalName(),
                'work_card_attachment_path' => null,
                'work_card_attachment_original_name' => $workCardAttachment?->getClientOriginalName(),
                'status' => InterviewCurriculumStatus::Pendente->value,
            ]);

            $storedPath = $file->store("interview-curriculums/{$curriculum->id}", 'public');

            $cnhPath = $cnhAttachment?->store("interview-curriculums/{$curriculum->id}/cnh", 'public');
            $workCardPath = $workCardAttachment?->store("interview-curriculums/{$curriculum->id}/work-card", 'public');

            $curriculum->update([
                'document_path' => $storedPath,
                'cnh_attachment_path' => $cnhPath,
                'work_card_attachment_path' => $workCardPath,
            ]);

            return $curriculum;
        });

        return (new InterviewCurriculumResource(
            $curriculum->load([
                'author:id,name,email',
                'linkedInterview:id,curriculum_id,full_name,hr_status,foi_contratado',
            ])
        ))
            ->response()
            ->setStatusCode(201);
    }

    public function refuse(Request $request, InterviewCurriculum $interviewCurriculum): InterviewCurriculumResource
    {
        abort_unless(
            $request->user()->hasPermission('curriculums.refuse'),
            403,
            'Você não possui permissão para recusar currículos.'
        );

        $this->ensureVisibleToUser($request, $interviewCurriculum);

        abort_unless(
            $interviewCurriculum->status === InterviewCurriculumStatus::Pendente,
            422,
            'Somente currículos pendentes podem ser recusados.'
        );

        $interviewCurriculum->update([
            'status' => InterviewCurriculumStatus::Recusado->value,
        ]);

        return new InterviewCurriculumResource(
            $interviewCurriculum->refresh()->load([
                'author:id,name,email',
                'linkedInterview:id,curriculum_id,full_name,hr_status,foi_contratado',
            ]),
        );
    }

    public function update(
        UpdateInterviewCurriculumRequest $request,
        InterviewCurriculum $interviewCurriculum,
    ): InterviewCurriculumResource {
        abort_unless(
            $request->user()->hasPermission('curriculums.create'),
            403,
            'Você não possui permissão para editar currículos.'
        );

        $this->ensureVisibleToUser($request, $interviewCurriculum);

        $validated = $request->validated();

        $interviewCurriculum->update([
            'full_name' => trim((string) $validated['full_name']),
            'phone' => trim((string) $validated['phone']),
            'role_name' => trim((string) $validated['role_name']),
            'unit_name' => trim((string) $validated['unit_name']),
            'observacao' => array_key_exists('observacao', $validated)
                ? ($validated['observacao'] !== null ? trim((string) $validated['observacao']) : null)
                : $interviewCurriculum->observacao,
        ]);

        return new InterviewCurriculumResource(
            $interviewCurriculum->refresh()->load([
                'author:id,name,email',
                'linkedInterview:id,curriculum_id,full_name,hr_status,foi_contratado',
            ]),
        );
    }

    public function destroy(Request $request, InterviewCurriculum $interviewCurriculum): JsonResponse
    {
        abort_unless(
            $request->user()->hasPermission('curriculums.create'),
            403,
            'Você não possui permissão para excluir currículos.'
        );

        $this->ensureVisibleToUser($request, $interviewCurriculum);

        abort_if(
            $interviewCurriculum->linkedInterview()->exists(),
            422,
            'Não é possível excluir currículo já vinculado em entrevista.'
        );

        $interviewCurriculum->delete();

        return response()->json([], 204);
    }

    private function ensureVisibleToUser(Request $request, InterviewCurriculum $curriculum): void
    {
        if ($request->user()->hasPermission('visibility.interviews.other-authors')) {
            return;
        }

        abort_unless(
            $curriculum->author_id === $request->user()->id,
            403,
            'Você não possui permissão para acessar este currículo.'
        );
    }
}
