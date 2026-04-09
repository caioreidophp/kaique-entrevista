<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SecurityIncident;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SecurityIncidentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $validated = $request->validate([
            'severity' => ['nullable', 'in:info,warning,critical'],
            'status' => ['nullable', 'in:pending,acknowledged'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        $query = SecurityIncident::query()
            ->with('acknowledgedBy:id,name,email')
            ->orderByDesc('occurred_at')
            ->orderByDesc('id');

        if (isset($validated['severity'])) {
            $query->where('severity', (string) $validated['severity']);
        }

        if (($validated['status'] ?? null) === 'pending') {
            $query->whereNull('acknowledged_at');
        }

        if (($validated['status'] ?? null) === 'acknowledged') {
            $query->whereNotNull('acknowledged_at');
        }

        $limit = (int) ($validated['limit'] ?? 120);

        return response()->json([
            'data' => $query->limit($limit)->get(),
        ]);
    }

    public function acknowledge(Request $request, SecurityIncident $securityIncident): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $securityIncident->update([
            'acknowledged_at' => now(),
            'acknowledged_by' => (int) $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Incidente marcado como reconhecido.',
            'data' => $securityIncident->refresh()->load('acknowledgedBy:id,name,email'),
        ]);
    }
}
