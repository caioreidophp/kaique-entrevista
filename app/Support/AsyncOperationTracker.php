<?php

namespace App\Support;

use App\Models\AsyncOperation;
use App\Models\AsyncExport;

class AsyncOperationTracker
{
    /**
     * @param  array<string, mixed>  $attributes
     */
    public static function create(array $attributes): AsyncOperation
    {
        return AsyncOperation::query()->create([
            'user_id' => $attributes['user_id'] ?? null,
            'category' => (string) ($attributes['category'] ?? 'job'),
            'type' => (string) ($attributes['type'] ?? 'generic'),
            'status' => (string) ($attributes['status'] ?? 'queued'),
            'progress_percent' => (int) ($attributes['progress_percent'] ?? 0),
            'queue' => $attributes['queue'] ?? null,
            'summary' => $attributes['summary'] ?? null,
            'reference_type' => $attributes['reference_type'] ?? null,
            'reference_id' => $attributes['reference_id'] ?? null,
            'context' => is_array($attributes['context'] ?? null) ? $attributes['context'] : null,
            'error_message' => $attributes['error_message'] ?? null,
            'started_at' => $attributes['started_at'] ?? null,
            'completed_at' => $attributes['completed_at'] ?? null,
        ]);
    }

    public static function ensureForExport(AsyncExport $export, ?string $summary = null): AsyncOperation
    {
        $operation = AsyncOperation::query()
            ->where('reference_type', AsyncExport::class)
            ->where('reference_id', (string) $export->id)
            ->first();

        if ($operation) {
            return $operation;
        }

        return self::create([
            'user_id' => $export->user_id,
            'category' => 'export',
            'type' => (string) $export->type,
            'status' => (string) $export->status,
            'queue' => 'default',
            'summary' => $summary ?? 'Exportação assíncrona enfileirada',
            'reference_type' => AsyncExport::class,
            'reference_id' => (string) $export->id,
            'context' => [
                'filters' => $export->filters ?? [],
            ],
        ]);
    }

    public static function markProcessing(string $operationId, ?array $context = null): void
    {
        AsyncOperation::query()
            ->whereKey($operationId)
            ->update([
                'status' => 'processing',
                'progress_percent' => 15,
                'started_at' => now(),
                'context' => $context,
            ]);
    }

    public static function markCompleted(string $operationId, ?array $context = null): void
    {
        AsyncOperation::query()
            ->whereKey($operationId)
            ->update([
                'status' => 'completed',
                'progress_percent' => 100,
                'completed_at' => now(),
                'context' => $context,
            ]);
    }

    public static function markFailed(string $operationId, string $message, ?array $context = null): void
    {
        AsyncOperation::query()
            ->whereKey($operationId)
            ->update([
                'status' => 'failed',
                'progress_percent' => 100,
                'completed_at' => now(),
                'error_message' => mb_substr($message, 0, 2000),
                'context' => $context,
            ]);
    }
}
