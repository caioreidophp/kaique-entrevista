<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Colaborador;
use App\Models\DriverInterview;
use App\Models\FeriasLancamento;
use App\Models\FreightCanceledLoad;
use App\Models\Multa;
use App\Models\Onboarding;
use App\Models\OperationalTask;
use App\Models\Pagamento;
use App\Models\ProgramacaoViagem;
use App\Models\RecordComment;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecordCommentController extends Controller
{
    /**
     * @var array<int, string>
     */
    private const MODULE_KEYS = [
        'interviews',
        'onboarding',
        'payroll',
        'vacations',
        'freight',
        'fines',
        'programming',
        'registry',
        'operations',
    ];

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'module_key' => ['required', 'string', 'in:'.implode(',', self::MODULE_KEYS)],
            'record_id' => ['required', 'integer', 'min:1'],
            'limit' => ['nullable', 'integer', 'min:5', 'max:120'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $moduleKey = (string) $validated['module_key'];
        $recordId = (int) $validated['record_id'];
        $limit = (int) ($validated['limit'] ?? 60);

        abort_unless($this->canAccessRecord($user, $moduleKey, $recordId), 403);

        $comments = RecordComment::query()
            ->where('module_key', $moduleKey)
            ->where('record_id', $recordId)
            ->with('author:id,name,email')
            ->latest('id')
            ->limit($limit)
            ->get();

        return response()->json([
            'data' => $comments
                ->map(fn (RecordComment $comment): array => $this->toPayload($comment))
                ->values()
                ->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'module_key' => ['required', 'string', 'in:'.implode(',', self::MODULE_KEYS)],
            'record_id' => ['required', 'integer', 'min:1'],
            'body' => ['required', 'string', 'min:2', 'max:2000'],
            'mentioned_user_ids' => ['nullable', 'array', 'max:20'],
            'mentioned_user_ids.*' => ['integer', 'exists:users,id'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $moduleKey = (string) $validated['module_key'];
        $recordId = (int) $validated['record_id'];
        $body = trim((string) $validated['body']);

        abort_unless($this->canAccessRecord($user, $moduleKey, $recordId), 403);

        $manualMentionIds = collect((array) ($validated['mentioned_user_ids'] ?? []))
            ->map(fn ($id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->values()
            ->all();
        $autoMentionIds = $this->resolveMentionsFromText($body);
        $mentionedIds = array_values(array_unique(array_merge($manualMentionIds, $autoMentionIds)));

        $comment = RecordComment::query()->create([
            'module_key' => $moduleKey,
            'record_id' => $recordId,
            'body' => $body,
            'mentioned_user_ids' => $mentionedIds,
            'created_by' => (int) $user->id,
        ]);

        return response()->json([
            'message' => 'Comentario salvo com sucesso.',
            'data' => $this->toPayload(
                $comment->load('author:id,name,email'),
            ),
        ], 201);
    }

    public function destroy(Request $request, RecordComment $recordComment): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless(
            $this->canAccessRecord(
                $user,
                (string) $recordComment->module_key,
                (int) $recordComment->record_id,
            ),
            403,
        );

        $isOwner = (int) $recordComment->created_by === (int) $user->id;
        $canDeleteAny = $user->isMasterAdmin() || $user->hasPermission('activity-log.view');
        abort_unless($isOwner || $canDeleteAny, 403);

        $recordComment->delete();

        return response()->json([], 204);
    }

    /**
     * @return array<int, int>
     */
    private function resolveMentionsFromText(string $body): array
    {
        preg_match_all('/@([a-zA-Z0-9._-]{2,120})/', $body, $matches);
        $tokens = collect((array) ($matches[1] ?? []))
            ->map(fn ($token): string => mb_strtolower(trim((string) $token)))
            ->filter()
            ->unique()
            ->values();

        if ($tokens->isEmpty()) {
            return [];
        }

        $query = User::query()
            ->select(['id', 'name', 'email'])
            ->where(function (Builder $builder) use ($tokens): void {
                foreach ($tokens as $token) {
                    $builder
                        ->orWhereRaw('LOWER(email) = ?', [$token])
                        ->orWhereRaw('LOWER(email) LIKE ?', [$token.'@%'])
                        ->orWhereRaw('LOWER(name) = ?', [$token]);
                    $builder->orWhereRaw("REPLACE(LOWER(name), ' ', '.') = ?", [$token]);
                }
            })
            ->limit(20)
            ->get();

        return $query
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function toPayload(RecordComment $comment): array
    {
        $mentionedIds = collect((array) ($comment->mentioned_user_ids ?? []))
            ->map(fn ($id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->values()
            ->all();

        $mentionedUsers = $mentionedIds === []
            ? []
            : User::query()
                ->whereIn('id', $mentionedIds)
                ->get(['id', 'name', 'email'])
                ->map(fn (User $user): array => [
                    'id' => (int) $user->id,
                    'name' => (string) $user->name,
                    'email' => (string) $user->email,
                ])
                ->values()
                ->all();

        return [
            'id' => (int) $comment->id,
            'module_key' => (string) $comment->module_key,
            'record_id' => (int) $comment->record_id,
            'body' => (string) $comment->body,
            'mentioned_user_ids' => $mentionedIds,
            'mentioned_users' => $mentionedUsers,
            'created_at' => $comment->created_at?->toISOString(),
            'updated_at' => $comment->updated_at?->toISOString(),
            'author' => $comment->author
                ? [
                    'id' => (int) $comment->author->id,
                    'name' => (string) $comment->author->name,
                    'email' => (string) $comment->author->email,
                ]
                : null,
        ];
    }

    private function canAccessRecord(User $user, string $moduleKey, int $recordId): bool
    {
        return match ($moduleKey) {
            'interviews' => $this->canAccessInterview($user, $recordId),
            'onboarding' => $this->canAccessOnboarding($user, $recordId),
            'payroll' => $this->canAccessPayroll($user, $recordId),
            'vacations' => $this->canAccessVacation($user, $recordId),
            'freight' => $this->canAccessFreight($user, $recordId),
            'fines' => $this->canAccessFine($user, $recordId),
            'programming' => $this->canAccessProgramming($user, $recordId),
            'registry' => $this->canAccessRegistry($user, $recordId),
            'operations' => $this->canAccessOperationalTask($user, $recordId),
            default => false,
        };
    }

    private function canAccessInterview(User $user, int $recordId): bool
    {
        if (! $user->hasPermission('interviews.list') && ! $user->hasPermission('sidebar.interviews.view')) {
            return false;
        }

        $query = DriverInterview::query()->whereKey($recordId);

        if (! $user->isMasterAdmin() && ! $user->hasPermission('visibility.interviews.other-authors')) {
            $query->where('author_id', (int) $user->id);
        }

        return $query->exists();
    }

    private function canAccessOnboarding(User $user, int $recordId): bool
    {
        if (! $user->hasPermission('onboarding.list') && ! $user->hasPermission('sidebar.onboarding.view')) {
            return false;
        }

        $query = Onboarding::query()->whereKey($recordId)->whereHas('interview');

        if (! $user->isMasterAdmin()) {
            $query->where(function (Builder $builder) use ($user): void {
                $builder
                    ->where('responsavel_user_id', (int) $user->id)
                    ->orWhereHas('interview', function (Builder $interviewQuery) use ($user): void {
                        $interviewQuery->where('author_id', (int) $user->id);
                    });
            });
        }

        return $query->exists();
    }

    private function canAccessPayroll(User $user, int $recordId): bool
    {
        if (! $user->hasPermission('payroll.dashboard.view') && ! $user->hasPermission('sidebar.payroll.list.view')) {
            return false;
        }

        $query = Pagamento::query()->whereKey($recordId);

        if (! $user->isMasterAdmin() && ! $user->hasPermission('visibility.payroll.other-authors')) {
            $query->where('autor_id', (int) $user->id);
        }

        $query = $this->applyUnitVisibility($query, $user, 'payroll');

        return $query->exists();
    }

    private function canAccessVacation(User $user, int $recordId): bool
    {
        if (! $user->hasPermission('vacations.dashboard.view') && ! $user->hasPermission('sidebar.vacations.list.view')) {
            return false;
        }

        $query = FeriasLancamento::query()->whereKey($recordId);

        if (! $user->isMasterAdmin()) {
            $query->where('autor_id', (int) $user->id);
        }

        $query = $this->applyUnitVisibility($query, $user, 'vacations');

        return $query->exists();
    }

    private function canAccessFreight(User $user, int $recordId): bool
    {
        if (
            ! $user->hasPermission('freight.dashboard.view')
            && ! $user->hasPermission('freight.analytics.view')
            && ! $user->hasPermission('sidebar.freight.canceled-loads.view')
        ) {
            return false;
        }

        $query = FreightCanceledLoad::query()->whereKey($recordId);

        if (! $user->isMasterAdmin() && ! $user->hasPermission('visibility.freight.other-authors')) {
            $query->where('autor_id', (int) $user->id);
        }

        $query = $this->applyUnitVisibility($query, $user, 'freight');

        return $query->exists();
    }

    private function canAccessFine(User $user, int $recordId): bool
    {
        if (! $user->hasPermission('fines.list.view') && ! $user->hasPermission('sidebar.fines.list.view')) {
            return false;
        }

        $query = Multa::query()->whereKey($recordId);

        if (! $user->isMasterAdmin()) {
            $query->where('autor_id', (int) $user->id);
        }

        $query = $this->applyUnitVisibility($query, $user, 'fines');

        return $query->exists();
    }

    private function canAccessProgramming(User $user, int $recordId): bool
    {
        if (! $user->hasPermission('programming.dashboard.view') && ! $user->hasPermission('sidebar.programming.dashboard.view')) {
            return false;
        }

        $query = ProgramacaoViagem::query()->whereKey($recordId);

        if (! $user->isMasterAdmin()) {
            $query->where('autor_id', (int) $user->id);
        }

        $query = $this->applyUnitVisibility($query, $user, 'programming');

        return $query->exists();
    }

    private function canAccessRegistry(User $user, int $recordId): bool
    {
        if (! $user->hasPermission('registry.collaborators.list') && ! $user->hasPermission('sidebar.registry.collaborators.view')) {
            return false;
        }

        $query = Colaborador::query()->whereKey($recordId);
        $query = $this->applyUnitVisibility($query, $user, 'registry');

        return $query->exists();
    }

    private function canAccessOperationalTask(User $user, int $recordId): bool
    {
        if (! $user->hasPermission('operations.tasks.view')) {
            return false;
        }

        $query = OperationalTask::query()->whereKey($recordId);

        if (! $user->isMasterAdmin()) {
            $scope = $user->dataScopeFor('operations');

            if ($scope === 'units') {
                $allowed = $user->allowedUnitIdsFor('operations');
                if ($allowed === []) {
                    return false;
                }
                $query->whereIn('unidade_id', $allowed);
            }

            if ($scope === 'own') {
                $query->where(function (Builder $builder) use ($user): void {
                    $builder
                        ->where('created_by', (int) $user->id)
                        ->orWhere('assigned_to', (int) $user->id);
                });
            }
        }

        return $query->exists();
    }

    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    private function applyUnitVisibility(Builder $query, User $user, string $moduleKey): Builder
    {
        if ($user->isMasterAdmin()) {
            return $query;
        }

        if ($user->dataScopeFor($moduleKey) !== 'units') {
            return $query;
        }

        $allowed = $user->allowedUnitIdsFor($moduleKey);
        if ($allowed === []) {
            $query->whereRaw('1 = 0');

            return $query;
        }

        return $query->whereIn('unidade_id', $allowed);
    }
}
