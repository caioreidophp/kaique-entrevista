<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use PDO;
use Throwable;

class CompareSqliteMysqlCommand extends Command
{
    protected $signature = 'app:compare-sqlite-mysql
        {--sqlite=database/database.sqlite : Caminho do arquivo SQLite}
        {--mysql=mysql : Nome da conexao MySQL configurada para comparacao}
        {--mysql-host=127.0.0.1 : Host MySQL de teste}
        {--mysql-port=3306 : Porta MySQL de teste}
        {--mysql-database= : Banco MySQL de teste}
        {--mysql-username=root : Usuario MySQL de teste}
        {--mysql-password= : Senha MySQL de teste}';

    protected $description = 'Compara SQLite e MySQL em modo leitura, sem migrar dados';

    public function handle(): int
    {
        $this->info('Comparacao SQLite x MySQL - somente leitura');
        $this->warn('Este comando nao cria tabelas, nao migra dados e nao altera configuracoes.');

        $sqlitePath = $this->resolveSqlitePath();
        $mysqlConnection = (string) $this->option('mysql');

        if (! is_file($sqlitePath)) {
            $this->error("SQLite nao encontrado: {$sqlitePath}");

            return self::FAILURE;
        }

        if (! $this->configureMysqlConnection($mysqlConnection)) {
            return self::FAILURE;
        }

        try {
            DB::connection($mysqlConnection)->getPdo();
        } catch (Throwable $e) {
            $this->error("Nao foi possivel conectar/listar MySQL ({$mysqlConnection}): ".$e->getMessage());

            return self::FAILURE;
        }

        $sqlite = new PDO('sqlite:'.$sqlitePath);
        $sqlite->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $sqliteTables = $this->sqliteTables($sqlite);
        $mysqlTables = $this->mysqlTables($mysqlConnection);
        $commonTables = array_values(array_intersect($sqliteTables, $mysqlTables));
        $operationalTables = array_values(array_filter(
            $commonTables,
            fn (string $table): bool => $table !== 'migrations',
        ));

        $this->renderTablePresence($sqliteTables, $mysqlTables);
        $countDiffs = $this->renderCountsAndIds($sqlite, $mysqlConnection, $operationalTables);
        $metricDiffs = $this->renderFinancialAndFreightSums($sqlite, $mysqlConnection);
        $groupDiffs = $this->renderGroupedChecks($sqlite, $mysqlConnection);
        $orphanDiffs = $this->renderOrphanChecks($mysqlConnection);
        $dateDiffs = $this->renderLastDates($sqlite, $mysqlConnection, $operationalTables);
        $migrationMetadataDiffs = $this->renderMigrationMetadata($sqlite, $mysqlConnection);

        $totalDiffs = $countDiffs + $metricDiffs + $groupDiffs + $orphanDiffs + $dateDiffs;

        $this->newLine();
        if ($totalDiffs === 0 && count($sqliteTables) === count($mysqlTables)) {
            $this->info('Comparacao operacional concluida sem divergencias criticas.');
        } else {
            $this->warn("Comparacao operacional concluida com {$totalDiffs} divergencias/alertas.");
        }

        if ($migrationMetadataDiffs > 0) {
            $this->warn("Metadados de migrations possuem {$migrationMetadataDiffs} diferenca(s) documentada(s).");
        }

        return $totalDiffs === 0 ? self::SUCCESS : self::FAILURE;
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

        if ($database !== '') {
            Config::set("database.connections.{$connection}.host", (string) $this->option('mysql-host'));
            Config::set("database.connections.{$connection}.port", (string) $this->option('mysql-port'));
            Config::set("database.connections.{$connection}.database", $database);
            Config::set("database.connections.{$connection}.username", (string) $this->option('mysql-username'));
            Config::set("database.connections.{$connection}.password", (string) $this->option('mysql-password'));
            DB::purge($connection);
        }

        return true;
    }

    /**
     * @param array<int, string> $sqliteTables
     * @param array<int, string> $mysqlTables
     */
    private function renderTablePresence(array $sqliteTables, array $mysqlTables): void
    {
        $this->newLine();
        $this->info('Resumo de tabelas');
        $this->table(
            ['Origem', 'Tabelas'],
            [
                ['SQLite', count($sqliteTables)],
                ['MySQL', count($mysqlTables)],
            ],
        );

        $missingInMysql = array_values(array_diff($sqliteTables, $mysqlTables));
        $extraInMysql = array_values(array_diff($mysqlTables, $sqliteTables));

        $this->line('Tabelas no SQLite ausentes no MySQL: '.count($missingInMysql));
        foreach ($missingInMysql as $table) {
            $this->warn(' - '.$table);
        }

        $this->line('Tabelas no MySQL ausentes no SQLite: '.count($extraInMysql));
        foreach ($extraInMysql as $table) {
            $this->warn(' - '.$table);
        }
    }

    /**
     * @param array<int, string> $tables
     */
    private function renderCountsAndIds(PDO $sqlite, string $mysqlConnection, array $tables): int
    {
        $rows = [];
        $diffs = 0;

        foreach ($tables as $table) {
            $sqliteColumns = array_keys($this->sqliteColumns($sqlite, $table));
            $hasId = in_array('id', $sqliteColumns, true);
            $sqliteCount = $this->sqliteCount($sqlite, $table);
            $mysqlCount = (int) DB::connection($mysqlConnection)->table($table)->count();
            $sqliteMin = $hasId && $sqliteCount > 0 ? $this->sqliteScalar($sqlite, $table, 'MIN(id)') : null;
            $sqliteMax = $hasId && $sqliteCount > 0 ? $this->sqliteScalar($sqlite, $table, 'MAX(id)') : null;
            $mysqlMin = $hasId && $mysqlCount > 0 ? DB::connection($mysqlConnection)->table($table)->min('id') : null;
            $mysqlMax = $hasId && $mysqlCount > 0 ? DB::connection($mysqlConnection)->table($table)->max('id') : null;
            $status = ($sqliteCount === $mysqlCount && (string) $sqliteMin === (string) $mysqlMin && (string) $sqliteMax === (string) $mysqlMax)
                ? 'OK'
                : 'DIFERENTE';

            if ($status !== 'OK') {
                $diffs++;
            }

            $rows[] = [$table, $sqliteCount, $mysqlCount, $sqliteMin, $mysqlMin, $sqliteMax, $mysqlMax, $status];
        }

        $this->newLine();
        $this->info('Contagem e faixa de IDs');
        $this->table(['Tabela', 'SQLite', 'MySQL', 'Min ID SQLite', 'Min ID MySQL', 'Max ID SQLite', 'Max ID MySQL', 'Status'], $rows);

        return $diffs;
    }

    private function renderFinancialAndFreightSums(PDO $sqlite, string $mysqlConnection): int
    {
        $checks = [
            ['pagamentos', 'valor'],
            ['descontos_colaboradores', 'valor'],
            ['emprestimos_colaboradores', 'valor_total'],
            ['emprestimos_colaboradores', 'valor_parcela'],
            ['pensoes_colaboradores', 'valor'],
            ['multas', 'valor'],
            ['freight_entries', 'frete_total'],
            ['freight_entries', 'km_rodado'],
            ['freight_entries', 'km_terceiros'],
            ['freight_entries', 'frete_terceiros'],
            ['freight_entries', 'frete_liquido'],
            ['freight_entries', 'kaique'],
            ['freight_entries', 'vdm'],
            ['freight_spot_entries', 'frete_spot'],
            ['freight_spot_entries', 'km_rodado'],
            ['freight_canceled_loads', 'valor'],
        ];

        $rows = [];
        $diffs = 0;

        foreach ($checks as [$table, $column]) {
            if (! $this->sqliteHasColumn($sqlite, $table, $column) || ! $this->mysqlHasColumn($mysqlConnection, $table, $column)) {
                continue;
            }

            $sqliteSum = $this->normalizeNumber($this->sqliteScalar($sqlite, $table, "COALESCE(SUM(\"{$column}\"), 0)"));
            $mysqlSum = $this->normalizeNumber(DB::connection($mysqlConnection)->table($table)->sum($column));
            $status = $sqliteSum === $mysqlSum ? 'OK' : 'DIFERENTE';

            if ($status !== 'OK') {
                $diffs++;
            }

            $rows[] = [$table, $column, $sqliteSum, $mysqlSum, $status];
        }

        $this->newLine();
        $this->info('Somatorios financeiros e fretes');
        $this->table(['Tabela', 'Campo', 'SQLite', 'MySQL', 'Status'], $rows);

        return $diffs;
    }

    private function renderGroupedChecks(PDO $sqlite, string $mysqlConnection): int
    {
        $checks = [
            ['pagamentos', 'unidade_id'],
            ['colaboradores', 'unidade_id'],
            ['freight_entries', 'unidade_id'],
            ['freight_spot_entries', 'unidade_origem_id'],
            ['multas', 'unidade_id'],
            ['programacao_viagens', 'unidade_id'],
            ['pagamentos', 'competencia_ano, competencia_mes'],
            ['freight_entries', "strftime('%Y-%m', data)"],
            ['multas', "strftime('%Y-%m', data)"],
        ];

        $rows = [];
        $diffs = 0;

        foreach ($checks as [$table, $group]) {
            if (! in_array($table, $this->sqliteTables($sqlite), true)) {
                continue;
            }

            $sqliteGroups = $this->sqliteGroupedCounts($sqlite, $table, $group);
            $mysqlGroup = str_contains($group, 'strftime')
                ? str_replace("strftime('%Y-%m', ", 'DATE_FORMAT(', str_replace(')', ", '%Y-%m')", $group))
                : $group;
            $mysqlGroups = $this->mysqlGroupedCounts($mysqlConnection, $table, $mysqlGroup);
            $status = $sqliteGroups === $mysqlGroups ? 'OK' : 'DIFERENTE';

            if ($status !== 'OK') {
                $diffs++;
            }

            $rows[] = [$table, $group, count($sqliteGroups), count($mysqlGroups), $status];
        }

        $this->newLine();
        $this->info('Contagens por unidade/mes');
        $this->table(['Tabela', 'Grupo', 'Grupos SQLite', 'Grupos MySQL', 'Status'], $rows);

        return $diffs;
    }

    private function renderOrphanChecks(string $mysqlConnection): int
    {
        $database = (string) config("database.connections.{$mysqlConnection}.database");
        $foreignKeys = DB::connection($mysqlConnection)->select(
            'SELECT table_name, column_name, referenced_table_name, referenced_column_name
             FROM information_schema.key_column_usage
             WHERE table_schema = ? AND referenced_table_name IS NOT NULL
             ORDER BY table_name, column_name',
            [$database],
        );

        $rows = [];
        $diffs = 0;

        foreach ($foreignKeys as $foreignKey) {
            $fk = (array) $foreignKey;
            $table = (string) $fk['table_name'];
            $column = (string) $fk['column_name'];
            $referencedTable = (string) $fk['referenced_table_name'];
            $referencedColumn = (string) $fk['referenced_column_name'];
            $count = DB::connection($mysqlConnection)->table($table)
                ->leftJoin($referencedTable, "{$table}.{$column}", '=', "{$referencedTable}.{$referencedColumn}")
                ->whereNotNull("{$table}.{$column}")
                ->whereNull("{$referencedTable}.{$referencedColumn}")
                ->count();

            if ($count > 0) {
                $diffs++;
            }

            $rows[] = [$table, $column, $referencedTable.'.'.$referencedColumn, $count, $count === 0 ? 'OK' : 'ORFAOS'];
        }

        $this->newLine();
        $this->info('Registros orfaos em foreign keys no MySQL');
        $this->table(['Tabela', 'Coluna', 'Referencia', 'Orfaos', 'Status'], $rows);

        return $diffs;
    }

    /**
     * @param array<int, string> $tables
     */
    private function renderLastDates(PDO $sqlite, string $mysqlConnection, array $tables): int
    {
        $rows = [];
        $diffs = 0;

        foreach ($tables as $table) {
            $columns = array_keys($this->sqliteColumns($sqlite, $table));
            $dateColumn = collect(['updated_at', 'created_at', 'data', 'data_pagamento', 'data_viagem'])
                ->first(fn (string $column): bool => in_array($column, $columns, true));

            if (! $dateColumn || ! $this->mysqlHasColumn($mysqlConnection, $table, $dateColumn)) {
                continue;
            }

            $sqliteMax = $this->sqliteScalar($sqlite, $table, 'MAX("'.$dateColumn.'")');
            $mysqlMax = DB::connection($mysqlConnection)->table($table)->max($dateColumn);
            $status = (string) $sqliteMax === (string) $mysqlMax ? 'OK' : 'DIFERENTE';

            if ($status !== 'OK') {
                $diffs++;
            }

            $rows[] = [$table, $dateColumn, $sqliteMax, $mysqlMax, $status];
        }

        $this->newLine();
        $this->info('Ultimas datas por tabela');
        $this->table(['Tabela', 'Campo', 'SQLite', 'MySQL', 'Status'], $rows);

        return $diffs;
    }

    private function renderMigrationMetadata(PDO $sqlite, string $mysqlConnection): int
    {
        if (! in_array('migrations', $this->sqliteTables($sqlite), true) || ! in_array('migrations', $this->mysqlTables($mysqlConnection), true)) {
            $this->newLine();
            $this->info('Metadados de migrations');
            $this->warn('Tabela migrations ausente em uma das origens.');

            return 1;
        }

        $sqliteMigrations = $sqlite
            ->query('SELECT migration FROM '.$this->sqliteQuote('migrations').' ORDER BY migration')
            ->fetchAll(PDO::FETCH_COLUMN);
        $mysqlMigrations = DB::connection($mysqlConnection)
            ->table('migrations')
            ->orderBy('migration')
            ->pluck('migration')
            ->all();

        $onlySqlite = array_values(array_diff($sqliteMigrations, $mysqlMigrations));
        $onlyMysql = array_values(array_diff($mysqlMigrations, $sqliteMigrations));
        $metadataDiffs = count($onlySqlite) + count($onlyMysql);
        $impact = $metadataDiffs === 0
            ? 'OK'
            : 'METADADO: validar se sao migrations de indice/paridade; nao altera comparacao operacional.';

        $this->newLine();
        $this->info('Metadados de migrations');
        $this->table(
            ['Origem', 'Total', 'Somente nesta origem'],
            [
                ['SQLite', count($sqliteMigrations), count($onlySqlite)],
                ['MySQL', count($mysqlMigrations), count($onlyMysql)],
            ],
        );

        if ($onlySqlite !== []) {
            $this->warn('Migrations presentes so no SQLite:');
            foreach ($onlySqlite as $migration) {
                $this->line(' - '.$migration);
            }
        }

        if ($onlyMysql !== []) {
            $this->warn('Migrations presentes so no MySQL:');
            foreach ($onlyMysql as $migration) {
                $this->line(' - '.$migration);
            }
        }

        $this->line('Impacto provavel: '.$impact);

        return $metadataDiffs;
    }

    /**
     * @return array<int, string>
     */
    private function sqliteTables(PDO $sqlite): array
    {
        return $sqlite->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            ->fetchAll(PDO::FETCH_COLUMN);
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

    private function sqliteCount(PDO $sqlite, string $table): int
    {
        return (int) $sqlite->query('SELECT COUNT(*) FROM '.$this->sqliteQuote($table))->fetchColumn();
    }

    private function sqliteScalar(PDO $sqlite, string $table, string $expression): mixed
    {
        return $sqlite->query("SELECT {$expression} FROM ".$this->sqliteQuote($table))->fetchColumn();
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function sqliteColumns(PDO $sqlite, string $table): array
    {
        $columns = [];
        $rows = $sqlite->query('PRAGMA table_info('.$this->sqliteQuote($table).')')->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rows as $row) {
            $columns[(string) $row['name']] = $row;
        }

        return $columns;
    }

    private function sqliteHasColumn(PDO $sqlite, string $table, string $column): bool
    {
        return array_key_exists($column, $this->sqliteColumns($sqlite, $table));
    }

    private function mysqlHasColumn(string $connection, string $table, string $column): bool
    {
        $database = (string) config("database.connections.{$connection}.database");

        return (int) DB::connection($connection)->table('information_schema.columns')
            ->where('table_schema', $database)
            ->where('table_name', $table)
            ->where('column_name', $column)
            ->count() > 0;
    }

    /**
     * @return array<string, int>
     */
    private function sqliteGroupedCounts(PDO $sqlite, string $table, string $group): array
    {
        $rows = $sqlite->query("SELECT {$group} as group_key, COUNT(*) as total FROM ".$this->sqliteQuote($table)." GROUP BY {$group} ORDER BY group_key")
            ->fetchAll(PDO::FETCH_ASSOC);

        return collect($rows)->mapWithKeys(fn (array $row): array => [(string) ($row['group_key'] ?? '') => (int) $row['total']])->all();
    }

    /**
     * @return array<string, int>
     */
    private function mysqlGroupedCounts(string $connection, string $table, string $group): array
    {
        try {
            $rows = DB::connection($connection)->select("SELECT {$group} as group_key, COUNT(*) as total FROM `{$table}` GROUP BY {$group} ORDER BY group_key");
        } catch (Throwable) {
            return [];
        }

        return collect($rows)->mapWithKeys(fn (object $row): array => [(string) (((array) $row)['group_key'] ?? '') => (int) (((array) $row)['total'] ?? 0)])->all();
    }

    private function normalizeNumber(mixed $value): string
    {
        return number_format((float) $value, 2, '.', '');
    }

    private function sqliteQuote(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
    }
}
