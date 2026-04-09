<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use ZipArchive;

class BackupRestoreController extends Controller
{
    public function preview(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        if (! (bool) config('transport_features.backup_restore_assistant', true)) {
            abort(404);
        }

        $validated = $request->validate([
            'backup_file' => ['required', 'file', 'mimes:zip', 'max:512000'],
        ]);

        if (! class_exists(ZipArchive::class)) {
            return response()->json([
                'message' => 'Extensão ZIP do PHP não está habilitada no ambiente.',
            ], 500);
        }

        $file = $validated['backup_file'];
        $restoreToken = (string) Str::uuid();
        $baseDir = storage_path('app/private/backup-restore/'.$restoreToken);
        $zipPath = $baseDir.'/source.zip';
        $extractDir = $baseDir.'/extracted';

        File::ensureDirectoryExists($baseDir);
        File::ensureDirectoryExists($extractDir);

        $file->move($baseDir, 'source.zip');

        $zip = new ZipArchive;
        $openResult = $zip->open($zipPath);

        if ($openResult !== true) {
            return response()->json([
                'message' => 'Falha ao abrir o arquivo ZIP de backup.',
                'zip_code' => $openResult,
            ], 422);
        }

        $entries = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $entries[] = (string) $zip->getNameIndex($i);
        }

        $zip->extractTo($extractDir);
        $zip->close();

        $sqlPath = $extractDir.'/backup/database.sql';
        $envPath = $extractDir.'/backup/.env';
        $storagePath = $extractDir.'/backup/storage';

        $hasSql = File::exists($sqlPath);
        $hasEnv = File::exists($envPath);
        $hasStorage = File::isDirectory($storagePath);

        $statementCount = 0;
        $sqlBytes = 0;

        if ($hasSql) {
            $sqlContent = (string) File::get($sqlPath);
            $statementCount = substr_count($sqlContent, ';');
            $sqlBytes = strlen($sqlContent);
        }

        $expiresAt = now()->addMinutes(30);

        Cache::put('backup:restore:'.$restoreToken, [
            'base_dir' => $baseDir,
            'extract_dir' => $extractDir,
            'sql_path' => $sqlPath,
            'storage_path' => $storagePath,
            'has_sql' => $hasSql,
            'has_storage' => $hasStorage,
            'has_env' => $hasEnv,
            'expires_at' => $expiresAt->toISOString(),
        ], $expiresAt);

        return response()->json([
            'message' => 'Prévia de restauração gerada com sucesso.',
            'restore_token' => $restoreToken,
            'expires_at' => $expiresAt->toISOString(),
            'summary' => [
                'entries_count' => count($entries),
                'has_database_sql' => $hasSql,
                'has_env_file' => $hasEnv,
                'has_storage_snapshot' => $hasStorage,
                'sql_statements_estimate' => $statementCount,
                'sql_size_bytes' => $sqlBytes,
            ],
        ]);
    }

    public function restore(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isMasterAdmin(), 403);

        if (! (bool) config('transport_features.backup_restore_assistant', true)) {
            abort(404);
        }

        $validated = $request->validate([
            'restore_token' => ['required', 'string'],
            'mode' => ['required', 'in:database_only,database_and_storage'],
            'confirm_text' => ['required', 'string', 'in:RESTAURAR AGORA'],
        ]);

        $metadata = Cache::get('backup:restore:'.(string) $validated['restore_token']);

        if (! is_array($metadata)) {
            return response()->json([
                'message' => 'Token de restauração inválido ou expirado.',
            ], 422);
        }

        if (! ($metadata['has_sql'] ?? false) || ! File::exists((string) ($metadata['sql_path'] ?? ''))) {
            return response()->json([
                'message' => 'O backup não possui database.sql válido para restauração.',
            ], 422);
        }

        $sqlPath = (string) $metadata['sql_path'];
        $sql = (string) File::get($sqlPath);

        DB::connection()->unprepared($sql);

        if ($validated['mode'] === 'database_and_storage' && ($metadata['has_storage'] ?? false)) {
            $sourceStoragePath = (string) ($metadata['storage_path'] ?? '');
            $targetStoragePath = storage_path();

            if (File::isDirectory($sourceStoragePath)) {
                File::copyDirectory($sourceStoragePath, $targetStoragePath);
            }
        }

        Cache::forget('backup:restore:'.(string) $validated['restore_token']);

        $baseDir = (string) ($metadata['base_dir'] ?? '');
        if ($baseDir !== '' && File::isDirectory($baseDir)) {
            File::deleteDirectory($baseDir);
        }

        Log::warning('Backup restore executed', [
            'user_id' => (int) $request->user()->id,
            'mode' => $validated['mode'],
            'restore_token' => (string) $validated['restore_token'],
        ]);

        return response()->json([
            'message' => 'Restauração executada com sucesso.',
            'mode' => $validated['mode'],
        ]);
    }
}
