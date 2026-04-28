<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AsyncOperation;
use App\Models\AsyncExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AsyncExportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $rows = AsyncExport::query()
            ->where('user_id', (int) $request->user()->id)
            ->latest('created_at')
            ->limit(30)
            ->get(['id', 'type', 'status', 'file_name', 'error_message', 'created_at', 'completed_at']);

        $operationIdsByExportId = AsyncOperation::query()
            ->where('reference_type', AsyncExport::class)
            ->whereIn('reference_id', $rows->pluck('id')->map(fn ($id): string => (string) $id)->all())
            ->pluck('id', 'reference_id');

        return response()->json([
            'data' => $rows->map(function (AsyncExport $export) use ($operationIdsByExportId): array {
                return [
                    'id' => $export->id,
                    'type' => $export->type,
                    'status' => $export->status,
                    'file_name' => $export->file_name,
                    'error_message' => $export->error_message,
                    'created_at' => $export->created_at?->toIso8601String(),
                    'completed_at' => $export->completed_at?->toIso8601String(),
                    'operation_id' => $operationIdsByExportId->get((string) $export->id),
                ];
            })->values(),
        ]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $export = AsyncExport::query()
            ->where('id', $id)
            ->where('user_id', (int) $request->user()->id)
            ->firstOrFail();
        $operationId = AsyncOperation::query()
            ->where('reference_type', AsyncExport::class)
            ->where('reference_id', (string) $export->id)
            ->value('id');

        return response()->json([
            'data' => [
                ...$export->toArray(),
                'operation_id' => $operationId,
            ],
        ]);
    }

    public function download(Request $request, string $id): StreamedResponse
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isMasterAdmin(), 403);

        $export = AsyncExport::query()
            ->where('id', $id)
            ->where('user_id', (int) $request->user()->id)
            ->firstOrFail();

        abort_if($export->status !== 'completed' || ! $export->file_path, 422, 'Arquivo ainda não está pronto para download.');
        abort_if(! Storage::disk('local')->exists((string) $export->file_path), 404, 'Arquivo não encontrado no storage.');

        return Storage::disk('local')->download((string) $export->file_path, (string) ($export->file_name ?? 'export.xlsx'));
    }
}
