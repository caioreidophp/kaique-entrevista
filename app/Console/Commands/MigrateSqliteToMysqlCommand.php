<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use PDO;
use Throwable;

class MigrateSqliteToMysqlCommand extends Command
{
    protected $signature = 'app:migrate-sqlite-to-mysql
        {--confirm : Confirma a copia de dados para o MySQL de teste}
        {--sqlite=database/database.sqlite : Caminho do SQLite de origem}
        {--mysql=mysql : Nome da conexao MySQL de destino}
        {--mysql-host=127.0.0.1 : Host MySQL de teste}
        {--mysql-port=3306 : Porta MySQL de teste}
        {--mysql-database= : Banco MySQL de teste}
        {--mysql-username=root : Usuario MySQL de teste}
        {--mysql-password= : Senha MySQL de teste}
        {--chunk=200 : Quantidade de registros por lote}';

    protected $description = 'Copia dados do SQLite para MySQL de teste preservando IDs, sem alterar o SQLite';

    /**
     * @var array<string>
     */
    private array $ignoredSchemaDifferenceTables = ['migrations'];

    public function handle(): int
    {
        if (! $this->option('confirm')) {
            $this->error('Operacao recusada. Rode novamente com --confirm para copiar dados para o MySQL de teste.');

            return self::FAILURE;
        }

        $sqlitePath = $this->resolveSqlitePath();
        if (! is_file($sqlitePath)) {
            $this->error("SQLite de origem nao encontrado: {$sqlitePath}");

            return self::FAILURE;
        }

        $mysqlConnection = (string) $this->option('mysql');
        if (! $this->configureMysqlConnection($mysqlConnection)) {
            return self::FAILURE;
        }

        $backupPath = $this->backupSqlite($sqlitePath);
        $this->info("Backup criado: {$backupPath}");

        $sqlite = new PDO('sqlite:'.$sqlitePath);
        $sqlite->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        try {
            DB::connection($mysqlConnection)->getPdo();
        } catch (Throwable $e) {
            $this->error('Nao foi possivel conectar ao MySQL de teste: '.$e->getMessage());

            return self::FAILURE;
        }

        $schemaReport = $this->validateSchema($sqlite, $mysqlConnection);
        $this->renderSchemaReport($schemaReport);

        if ($schemaReport['critical'] !== []) {
            $this->error('Diferencas criticas de schema encontradas. Migracao abortada antes de copiar dados.');

            return self::FAILURE;
        }

        $tables = $this->orderedTables($mysqlConnection);
        $chunkSize = max(1, (int) $this->option('chunk'));
        $report = [];

        foreach ($tables as $table) {
            try {
                $result = $this->copyTable($sqlite, $mysqlConnection, $table, $chunkSize);
                $report[] = [$table, $result['source'], $result['destination_before'], $result['inserted'], $result['status']];
                $this->line("{$table}: {$result['status']} ({$result['inserted']} inseridos)");
            } catch (Throwable $e) {
                $this->newLine();
                $this->error("Erro ao migrar tabela {$table}: ".$e->getMessage());
                $this->table(['Tabela', 'SQLite', 'MySQL antes', 'Inseridos', 'Status'], $report);

                return self::FAILURE;
            }
        }

        $this->newLine();
        $this->info('Relatorio da migracao de teste');
        $this->table(['Tabela', 'SQLite', 'MySQL antes', 'Inseridos', 'Status'], $report);

        return self::SUCCESS;
    }

    private function resolveSqlitePath(): string
    {
        $path = (string) $this->option('sqlite');

        if (! str_starts_with($path, DIRECTORY_SEPARATOR) && ! preg_match('/^[A-Za-z]:[\\\\\\/]/', $path)) {
            $path = base_path($path);
        }

        return $path;
    }

    private function configureMysqlConnection(string $connection): bool
    {
        $database = (string) $this->option('mysql-database');

        if ($database === '') {
            $this->error('Informe --mysql-database com o nome do banco MySQL de teste.');

            return false;
        }

        Config::set("database.connections.{$connection}.host", (string) $this->option('mysql-host'));
        Config::set("database.connections.{$connection}.port", (string) $this->option('mysql-port'));
        Config::set("database.connections.{$connection}.database", $database);
        Config::set("database.connections.{$connection}.username", (string) $this->option('mysql-username'));
        Config::set("database.connections.{$connection}.password", (string) $this->option('mysql-password'));

        DB::purge($connection);

        return true;
    }

    private function backupSqlite(string $sqlitePath): string
    {
        $backupDir = storage_path('app/private/migration-backups/'.date('Ymd-His'));

        if (! is_dir($backupDir)) {
            mkdir($backupDir, 0775, true);
        }

        $target = $backupDir.'/database.sqlite';

        if (! copy($sqlitePath, $target)) {
            throw new \RuntimeException('Falha ao copiar backup do SQLite.');
        }

        return $target;
    }

    /**
     * @return array{critical: array<int, string>, warnings: array<int, string>, type_differences: array<int, array<int, string>>}
     */
    private function validateSchema(PDO $sqlite, string $mysqlConnection): array
    {
        $critical = [];
        $warnings = [];
        $typeDifferences = [];

        $sqliteTables = $this->sqliteTables($sqlite);
        $mysqlTables = $this->mysqlTables($mysqlConnection);

        foreach (array_diff($sqliteTables, $mysqlTables) as $table) {
            $critical[] = "Tabela existe no SQLite e nao existe no MySQL: {$table}";
        }

        foreach (array_diff($mysqlTables, $sqliteTables) as $table) {
            $critical[] = "Tabela existe no MySQL e nao existe no SQLite: {$table}";
        }

        foreach (array_intersect($sqliteTables, $mysqlTables) as $table) {
            $sqliteColumns = $this->sqliteColumns($sqlite, $table);
            $mysqlColumns = $this->mysqlColumns($mysqlConnection, $table);

            $sqliteColumnNames = array_keys($sqliteColumns);
            $mysqlColumnNames = array_keys($mysqlColumns);

            foreach (array_diff($sqliteColumnNames, $mysqlColumnNames) as $column) {
                if (in_array($table, $this->ignoredSchemaDifferenceTables, true)) {
                    $warnings[] = "{$table}.{$column} existe no SQLite e nao existe no MySQL.";
                } else {
                    $critical[] = "{$table}.{$column} existe no SQLite e nao existe no MySQL.";
                }
            }

            foreach (array_diff($mysqlColumnNames, $sqliteColumnNames) as $column) {
                $columnInfo = $mysqlColumns[$column];
                $nullable = strtoupper((string) $columnInfo['nullable']) === 'YES';
                $hasDefault = $columnInfo['default'] !== null;
                $extra = strtolower((string) $columnInfo['extra']);

                if (! $nullable && ! $hasDefault && ! str_contains($extra, 'auto_increment')) {
                    $critical[] = "{$table}.{$column} existe apenas no MySQL e parece obrigatoria.";
                } else {
                    $warnings[] = "{$table}.{$column} existe no MySQL e nao existe no SQLite.";
                }
            }

            foreach (array_intersect($sqliteColumnNames, $mysqlColumnNames) as $column) {
                $sqliteType = strtolower((string) $sqliteColumns[$column]['type']);
                $mysqlType = strtolower((string) $mysqlColumns[$column]['type']);

                if ($sqliteType !== '' && $mysqlType !== '' && ! $this->typesAreCompatible($sqliteType, $mysqlType)) {
                    $typeDifferences[] = [$table, $column, $sqliteType, $mysqlType];
                }
            }
        }

        return [
            'critical' => $critical,
            'warnings' => $warnings,
            'type_differences' => $typeDifferences,
        ];
    }

    /**
     * @param array{critical: array<int, string>, warnings: array<int, string>, type_differences: array<int, array<int, string>>} $report
     */
    private function renderSchemaReport(array $report): void
    {
        $this->info('Validacao de schema');
        $this->line('Diferencas criticas: '.count($report['critical']));
        foreach ($report['critical'] as $item) {
            $this->error(' - '.$item);
        }

        $this->line('Avisos: '.count($report['warnings']));
        foreach ($report['warnings'] as $item) {
            $this->warn(' - '.$item);
        }

        $this->line('Diferencas de tipo revisaveis: '.count($report['type_differences']));
        if ($report['type_differences'] !== []) {
            $this->table(['Tabela', 'Coluna', 'SQLite', 'MySQL'], $report['type_differences']);
        }
    }

    private function typesAreCompatible(string $sqliteType, string $mysqlType): bool
    {
        $sqlite = $this->typeFamily($sqliteType);
        $mysql = $this->typeFamily($mysqlType);

        return $sqlite === $mysql
            || ($sqlite === 'text' && $mysql === 'json')
            || ($sqlite === 'numeric' && $mysql === 'decimal')
            || ($sqlite === 'integer' && $mysql === 'boolean');
    }

    private function typeFamily(string $type): string
    {
        return match (true) {
            str_contains($type, 'int') => 'integer',
            str_contains($type, 'tinyint(1)') => 'boolean',
            str_contains($type, 'char'), str_contains($type, 'text'), str_contains($type, 'enum') => 'text',
            str_contains($type, 'json') => 'json',
            str_contains($type, 'date'), str_contains($type, 'time') => 'datetime',
            str_contains($type, 'decimal'), str_contains($type, 'numeric'), str_contains($type, 'double'), str_contains($type, 'float') => 'decimal',
            default => $type,
        };
    }

    /**
     * @return array<int, string>
     */
    private function orderedTables(string $mysqlConnection): array
    {
        $tables = $this->mysqlTables($mysqlConnection);
        $dependencies = array_fill_keys($tables, []);

        foreach ($this->mysqlForeignKeys($mysqlConnection) as $foreignKey) {
            $table = $foreignKey['table'];
            $referenced = $foreignKey['referenced_table'];

            if ($table !== $referenced && isset($dependencies[$table], $dependencies[$referenced])) {
                $dependencies[$table][] = $referenced;
            }
        }

        $ordered = [];
        $temporary = [];
        $permanent = [];
        $visit = function (string $table) use (&$visit, &$dependencies, &$ordered, &$temporary, &$permanent): void {
            if (isset($permanent[$table])) {
                return;
            }

            if (isset($temporary[$table])) {
                return;
            }

            $temporary[$table] = true;

            foreach (array_unique($dependencies[$table] ?? []) as $dependency) {
                $visit($dependency);
            }

            $permanent[$table] = true;
            $ordered[] = $table;
        };

        foreach ($tables as $table) {
            $visit($table);
        }

        return array_values(array_unique($ordered));
    }

    /**
     * @return array{source: int, destination_before: int, inserted: int, status: string}
     */
    private function copyTable(PDO $sqlite, string $mysqlConnection, string $table, int $chunkSize): array
    {
        $sourceCount = $this->sqliteCount($sqlite, $table);
        $destinationCount = (int) DB::connection($mysqlConnection)->table($table)->count();

        if ($destinationCount > 0) {
            if ($destinationCount === $sourceCount) {
                return [
                    'source' => $sourceCount,
                    'destination_before' => $destinationCount,
                    'inserted' => 0,
                    'status' => 'SKIP ja conferido',
                ];
            }

            if ($table !== 'migrations') {
                throw new \RuntimeException("Destino nao vazio ({$destinationCount}) e diferente da origem ({$sourceCount}).");
            }
        }

        if ($sourceCount === 0) {
            return [
                'source' => 0,
                'destination_before' => $destinationCount,
                'inserted' => 0,
                'status' => 'OK vazio',
            ];
        }

        $columns = array_keys($this->sqliteColumns($sqlite, $table));
        $inserted = 0;
        $offset = 0;
        $quotedTable = $this->sqliteQuote($table);
        $orderBy = in_array('id', $columns, true) ? ' ORDER BY "id"' : '';

        while ($offset < $sourceCount) {
            $rows = $sqlite->query("SELECT * FROM {$quotedTable}{$orderBy} LIMIT {$chunkSize} OFFSET {$offset}")
                ->fetchAll(PDO::FETCH_ASSOC);

            if ($rows === []) {
                break;
            }

            DB::connection($mysqlConnection)->transaction(function () use ($mysqlConnection, $table, $rows, &$inserted): void {
                foreach ($rows as $row) {
                    if ($table === 'migrations') {
                        DB::connection($mysqlConnection)->table($table)->updateOrInsert(
                            ['migration' => $row['migration']],
                            ['batch' => $row['batch']],
                        );
                    } else {
                        DB::connection($mysqlConnection)->table($table)->insert($row);
                        $inserted++;
                    }
                }
            });

            if ($table === 'migrations') {
                $inserted = max(0, (int) DB::connection($mysqlConnection)->table($table)->count() - $destinationCount);
            }

            $offset += $chunkSize;
        }

        return [
            'source' => $sourceCount,
            'destination_before' => $destinationCount,
            'inserted' => $inserted,
            'status' => 'OK',
        ];
    }

    /**
     * @return array<int, string>
     */
    private function sqliteTables(PDO $sqlite): array
    {
        return $sqlite->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            ->fetchAll(PDO::FETCH_COLUMN);
    }

    private function sqliteCount(PDO $sqlite, string $table): int
    {
        return (int) $sqlite->query('SELECT COUNT(*) FROM '.$this->sqliteQuote($table))->fetchColumn();
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function sqliteColumns(PDO $sqlite, string $table): array
    {
        $columns = [];
        $rows = $sqlite->query('PRAGMA table_info('.$this->sqliteQuote($table).')')->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rows as $row) {
            $columns[(string) $row['name']] = [
                'type' => $row['type'] ?? '',
                'nullable' => ((int) $row['notnull']) === 0 ? 'YES' : 'NO',
                'default' => $row['dflt_value'] ?? null,
                'extra' => '',
            ];
        }

        return $columns;
    }

    /**
     * @return array<int, string>
     */
    private function mysqlTables(string $connection): array
    {
        $database = (string) config("database.connections.{$connection}.database");

        return collect(DB::connection($connection)->select('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"'))
            ->map(function (object $row) use ($database): string {
                $array = (array) $row;
                $key = 'Tables_in_'.$database;

                return (string) ($array[$key] ?? array_values($array)[0] ?? '');
            })
            ->filter()
            ->sort()
            ->values()
            ->all();
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function mysqlColumns(string $connection, string $table): array
    {
        $database = (string) config("database.connections.{$connection}.database");
        $rows = DB::connection($connection)->select(
            'SELECT column_name, column_type, is_nullable, column_default, extra
             FROM information_schema.columns
             WHERE table_schema = ? AND table_name = ?
             ORDER BY ordinal_position',
            [$database, $table],
        );

        $columns = [];
        foreach ($rows as $row) {
            $array = (array) $row;
            $columns[(string) $array['column_name']] = [
                'type' => $array['column_type'] ?? '',
                'nullable' => $array['is_nullable'] ?? '',
                'default' => $array['column_default'] ?? null,
                'extra' => $array['extra'] ?? '',
            ];
        }

        return $columns;
    }

    /**
     * @return array<int, array{table: string, referenced_table: string}>
     */
    private function mysqlForeignKeys(string $connection): array
    {
        $database = (string) config("database.connections.{$connection}.database");
        $rows = DB::connection($connection)->select(
            'SELECT table_name, referenced_table_name
             FROM information_schema.key_column_usage
             WHERE table_schema = ? AND referenced_table_name IS NOT NULL',
            [$database],
        );

        return collect($rows)
            ->map(fn (object $row): array => [
                'table' => (string) ((array) $row)['table_name'],
                'referenced_table' => (string) ((array) $row)['referenced_table_name'],
            ])
            ->values()
            ->all();
    }

    private function sqliteQuote(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
    }
}
