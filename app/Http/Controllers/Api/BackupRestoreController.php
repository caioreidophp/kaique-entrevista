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
use Throwable;
use ZipArchive;

class BackupRestoreController extends Controller
{
    private const MAX_SQL_BYTES = 200 * 1024 * 1024; // 200 MB

    /**
     * @var array<int, string>
     */
    private const FORBIDDEN_SQL_PATTERNS = [
        '/\bGRANT\b/i',
        '/\bREVOKE\b/i',
        '/\bCREATE\s+USER\b/i',
        '/\bALTER\s+USER\b/i',
        '/\bDROP\s+USER\b/i',
        '/\bDROP\s+DATABASE\b/i',
        '/\bCREATE\s+DATABASE\b/i',
        '/\bUSE\s+[a-z0-9_`]+/i',
        '/\bSET\s+GLOBAL\b/i',
        '/\bLOAD\s+DATA\b/i',
        '/\bINTO\s+OUTFILE\b/i',
        '/\bINTO\s+DUMPFILE\b/i',
    ];

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
        $sqlHash = null;
        $forbiddenCommands = [];

        if ($hasSql) {
            $sqlContent = (string) File::get($sqlPath);
            $statementCount = substr_count($sqlContent, ';');
            $sqlBytes = strlen($sqlContent);
            $sqlHash = hash('sha256', $sqlContent);
            $forbiddenCommands = $this->detectForbiddenSqlCommands($sqlContent);
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
            'sql_hash' => $sqlHash,
            'forbidden_sql_commands' => $forbiddenCommands,
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
                'sql_sha256' => $sqlHash,
                'forbidden_sql_commands' => $forbiddenCommands,
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
            'sql_sha256' => ['nullable', 'string', 'size:64'],
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

        $forbiddenCommands = $metadata['forbidden_sql_commands'] ?? [];
        if (is_array($forbiddenCommands) && $forbiddenCommands !== []) {
            return response()->json([
                'message' => 'Backup bloqueado por comandos SQL proibidos na restauração.',
                'forbidden_sql_commands' => array_values($forbiddenCommands),
            ], 422);
        }

        $sqlPath = (string) $metadata['sql_path'];
        $sqlBytes = (int) File::size($sqlPath);

        if ($sqlBytes <= 0 || $sqlBytes > self::MAX_SQL_BYTES) {
            return response()->json([
                'message' => 'Tamanho do SQL fora do limite permitido para restauração segura.',
                'sql_size_bytes' => $sqlBytes,
                'max_sql_size_bytes' => self::MAX_SQL_BYTES,
            ], 422);
        }

        $sql = (string) File::get($sqlPath);
        $computedSqlHash = hash('sha256', $sql);
        $cachedSqlHash = (string) ($metadata['sql_hash'] ?? '');
        $providedSqlHash = (string) ($validated['sql_sha256'] ?? '');

        if ($cachedSqlHash !== '' && ! hash_equals($cachedSqlHash, $computedSqlHash)) {
            return response()->json([
                'message' => 'Integridade do SQL inválida: hash da prévia não confere.',
            ], 422);
        }

        if ($providedSqlHash !== '' && ! hash_equals($providedSqlHash, $computedSqlHash)) {
            return response()->json([
                'message' => 'Integridade do SQL inválida: hash informado não confere.',
            ], 422);
        }

        $runtimeForbiddenCommands = $this->detectForbiddenSqlCommands($sql);
        if ($runtimeForbiddenCommands !== []) {
            return response()->json([
                'message' => 'Backup bloqueado por comandos SQL proibidos.',
                'forbidden_sql_commands' => $runtimeForbiddenCommands,
            ], 422);
        }

        $restoreLock = Cache::lock('backup:restore:running', 900);

        if (! $restoreLock->get()) {
            return response()->json([
                'message' => 'Já existe uma restauração em execução. Tente novamente em instantes.',
            ], 423);
        }

        try {
            // Execute SQL safely by splitting into statements and running each one
            $driver = DB::connection()->getDriverName();

            DB::beginTransaction();
            try {
                if ($driver !== 'sqlite') {
                    DB::statement('SET FOREIGN_KEY_CHECKS=0');
                }

                $statements = preg_split('/;(?=\s*(?:\r\n|\n|$))/m', $sql);

                foreach ($statements as $statement) {
                    $stmt = trim((string) $statement);

                    if ($stmt === '') {
                        continue;
                    }

                    DB::statement($stmt);
                }

                if ($driver !== 'sqlite') {
                    DB::statement('SET FOREIGN_KEY_CHECKS=1');
                }

                DB::commit();
            } catch (Throwable $e) {
                DB::rollBack();
                throw $e;
            }

            if ($validated['mode'] === 'database_and_storage' && ($metadata['has_storage'] ?? false)) {
                $sourceStoragePath = (string) ($metadata['storage_path'] ?? '');
                $this->restoreStorageSnapshot($sourceStoragePath);
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
                'sql_size_bytes' => $sqlBytes,
                'sql_sha256' => $computedSqlHash,
            ]);

            return response()->json([
                'message' => 'Restauração executada com sucesso.',
                'mode' => $validated['mode'],
            ]);
        } catch (Throwable $exception) {
            Log::error('Backup restore failed', [
                'user_id' => (int) ($request->user()?->id ?? 0),
                'restore_token' => (string) $validated['restore_token'],
                'mode' => $validated['mode'],
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
            ]);

            return response()->json([
                'message' => 'Falha ao executar restauração. Verifique logs e tente novamente.',
            ], 500);
        } finally {
            try {
                $restoreLock->release();
            } catch (Throwable) {
                // no-op
            }
        }
    }

    /**
     * @return array<int, string>
     */
    private function detectForbiddenSqlCommands(string $sql): array
    {
        $matches = [];

        foreach (self::FORBIDDEN_SQL_PATTERNS as $pattern) {
            if (preg_match($pattern, $sql) === 1) {
                $matches[] = $pattern;
            }
        }

        return $matches;
    }

    private function restoreStorageSnapshot(string $sourceStoragePath): void
    {
        if (! File::isDirectory($sourceStoragePath)) {
            return;
        }

        $allowedSubdirectories = ['app', 'framework', 'logs'];

        foreach ($allowedSubdirectories as $subdirectory) {
            $source = $sourceStoragePath.DIRECTORY_SEPARATOR.$subdirectory;
            $target = storage_path($subdirectory);

            if (! File::isDirectory($source)) {
                continue;
            }

            File::ensureDirectoryExists($target);
            File::copyDirectory($source, $target);
        }
    }
}

