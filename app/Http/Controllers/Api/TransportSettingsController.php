<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;
use ZipArchive;

class TransportSettingsController extends Controller
{
    /**
     * @throws ValidationException
     */
    public function downloadBackup(Request $request): BinaryFileResponse|JsonResponse
    {
        $actor = $request->user();
        $errorId = (string) Str::uuid();

        if (! $actor?->isMasterAdmin()) {
            return $this->backupError(
                message: 'Acesso negado para gerar backup.',
                details: ['Somente master admin pode executar esta ação.'],
                status: 403,
                errorId: $errorId,
                stage: 'auth',
            );
        }

        if (! class_exists(ZipArchive::class)) {
            return $this->backupError(
                message: 'Extensão ZIP do PHP não está habilitada.',
                details: [
                    'Ative a extensão zip no php.ini do ambiente.',
                    'Sem ZipArchive o backup compactado não pode ser gerado.',
                ],
                status: 500,
                errorId: $errorId,
                stage: 'zip-extension',
            );
        }

        try {
            $timestamp = now()->format('Y-m-d_H-i-s');
            $fileName = "backup_kaique_{$timestamp}.zip";
            $backupDir = storage_path('app/private/backups');

            File::ensureDirectoryExists($backupDir);

            if (! File::isWritable($backupDir)) {
                return $this->backupError(
                    message: 'Pasta de backup sem permissão de escrita.',
                    details: [
                        'Verifique permissão no diretório: '.$backupDir,
                    ],
                    status: 500,
                    errorId: $errorId,
                    stage: 'filesystem-permission',
                );
            }

            $zipPath = $backupDir.DIRECTORY_SEPARATOR.$fileName;
            $zip = new ZipArchive;
            $opened = $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);

            if ($opened !== true) {
                return $this->backupError(
                    message: 'Não foi possível abrir o arquivo ZIP para escrita.',
                    details: [
                        'Código ZipArchive: '.(string) $opened,
                        'Destino: '.$zipPath,
                    ],
                    status: 500,
                    errorId: $errorId,
                    stage: 'zip-open',
                );
            }

            $zip->addFromString('backup/README.txt', implode(PHP_EOL, [
                'Backup gerado pelo sistema Kaique Transportes',
                'Data: '.now()->toDateTimeString(),
                'Conteúdo: banco.sql + .env + código + arquivos em storage (completo)',
                'Error-ID desta execução: '.$errorId,
            ]));

            $zip->addFromString('backup/database.sql', $this->buildSqlDump());

            $envPath = base_path('.env');
            if (File::exists($envPath)) {
                $zip->addFile($envPath, 'backup/.env');
            }

            $this->addDirectoryToZip(
                zip: $zip,
                sourcePath: app_path(),
                zipBasePath: 'backup/app',
            );
            $this->addDirectoryToZip(
                zip: $zip,
                sourcePath: config_path(),
                zipBasePath: 'backup/config',
            );
            $this->addDirectoryToZip(
                zip: $zip,
                sourcePath: database_path(),
                zipBasePath: 'backup/database_files',
            );
            $this->addDirectoryToZip(
                zip: $zip,
                sourcePath: base_path('resources'),
                zipBasePath: 'backup/resources',
            );
            $this->addDirectoryToZip(
                zip: $zip,
                sourcePath: base_path('routes'),
                zipBasePath: 'backup/routes',
            );
            $this->addDirectoryToZip(
                zip: $zip,
                sourcePath: base_path('public'),
                zipBasePath: 'backup/public',
                excludedPathFragments: ['public/build/'],
            );
            $this->addDirectoryToZip(
                zip: $zip,
                sourcePath: storage_path(),
                zipBasePath: 'backup/storage',
                excludedPathFragments: ['storage/app/private/backups/'],
            );

            foreach (['artisan', 'composer.json', 'composer.lock', 'package.json', 'vite.config.ts'] as $file) {
                $path = base_path($file);
                if (File::exists($path)) {
                    $zip->addFile($path, 'backup/'.$file);
                }
            }

            $zip->close();

            return response()->download($zipPath, $fileName)->deleteFileAfterSend(true);
        } catch (Throwable $exception) {
            Log::error('Falha ao gerar backup', [
                'error_id' => $errorId,
                'message' => $exception->getMessage(),
                'code' => $exception->getCode(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'trace' => app()->isProduction() ? null : $exception->getTraceAsString(),
            ]);

            $details = [
                'Classe: '.get_class($exception),
                'Arquivo: '.$exception->getFile().':'.$exception->getLine(),
                'Código interno: '.(string) $exception->getCode(),
            ];

            if (app()->isProduction()) {
                $details[] = 'Consulte o log com o error_id informado para stack trace completa.';
            } else {
                $details[] = 'Mensagem técnica: '.$exception->getMessage();
            }

            return $this->backupError(
                message: 'Falha inesperada ao montar o backup.',
                details: $details,
                status: 500,
                errorId: $errorId,
                stage: 'exception',
            );
        }
    }

    /**
     * @throws ValidationException
     */
    public function updatePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $request->user();

        if (! $user || ! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Senha atual incorreta.'],
            ]);
        }

        $user->password = $data['password'];
        $user->save();

        return response()->json([
            'message' => 'Senha alterada com sucesso.',
        ]);
    }

    public function storeUser(Request $request): JsonResponse
    {
        $actor = $request->user();

        abort_unless($actor?->isMasterAdmin(), 403, 'Acesso negado.');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role' => ['required', Rule::in(['master_admin', 'admin', 'usuario'])],
        ]);

        $user = User::query()->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'role' => $data['role'],
        ]);

        return response()->json([
            'message' => 'Usuário cadastrado com sucesso.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
            ],
        ], 201);
    }

    private function buildSqlDump(): string
    {
        $connection = DB::connection();
        $driver = (string) $connection->getDriverName();
        $pdo = DB::connection()->getPdo();

        $dump = [];
        $dump[] = '-- Backup SQL Kaique Transportes';
        $dump[] = '-- Data: '.now()->toDateTimeString();
        $dump[] = 'SET FOREIGN_KEY_CHECKS=0;';
        $dump[] = '';

        $tables = $this->getTableNames($driver);
        $views = $this->getViewNames($driver);

        foreach ($tables as $table) {
            $safeTable = str_replace('`', '``', $table);
            $createSql = $this->getCreateTableSql($driver, $table);

            $dump[] = "DROP TABLE IF EXISTS `{$safeTable}`;";
            $dump[] = $createSql.';';

            $rows = DB::table($table)->get();

            if ($rows->isNotEmpty()) {
                foreach ($rows as $row) {
                    $record = (array) $row;
                    $columns = implode(', ', array_map(
                        fn (string $column): string => '`'.str_replace('`', '``', $column).'`',
                        array_keys($record),
                    ));
                    $values = implode(', ', array_map(
                        fn ($value): string => $this->quoteSqlValue($value, $pdo),
                        array_values($record),
                    ));

                    $dump[] = "INSERT INTO `{$safeTable}` ({$columns}) VALUES ({$values});";
                }
            }

            $dump[] = '';
        }

        foreach ($views as $view) {
            $safeView = str_replace('`', '``', $view);
            $createViewSql = $this->getCreateViewSql($driver, $view);

            if ($createViewSql === '') {
                continue;
            }

            $dump[] = "DROP VIEW IF EXISTS `{$safeView}`;";
            $dump[] = $createViewSql.';';
            $dump[] = '';
        }

        if ($driver === 'sqlite') {
            $dump[] = '-- SQLite indexes';

            foreach ($this->getSQLiteObjectSqlByType('index') as $sql) {
                $dump[] = $sql.';';
            }

            $dump[] = '';
            $dump[] = '-- SQLite triggers';

            foreach ($this->getSQLiteObjectSqlByType('trigger') as $sql) {
                $dump[] = $sql.';';
            }

            $dump[] = '';
        }

        if ($driver !== 'sqlite') {
            $dump[] = '-- MySQL triggers';

            foreach ($this->getMySqlTriggerSql() as $sql) {
                $dump[] = $sql;
            }

            $dump[] = '';
            $dump[] = '-- MySQL routines';

            foreach ($this->getMySqlRoutineSql() as $sql) {
                $dump[] = $sql;
            }

            $dump[] = '';
            $dump[] = '-- MySQL events';

            foreach ($this->getMySqlEventSql() as $sql) {
                $dump[] = $sql;
            }

            $dump[] = '';
        }

        $dump[] = 'SET FOREIGN_KEY_CHECKS=1;';

        return implode(PHP_EOL, $dump).PHP_EOL;
    }

    /**
     * @return \Illuminate\Support\Collection<int, string>
     */
    private function getTableNames(string $driver)
    {
        if ($driver === 'sqlite') {
            return collect(DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"))
                ->map(fn (object $row): string => (string) ((array) $row)['name'])
                ->filter()
                ->values();
        }

        $databaseName = (string) config('database.connections.mysql.database');

        return collect(DB::select('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"'))
            ->map(function (object $row) use ($databaseName): string {
                $array = (array) $row;
                $key = 'Tables_in_'.$databaseName;

                if (array_key_exists($key, $array)) {
                    return (string) $array[$key];
                }

                return (string) (array_values($array)[0] ?? '');
            })
            ->filter()
            ->values();
    }

    /**
     * @return \Illuminate\Support\Collection<int, string>
     */
    private function getViewNames(string $driver)
    {
        if ($driver === 'sqlite') {
            return collect(DB::select("SELECT name FROM sqlite_master WHERE type='view' AND name NOT LIKE 'sqlite_%' ORDER BY name"))
                ->map(fn (object $row): string => (string) ((array) $row)['name'])
                ->filter()
                ->values();
        }

        $databaseName = (string) config('database.connections.mysql.database');

        return collect(DB::select('SHOW FULL TABLES WHERE Table_type = "VIEW"'))
            ->map(function (object $row) use ($databaseName): string {
                $array = (array) $row;
                $key = 'Tables_in_'.$databaseName;

                if (array_key_exists($key, $array)) {
                    return (string) $array[$key];
                }

                return (string) (array_values($array)[0] ?? '');
            })
            ->filter()
            ->values();
    }

    private function getCreateTableSql(string $driver, string $table): string
    {
        $safeTable = str_replace('`', '``', $table);

        if ($driver === 'sqlite') {
            $row = DB::selectOne("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?", [$table]);
            $array = (array) $row;

            return (string) ($array['sql'] ?? '');
        }

        $createRow = DB::selectOne("SHOW CREATE TABLE `{$safeTable}`");
        $createArray = (array) $createRow;

        return (string) ($createArray['Create Table'] ?? array_values($createArray)[1] ?? '');
    }

    private function getCreateViewSql(string $driver, string $view): string
    {
        $safeView = str_replace('`', '``', $view);

        if ($driver === 'sqlite') {
            $row = DB::selectOne("SELECT sql FROM sqlite_master WHERE type='view' AND name = ?", [$view]);
            $array = (array) $row;

            return (string) ($array['sql'] ?? '');
        }

        $createRow = DB::selectOne("SHOW CREATE VIEW `{$safeView}`");
        $createArray = (array) $createRow;

        return (string) ($createArray['Create View'] ?? array_values($createArray)[1] ?? '');
    }

    /**
     * @return array<int, string>
     */
    private function getSQLiteObjectSqlByType(string $type): array
    {
        if (! in_array($type, ['index', 'trigger'], true)) {
            return [];
        }

        return collect(DB::select("SELECT sql FROM sqlite_master WHERE type = ? AND sql IS NOT NULL ORDER BY name", [$type]))
            ->map(fn (object $row): string => (string) ((array) $row)['sql'])
            ->filter(fn (string $sql): bool => trim($sql) !== '')
            ->values()
            ->all();
    }

    /**
     * @return array<int, string>
     */
    private function getMySqlTriggerSql(): array
    {
        try {
            $rows = DB::select('SHOW TRIGGERS');
        } catch (Throwable) {
            return ['-- Aviso: sem permissão para listar triggers (SHOW TRIGGERS).'];
        }

        $statements = [];

        foreach ($rows as $row) {
            $triggerName = (string) ((array) $row)['Trigger'];
            $safeTriggerName = str_replace('`', '``', $triggerName);

            try {
                $createRow = DB::selectOne("SHOW CREATE TRIGGER `{$safeTriggerName}`");
                $createArray = (array) $createRow;
                $createSql = (string) ($createArray['SQL Original Statement'] ?? array_values($createArray)[2] ?? '');

                if ($createSql === '') {
                    continue;
                }

                $statements[] = "DROP TRIGGER IF EXISTS `{$safeTriggerName}`;";
                $statements[] = $createSql.';';
            } catch (Throwable) {
                $statements[] = "-- Aviso: não foi possível exportar trigger {$triggerName}.";
            }
        }

        return $statements;
    }

    /**
     * @return array<int, string>
     */
    private function getMySqlRoutineSql(): array
    {
        $databaseName = (string) config('database.connections.mysql.database');

        try {
            $rows = DB::select(
                'SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? ORDER BY ROUTINE_TYPE, ROUTINE_NAME',
                [$databaseName],
            );
        } catch (Throwable) {
            return ['-- Aviso: sem permissão para listar routines (information_schema.ROUTINES).'];
        }

        $statements = [];

        foreach ($rows as $row) {
            $data = (array) $row;
            $routineName = (string) ($data['ROUTINE_NAME'] ?? '');
            $routineType = strtoupper((string) ($data['ROUTINE_TYPE'] ?? ''));

            if ($routineName === '' || ! in_array($routineType, ['PROCEDURE', 'FUNCTION'], true)) {
                continue;
            }

            $safeRoutine = str_replace('`', '``', $routineName);

            try {
                if ($routineType === 'PROCEDURE') {
                    $createRow = DB::selectOne("SHOW CREATE PROCEDURE `{$safeRoutine}`");
                    $createArray = (array) $createRow;
                    $createSql = (string) ($createArray['Create Procedure'] ?? array_values($createArray)[2] ?? '');
                } else {
                    $createRow = DB::selectOne("SHOW CREATE FUNCTION `{$safeRoutine}`");
                    $createArray = (array) $createRow;
                    $createSql = (string) ($createArray['Create Function'] ?? array_values($createArray)[2] ?? '');
                }

                if ($createSql === '') {
                    continue;
                }

                $statements[] = "DROP {$routineType} IF EXISTS `{$safeRoutine}`;";
                $statements[] = $createSql.';';
            } catch (Throwable) {
                $statements[] = "-- Aviso: não foi possível exportar {$routineType} {$routineName}.";
            }
        }

        return $statements;
    }

    /**
     * @return array<int, string>
     */
    private function getMySqlEventSql(): array
    {
        $databaseName = (string) config('database.connections.mysql.database');

        try {
            $rows = DB::select('SHOW EVENTS FROM `'.str_replace('`', '``', $databaseName).'`');
        } catch (Throwable) {
            return ['-- Aviso: sem permissão para listar eventos (SHOW EVENTS).'];
        }

        $statements = [];

        foreach ($rows as $row) {
            $eventName = (string) ((array) $row)['Name'];
            $safeEvent = str_replace('`', '``', $eventName);

            try {
                $createRow = DB::selectOne("SHOW CREATE EVENT `{$safeEvent}`");
                $createArray = (array) $createRow;
                $createSql = (string) ($createArray['Create Event'] ?? array_values($createArray)[3] ?? '');

                if ($createSql === '') {
                    continue;
                }

                $statements[] = "DROP EVENT IF EXISTS `{$safeEvent}`;";
                $statements[] = $createSql.';';
            } catch (Throwable) {
                $statements[] = "-- Aviso: não foi possível exportar evento {$eventName}.";
            }
        }

        return $statements;
    }

    private function quoteSqlValue(mixed $value, \PDO $pdo): string
    {
        if ($value === null) {
            return 'NULL';
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }

        if ($value instanceof \DateTimeInterface) {
            return (string) $pdo->quote($value->format('Y-m-d H:i:s'));
        }

        return (string) $pdo->quote((string) $value);
    }

    /**
     * @param  array<int, string>  $excludedPathFragments
     */
    private function addDirectoryToZip(
        ZipArchive $zip,
        string $sourcePath,
        string $zipBasePath,
        array $excludedPathFragments = [],
    ): void {
        if (! File::isDirectory($sourcePath)) {
            return;
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($sourcePath, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST,
        );

        foreach ($iterator as $file) {
            if (! $file instanceof SplFileInfo || ! $file->isFile()) {
                continue;
            }

            $realPath = $file->getRealPath();

            if (! $realPath) {
                continue;
            }

            $normalizedPath = str_replace('\\', '/', $realPath);

            if (collect($excludedPathFragments)->contains(fn (string $fragment) => Str::contains($normalizedPath, $fragment))) {
                continue;
            }

            $relative = ltrim(str_replace('\\', '/', str_replace($sourcePath, '', $realPath)), '/');
            $zip->addFile($realPath, trim($zipBasePath, '/').'/'.$relative);
        }
    }

    /**
     * @param  array<int, string>  $details
     */
    private function backupError(
        string $message,
        array $details,
        int $status,
        string $errorId,
        string $stage,
    ): JsonResponse {
        return response()->json([
            'message' => $message,
            'details' => $details,
            'error_id' => $errorId,
            'stage' => $stage,
            'timestamp' => now()->toISOString(),
        ], $status);
    }
}
