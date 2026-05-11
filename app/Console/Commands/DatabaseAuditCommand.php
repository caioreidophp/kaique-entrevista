<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Throwable;

class DatabaseAuditCommand extends Command
{
    protected $signature = 'app:database-audit';

    protected $description = 'Lista informacoes de diagnostico do banco e storage sem alterar dados';

    public function handle(): int
    {
        $connectionName = config('database.default');
        $driver = DB::connection()->getDriverName();

        $this->info('Database audit - somente leitura');
        $this->line("Conexao atual: {$connectionName}");
        $this->line("Driver atual: {$driver}");

        $this->newLine();
        $this->renderSqliteInfo();

        $this->newLine();
        $this->renderTables($driver);

        $this->newLine();
        $this->renderMigrations();

        $this->newLine();
        $this->renderStorageInfo();

        return self::SUCCESS;
    }

    private function renderSqliteInfo(): void
    {
        $sqlitePath = (string) config('database.connections.sqlite.database');

        if ($sqlitePath === ':memory:') {
            $this->line('SQLite: :memory:');

            return;
        }

        $this->line("Caminho SQLite configurado: {$sqlitePath}");

        if (! is_file($sqlitePath)) {
            $this->warn('Arquivo SQLite nao encontrado nesse caminho.');

            return;
        }

        $this->line('Tamanho SQLite: '.$this->formatBytes((int) filesize($sqlitePath)));
        $this->line('Modificado em: '.date('Y-m-d H:i:s', (int) filemtime($sqlitePath)));
    }

    private function renderTables(string $driver): void
    {
        try {
            $tables = $this->tableNames($driver);
        } catch (Throwable $e) {
            $this->error('Nao foi possivel listar tabelas: '.$e->getMessage());

            return;
        }

        $rows = [];

        foreach ($tables as $table) {
            try {
                $rows[] = [$table, DB::table($table)->count()];
            } catch (Throwable $e) {
                $rows[] = [$table, 'erro: '.$e->getMessage()];
            }
        }

        $this->info('Tabelas e contagens');
        $this->table(['Tabela', 'Registros'], $rows);
    }

    /**
     * @return array<int, string>
     */
    private function tableNames(string $driver): array
    {
        if ($driver === 'sqlite') {
            return collect(DB::select(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            ))
                ->map(fn (object $row): string => (string) ((array) $row)['name'])
                ->values()
                ->all();
        }

        $database = (string) config("database.connections.{$driver}.database");

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            return collect(DB::select('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"'))
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

        return collect(Schema::getTables())
            ->map(fn (array $table): string => (string) ($table['name'] ?? $table['schema_qualified_name'] ?? ''))
            ->filter()
            ->sort()
            ->values()
            ->all();
    }

    private function renderMigrations(): void
    {
        $migrationFiles = collect(glob(database_path('migrations/*.php')) ?: [])
            ->map(fn (string $path): string => basename($path, '.php'))
            ->sort()
            ->values();

        if (! Schema::hasTable('migrations')) {
            $this->warn('Tabela migrations nao encontrada.');
            $this->line('Arquivos de migration no projeto: '.$migrationFiles->count());

            return;
        }

        $applied = DB::table('migrations')
            ->orderBy('migration')
            ->pluck('migration')
            ->map(fn (string $migration): string => $migration)
            ->values();

        $appliedWithoutFile = $applied->diff($migrationFiles)->values();
        $filesNotApplied = $migrationFiles->diff($applied)->values();

        $this->info('Migrations');
        $this->line('Aplicadas no banco: '.$applied->count());
        $this->line('Arquivos no projeto: '.$migrationFiles->count());

        $this->newLine();
        $this->line('Aplicadas sem arquivo correspondente: '.$appliedWithoutFile->count());
        foreach ($appliedWithoutFile as $migration) {
            $this->warn(' - '.$migration);
        }

        $this->newLine();
        $this->line('Arquivos ainda nao aplicados: '.$filesNotApplied->count());
        foreach ($filesNotApplied as $migration) {
            $this->line(' - '.$migration);
        }
    }

    private function renderStorageInfo(): void
    {
        $this->info('Storage');
        $rows = [];

        foreach (['app/public', 'app/private'] as $relativePath) {
            $path = storage_path($relativePath);
            [$files, $bytes] = $this->directoryStats($path);
            $rows[] = [$relativePath, $path, $files, $this->formatBytes($bytes)];
        }

        $this->table(['Diretorio', 'Caminho', 'Arquivos', 'Tamanho'], $rows);
    }

    /**
     * @return array{0: int, 1: int}
     */
    private function directoryStats(string $path): array
    {
        if (! is_dir($path)) {
            return [0, 0];
        }

        $files = 0;
        $bytes = 0;
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($path, RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $item) {
            if (! $item->isFile()) {
                continue;
            }

            $files++;
            $bytes += (int) $item->getSize();
        }

        return [$files, $bytes];
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes < 1024) {
            return "{$bytes} B";
        }

        $units = ['KB', 'MB', 'GB', 'TB'];
        $value = $bytes / 1024;

        foreach ($units as $unit) {
            if ($value < 1024) {
                return number_format($value, 2, ',', '.').' '.$unit;
            }

            $value /= 1024;
        }

        return number_format($value, 2, ',', '.').' PB';
    }
}
