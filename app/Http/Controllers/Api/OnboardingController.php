<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssignOnboardingResponsibleRequest;
use App\Http\Requests\CompleteOnboardingRequest;
use App\Http\Requests\UpdateOnboardingItemRequest;
use App\Http\Requests\UploadOnboardingItemAttachmentRequest;
use App\Http\Resources\OnboardingItemAttachmentResource;
use App\Http\Resources\OnboardingItemResource;
use App\Http\Resources\OnboardingResource;
use App\Models\Onboarding;
use App\Models\OnboardingItem;
use App\Models\OnboardingItemAttachment;
use App\Support\OnboardingService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OnboardingController extends Controller
{
    public function __construct(
        private readonly OnboardingService $service,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Onboarding::class);

        $perPage = min(max((int) $request->integer('per_page', 15), 1), 100);

        $query = $this->visibleQuery($request)
            ->with([
                'interview:id,full_name,author_id',
                'colaborador:id,nome,unidade_id',
                'colaborador.unidade:id,nome',
                'responsavel:id,name',
                'items:id,onboarding_id,required,status,due_date',
            ])
            ->latest('id');

        $this->applyFilters($query, $request);

        return OnboardingResource::collection(
            $query->paginate($perPage)->withQueryString(),
        );
    }

    public function summary(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Onboarding::class);

        $query = $this->visibleQuery($request);
        $this->applyFilters($query, $request, true);

        $today = now()->toDateString();
        $soonDate = now()->addDays(3)->toDateString();

        $overdueCount = (clone $query)
            ->whereHas('items', function (Builder $builder) use ($today): void {
                $builder
                    ->where('required', true)
                    ->where('status', '!=', 'aprovado')
                    ->whereDate('due_date', '<', $today);
            })
            ->count();

        $dueTodayCount = (clone $query)
            ->whereHas('items', function (Builder $builder) use ($today): void {
                $builder
                    ->where('required', true)
                    ->where('status', '!=', 'aprovado')
                    ->whereDate('due_date', '=', $today);
            })
            ->count();

        $dueSoonCount = (clone $query)
            ->whereHas('items', function (Builder $builder) use ($today, $soonDate): void {
                $builder
                    ->where('required', true)
                    ->where('status', '!=', 'aprovado')
                    ->whereDate('due_date', '>=', $today)
                    ->whereDate('due_date', '<=', $soonDate);
            })
            ->count();

        return response()->json([
            'total' => (clone $query)->count(),
            'em_andamento' => (clone $query)->where('status', 'em_andamento')->count(),
            'bloqueado' => (clone $query)->where('status', 'bloqueado')->count(),
            'concluido' => (clone $query)->where('status', 'concluido')->count(),
            'atrasados' => $overdueCount,
            'vencem_hoje' => $dueTodayCount,
            'vencem_3_dias' => $dueSoonCount,
        ]);
    }

    public function show(Onboarding $onboarding): OnboardingResource
    {
        $this->authorize('view', $onboarding);

        $this->service->syncTemplateItems($onboarding);

        return new OnboardingResource($onboarding->load([
            'interview:id,full_name,author_id',
            'colaborador:id,nome,unidade_id',
            'colaborador.unidade:id,nome',
            'responsavel:id,name',
            'items.approver:id,name',
            'items.attachments.uploader:id,name',
            'events.user:id,name',
        ]));
    }

    public function assign(AssignOnboardingResponsibleRequest $request, Onboarding $onboarding): OnboardingResource
    {
        $this->authorize('update', $onboarding);

        $updated = $this->service->assignResponsible(
            $onboarding,
            (int) $request->validated('responsavel_user_id'),
            $request->user(),
        );

        return new OnboardingResource($updated->load([
            'interview:id,full_name,author_id',
            'colaborador:id,nome,unidade_id',
            'colaborador.unidade:id,nome',
            'responsavel:id,name',
            'items.approver:id,name',
            'items.attachments.uploader:id,name',
            'events.user:id,name',
        ]));
    }

    public function updateItem(UpdateOnboardingItemRequest $request, OnboardingItem $onboardingItem): JsonResponse
    {
        $onboarding = $onboardingItem->onboarding()->with('interview')->firstOrFail();
        $this->authorize('update', $onboarding);

        $updated = $this->service->updateItem(
            $onboardingItem,
            $request->validated(),
            $request->user(),
        );

        return response()->json([
            'data' => new OnboardingItemResource($updated->load([
                'approver:id,name',
                'attachments.uploader:id,name',
            ])),
        ]);
    }

    public function uploadAttachment(
        UploadOnboardingItemAttachmentRequest $request,
        OnboardingItem $onboardingItem,
    ): JsonResponse {
        $onboarding = $onboardingItem->onboarding()->with('interview')->firstOrFail();
        $this->authorize('update', $onboarding);

        $file = $request->file('file');
        $path = $file->store("onboarding/{$onboarding->id}/{$onboardingItem->id}", 'local');
        $originalName = trim((string) $file->getClientOriginalName());
        $originalName = Str::limit(basename($originalName), 180, '');

        if ($originalName === '') {
            $originalName = 'anexo';
        }

        $attachment = OnboardingItemAttachment::query()->create([
            'onboarding_item_id' => $onboardingItem->id,
            'path' => $path,
            'original_name' => $originalName,
            'mime' => $file->getMimeType() ?? 'application/octet-stream',
            'size' => $file->getSize() ?: 0,
            'uploaded_by' => $request->user()->id,
        ]);

        if ($onboardingItem->status === 'pendente') {
            $this->service->updateItem(
                $onboardingItem,
                ['status' => 'em_analise'],
                $request->user(),
            );
        }

        $this->service->logEvent(
            $onboarding,
            'attachment_uploaded',
            null,
            null,
            [
                'item_id' => $onboardingItem->id,
                'attachment_id' => $attachment->id,
                'original_name' => $attachment->original_name,
            ],
            $request->user(),
            $onboardingItem,
        );

        return response()->json([
            'data' => new OnboardingItemAttachmentResource($attachment->load('uploader:id,name')),
        ], 201);
    }

    public function downloadAttachment(OnboardingItemAttachment $onboardingItemAttachment): StreamedResponse
    {
        $onboarding = $onboardingItemAttachment->item()
            ->with('onboarding.interview')
            ->firstOrFail()
            ->onboarding;

        $this->authorize('view', $onboarding);

        abort_unless(Storage::disk('local')->exists($onboardingItemAttachment->path), 404, 'Arquivo não encontrado.');

        $response = Storage::disk('local')->download(
            $onboardingItemAttachment->path,
            $onboardingItemAttachment->original_name,
            [
                'Content-Type' => $onboardingItemAttachment->mime,
                'X-Content-Type-Options' => 'nosniff',
            ],
        );

        $response->headers->set('X-Frame-Options', 'DENY');

        return $response;
    }

    public function complete(CompleteOnboardingRequest $request, Onboarding $onboarding): OnboardingResource
    {
        $this->authorize('update', $onboarding);

        $completed = $this->service->complete($onboarding->load('items'), $request->user());

        return new OnboardingResource($completed->load([
            'interview:id,full_name,author_id',
            'colaborador:id,nome,unidade_id',
            'colaborador.unidade:id,nome',
            'responsavel:id,name',
            'items.approver:id,name',
            'items.attachments.uploader:id,name',
            'events.user:id,name',
        ]));
    }

    private function visibleQuery(Request $request): Builder
    {
        $query = Onboarding::query()
            ->whereHas('interview');

        if (! $request->user()->isMasterAdmin()) {
            $query->where(function (Builder $builder) use ($request): void {
                $builder
                    ->where('responsavel_user_id', $request->user()->id)
                    ->orWhereHas('interview', function (Builder $interviewQuery) use ($request): void {
                        $interviewQuery->where('author_id', $request->user()->id);
                    });
            });
        }

        return $query;
    }

    private function applyFilters(Builder $query, Request $request, bool $ignoreStatus = false): void
    {
        if (! $ignoreStatus && $request->filled('status')) {
            $query->where('status', (string) $request->string('status'));
        }

        if ($request->filled('responsavel_user_id')) {
            $query->where('responsavel_user_id', (int) $request->integer('responsavel_user_id'));
        }

        if ($request->filled('unidade_id')) {
            $unidadeId = (int) $request->integer('unidade_id');
            $query->whereHas('colaborador', function (Builder $builder) use ($unidadeId): void {
                $builder->where('unidade_id', $unidadeId);
            });
        }

        if ($request->filled('search')) {
            $search = (string) $request->string('search');
            $query->where(function (Builder $builder) use ($search): void {
                $builder
                    ->whereHas('interview', function (Builder $interviewQuery) use ($search): void {
                        $interviewQuery->where('full_name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('colaborador', function (Builder $colaboradorQuery) use ($search): void {
                        $colaboradorQuery->where('nome', 'like', "%{$search}%");
                    });
            });
        }

        if ($request->boolean('atrasado')) {
            $today = now()->toDateString();

            $query->whereHas('items', function (Builder $builder) use ($today): void {
                $builder
                    ->where('required', true)
                    ->where('status', '!=', 'aprovado')
                    ->whereDate('due_date', '<', $today);
            });
        }

        if ($request->filled('due_soon_days')) {
            $days = max(1, min((int) $request->integer('due_soon_days', 3), 30));
            $today = now()->toDateString();
            $lastDate = now()->addDays($days)->toDateString();

            $query->whereHas('items', function (Builder $builder) use ($today, $lastDate): void {
                $builder
                    ->where('required', true)
                    ->where('status', '!=', 'aprovado')
                    ->whereDate('due_date', '>=', $today)
                    ->whereDate('due_date', '<=', $lastDate);
            });
        }
    }
}
