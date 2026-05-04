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
        $validated = $request->validate([
            'tab' => ['nullable', 'string', 'in:pendentes,passados,convocados,descartados'],
            'include_id' => ['nullable', 'integer', 'min:0'],
            'search' => ['nullable', 'string', 'max:255'],
            'role_name' => ['nullable', 'string', 'max:120'],
            'unit_name' => ['nullable', 'string', 'max:120'],
            'interview_date_from' => ['nullable', 'date'],
            'interview_date_to' => ['nullable', 'date', 'after_or_equal:interview_date_from'],
        ]);

        $tab = Str::of((string) ($validated['tab'] ?? 'pendentes'))->lower()->value();
        $includeId = max((int) ($validated['include_id'] ?? 0), 0);

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
                'interview_date',
                'interview_time',
                'discard_reason',
                'treatment_notes',
                'treated_at',
                'treated_by',
                'confirmed_interview_date',
                'confirmed_interview_time',
                'confirmation_notes',
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

        if (! empty($validated['search'])) {
            $search = trim((string) $validated['search']);

            if ($search !== '') {
                $query->where('full_name', 'like', "%{$search}%");
            }
        }

        if (! empty($validated['role_name'])) {
            $roleName = trim((string) $validated['role_name']);

            if ($roleName !== '') {
                $query->where('role_name', $roleName);
            }
        }

        if (! empty($validated['unit_name'])) {
            $unitName = trim((string) $validated['unit_name']);

            if ($unitName !== '') {
                $query->where('unit_name', $unitName);
            }
        }

        if (! empty($validated['interview_date_from'])) {
            $query->whereDate('interview_date', '>=', (string) $validated['interview_date_from']);
        }

        if (! empty($validated['interview_date_to'])) {
            $query->whereDate('interview_date', '<=', (string) $validated['interview_date_to']);
        }

        if ($tab === 'pendentes') {
            $query->where(function (Builder $builder) use ($includeId): void {
                $builder->where('status', InterviewCurriculumStatus::Pendente->value);

                if ($includeId > 0) {
                    $builder->orWhere('id', $includeId);
                }
            });
        } elseif ($tab === 'convocados') {
            $query->whereIn('status', [
                InterviewCurriculumStatus::ConvocadoEntrevista->value,
                InterviewCurriculumStatus::AguardandoEntrevista->value,
                InterviewCurriculumStatus::AprovadoEntrevista->value,
            ]);
        } elseif ($tab === 'descartados') {
            $query->whereIn('status', [
                InterviewCurriculumStatus::Descartado->value,
                InterviewCurriculumStatus::Recusado->value,
                InterviewCurriculumStatus::ReprovadoEntrevista->value,
            ]);
        } elseif ($tab === 'passados') {
            $query->where('status', '!=', InterviewCurriculumStatus::Pendente->value);
        }

        return InterviewCurriculumResource::collection(
            $query->paginate($perPage)->withQueryString(),
        );
    }

    public function candidateList(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()->hasPermission('curriculums.list'),
            403,
            'Você não possui permissão para listar currículos.'
        );

        $validated = $request->validate([
            'role_name' => ['nullable', 'string', 'max:120'],
            'unit_name' => ['nullable', 'string', 'max:120'],
            'interview_date' => ['nullable', 'date'],
        ]);

        $query = InterviewCurriculum::query()
            ->select([
                'id',
                'full_name',
                'phone',
                'role_name',
                'unit_name',
                'status',
                'interview_date',
                'interview_time',
                'confirmed_interview_date',
                'confirmed_interview_time',
                'confirmation_notes',
                'treatment_notes',
                'observacao',
                'updated_at',
            ])
            ->whereIn('status', [
                InterviewCurriculumStatus::ConvocadoEntrevista->value,
                InterviewCurriculumStatus::AguardandoEntrevista->value,
                InterviewCurriculumStatus::AprovadoEntrevista->value,
            ])
            ->whereNotNull('interview_date')
            ->orderBy('interview_date')
            ->orderBy('interview_time')
            ->orderBy('full_name');

        if (! $request->user()->hasPermission('visibility.interviews.other-authors')) {
            $query->where('author_id', $request->user()->id);
        }

        if (! empty($validated['role_name'])) {
            $query->where('role_name', trim((string) $validated['role_name']));
        }

        if (! empty($validated['unit_name'])) {
            $query->where('unit_name', trim((string) $validated['unit_name']));
        }

        if (! empty($validated['interview_date'])) {
            $query->whereDate('interview_date', (string) $validated['interview_date']);
        }

        $rows = $query->get();

        $groups = $rows
            ->groupBy(fn (InterviewCurriculum $item): string => (string) $item->interview_date?->toDateString())
            ->map(function ($items, string $date): array {
                return [
                    'interview_date' => $date,
                    'total' => $items->count(),
                    'items' => $items->map(fn (InterviewCurriculum $item): array => [
                        'id' => (int) $item->id,
                        'full_name' => (string) $item->full_name,
                        'phone' => $item->phone,
                        'role_name' => $item->role_name,
                        'unit_name' => $item->unit_name,
                        'status' => $item->status?->value,
                        'interview_date' => $item->interview_date?->toDateString(),
                        'interview_time' => $item->interview_time,
                        'confirmed_interview_date' => $item->confirmed_interview_date?->toDateString(),
                        'confirmed_interview_time' => $item->confirmed_interview_time,
                        'confirmation_notes' => $item->confirmation_notes,
                        'treatment_notes' => $item->treatment_notes,
                        'observacao' => $item->observacao,
                        'updated_at' => $item->updated_at?->toISOString(),
                    ])->values()->all(),
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'filters' => [
                'role_name' => $validated['role_name'] ?? null,
                'unit_name' => $validated['unit_name'] ?? null,
                'interview_date' => $validated['interview_date'] ?? null,
            ],
            'total_candidates' => $rows->count(),
            'groups' => $groups,
        ]);
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
            'status' => array_key_exists('status', $validated)
                ? trim((string) $validated['status'])
                : $interviewCurriculum->status?->value,
            'interview_date' => array_key_exists('interview_date', $validated)
                ? ($validated['interview_date'] ?: null)
                : $interviewCurriculum->interview_date,
            'interview_time' => array_key_exists('interview_time', $validated)
                ? ($validated['interview_time'] !== null ? trim((string) $validated['interview_time']) : null)
                : $interviewCurriculum->interview_time,
            'discard_reason' => array_key_exists('discard_reason', $validated)
                ? ($validated['discard_reason'] !== null ? trim((string) $validated['discard_reason']) : null)
                : $interviewCurriculum->discard_reason,
            'treatment_notes' => array_key_exists('treatment_notes', $validated)
                ? ($validated['treatment_notes'] !== null ? trim((string) $validated['treatment_notes']) : null)
                : $interviewCurriculum->treatment_notes,
            'confirmed_interview_date' => array_key_exists('confirmed_interview_date', $validated)
                ? ($validated['confirmed_interview_date'] ?: null)
                : $interviewCurriculum->confirmed_interview_date,
            'confirmed_interview_time' => array_key_exists('confirmed_interview_time', $validated)
                ? ($validated['confirmed_interview_time'] !== null ? trim((string) $validated['confirmed_interview_time']) : null)
                : $interviewCurriculum->confirmed_interview_time,
            'confirmation_notes' => array_key_exists('confirmation_notes', $validated)
                ? ($validated['confirmation_notes'] !== null ? trim((string) $validated['confirmation_notes']) : null)
                : $interviewCurriculum->confirmation_notes,
            'treated_by' => $request->user()->id,
            'treated_at' => now(),
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
