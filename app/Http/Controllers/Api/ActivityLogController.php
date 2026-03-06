<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Activitylog\Models\Activity;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        $perPage = min(max((int) $request->integer('per_page', 20), 1), 100);

        $query = Activity::query()
            ->with('causer:id,name,email')
            ->latest();

        if ($request->filled('log_name')) {
            $query->where('log_name', (string) $request->string('log_name'));
        }

        if ($request->filled('causer_id')) {
            $query->where('causer_id', (int) $request->integer('causer_id'));
        }

        if ($request->filled('event')) {
            $query->where('event', (string) $request->string('event'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', (string) $request->string('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', (string) $request->string('date_to'));
        }

        if ($request->filled('search')) {
            $search = (string) $request->string('search');
            $query->where(function ($q) use ($search): void {
                $q->where('description', 'like', "%{$search}%")
                    ->orWhereHas('causer', fn ($u) => $u->where('name', 'like', "%{$search}%"));
            });
        }

        $paginated = $query->paginate($perPage)->withQueryString();

        $items = collect($paginated->items())->map(fn (Activity $activity) => [
            'id' => $activity->id,
            'log_name' => $activity->log_name,
            'description' => $activity->description,
            'event' => $activity->event,
            'subject_type' => $activity->subject_type ? class_basename($activity->subject_type) : null,
            'subject_id' => $activity->subject_id,
            'changes' => $activity->changes,
            'causer' => $activity->causer ? [
                'id' => $activity->causer->id,
                'name' => $activity->causer->name,
                'email' => $activity->causer->email,
            ] : null,
            'created_at' => $activity->created_at?->toISOString(),
        ]);

        return response()->json([
            'data' => $items,
            'current_page' => $paginated->currentPage(),
            'last_page' => $paginated->lastPage(),
            'per_page' => $paginated->perPage(),
            'total' => $paginated->total(),
        ]);
    }
}
