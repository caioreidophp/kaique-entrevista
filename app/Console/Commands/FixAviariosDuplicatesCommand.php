<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use PDO;
use Throwable;

class FixAviariosDuplicatesCommand extends Command
{
    protected $signature = 'app:fix-aviarios-duplicates
        {--dry-run : Simula a correcao sem alterar dados}
        {--confirm : Executa a correcao depois das validacoes e backup}
        {--sqlite=database/database.sqlite : Caminho do SQLite}
        {--report=storage/app/private/migration-reports/aviarios-duplicates-fix.md : Caminho do relatorio Markdown}';

    protected $description = 'Corrige ou simula a mesclagem segura dos aviarios duplicados antes da migracao para MySQL';

    /**
     * @var array<int, array{keep: int, duplicate: int, reason: string}>
     */
    private array $pairs = [
        ['keep' => 5, 'duplicate' => 49, 'reason' => 'Manter nome acentuado/capitalizado: Dalmo Jose Bueno'],
        ['keep' => 7, 'duplicate' => 80, 'reason' => 'Manter nome acentuado/capitalizado: Jose Ademir Dariolli'],
        ['keep' => 17, 'duplicate' => 54, 'reason' => 'Manter nome acentuado/capitalizado: Edi Marcio Dariolli'],
    ];

    /**
     * @var array<int, array{id: int, nome: string, cidade: string, km: string}>
     */
    private array $expectedRows = [
        ['id' => 5, 'nome' => 'Dalmo José Bueno', 'cidade' => 'Amparo/SP', 'km' => '28'],
        ['id' => 49, 'nome' => 'DALMO JOSE BUENO', 'cidade' => 'Amparo/SP', 'km' => '28'],
        ['id' => 7, 'nome' => 'José Ademir Dariolli', 'cidade' => 'Amparo/SP', 'km' => '16'],
        ['id' => 80, 'nome' => 'JOSE ADEMIR DARIOLLI', 'cidade' => 'Amparo/SP', 'km' => '16'],
        ['id' => 17, 'nome' => 'Edi Márcio Dariolli', 'cidade' => 'Amparo/SP', 'km' => '17'],
        ['id' => 54, 'nome' => 'EDI MARCIO DARIOLLI', 'cidade' => 'Amparo/SP', 'km' => '17'],
    ];

    /**
     * @var array<string, array<int, string>>
     */
    private array $knownTextReferences = [
        'freight_canceled_loads' => ['aviario'],
        'programacao_viagens' => ['aviario', 'origem'],
    ];

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $confirmed = (bool) $this->option('confirm');

        if ($dryRun === $confirmed) {
            $this->error('Informe exatamente um modo: --dry-run para simular ou --confirm para executar.');
            $this->line('Seguro: php artisan app:fix-aviarios-duplicates --dry-run');
            $this->line('Executar: php artisan app:fix-aviarios-duplicates --confirm');

            return self::FAILURE;
        }

        $sqlitePath = $this->resolvePath((string) $this->option('sqlite'));

        if (! is_file($sqlitePath)) {
            $this->error("SQLite nao encontrado: {$sqlitePath}");

            return self::FAILURE;
        }

        $pdo = new PDO('sqlite:'.$sqlitePath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $report = [];
        $this->info($dryRun ? 'DRY RUN - nenhuma alteracao sera feita.' : 'EXECUCAO CONFIRMADA - backup e transacao obrigatorios.');
        $this->line("SQLite analisado: {$sqlitePath}");
        $this->newLine();

        $foreignKeys = $this->foreignKeysToAviarios($pdo);
        $aviarioIdColumns = $this->columnsNamed($pdo, 'aviario_id');

        $this->renderRelationshipDiscovery($foreignKeys, $aviarioIdColumns);
        $report[] = '# Relatorio de correcao de aviarios duplicados';
        $report[] = '';
        $report[] = 'Gerado em: '.date('Y-m-d H:i:s');
        $report[] = '';
        $report[] = '- SQLite: `'.$sqlitePath.'`';
        $report[] = '- Modo: '.($dryRun ? 'dry-run' : 'confirmado');
        $report[] = '- Foreign keys para aviarios.id: '.count($foreignKeys);
        $report[] = '- Colunas aviario_id: '.count($aviarioIdColumns);
        $report[] = '';

        $validationErrors = $this->validateExpectedRows($pdo);

        if ($foreignKeys !== [] || $aviarioIdColumns !== []) {
            $validationErrors[] = 'Foram encontradas referencias por ID para aviarios. A correcao automatica foi abortada.';
        }

        if ($validationErrors !== []) {
            foreach ($validationErrors as $validationError) {
                $this->error($validationError);
                $report[] = '- ERRO: '.$validationError;
            }

            $this->writeReport($report);

            return self::FAILURE;
        }

        foreach ($this->pairs as $pair) {
            $this->renderPair($pdo, $pair, $report);
        }

        if ($dryRun) {
            $this->newLine();
            $this->warn('Plano simulado: atualizar referencias textuais exatas do duplicado para o principal, validar colisao unique e so entao remover/arquivar o duplicado.');
            $this->warn('Nada foi gravado no banco.');
            $this->writeReport($report);

            return self::SUCCESS;
        }

        $backupPath = $this->backupSqlite($sqlitePath);
        $this->info("Backup criado antes da alteracao: {$backupPath}");
        $report[] = '';
        $report[] = '## Backup';
        $report[] = '';
        $report[] = '- `'.$backupPath.'`';

        $executionReport = $this->executeFix($pdo);
        foreach ($executionReport as $line) {
            $this->line($line);
            $report[] = '- '.$line;
        }

        $remaining = $this->remainingDuplicateCount($pdo);
        if ($remaining > 0) {
            $this->error("Ainda existem {$remaining} duplicados esperados apos a transacao.");
            $report[] = '- ERRO: duplicados restantes: '.$remaining;
            $this->writeReport($report);

            return self::FAILURE;
        }

        $this->newLine();
        $this->info('Correcao concluida. Os duplicados 49, 80 e 54 foram removidos apos backup e validacoes.');
        $this->writeReport($report);

        return self::SUCCESS;
    }

    private function resolvePath(string $path): string
    {
        if (! str_starts_with($path, DIRECTORY_SEPARATOR) && ! preg_match('/^[A-Za-z]:[\\\\\\/]/', $path)) {
            return base_path($path);
        }

        return $path;
    }

    /**
     * @return array<int, array{table: string, column: string, from: string, to: string}>
     */
    private function foreignKeysToAviarios(PDO $pdo): array
    {
        $matches = [];

        foreach ($this->tables($pdo) as $table) {
            $rows = $pdo->query('PRAGMA foreign_key_list('.$this->quote($table).')')->fetchAll(PDO::FETCH_ASSOC);

            foreach ($rows as $row) {
                if (($row['table'] ?? null) === 'aviarios' && ($row['to'] ?? null) === 'id') {
                    $matches[] = [
                        'table' => $table,
                        'column' => (string) $row['from'],
                        'from' => (string) $row['from'],
                        'to' => (string) $row['to'],
                    ];
                }
            }
        }

        return $matches;
    }

    /**
     * @return array<int, array{table: string, column: string}>
     */
    private function columnsNamed(PDO $pdo, string $columnName): array
    {
        $matches = [];

        foreach ($this->tables($pdo) as $table) {
            foreach ($this->columns($pdo, $table) as $column) {
                if (strtolower($column['name']) === strtolower($columnName)) {
                    $matches[] = ['table' => $table, 'column' => $column['name']];
                }
            }
        }

        return $matches;
    }

    /**
     * @param array<int, array{table: string, column: string, from: string, to: string}> $foreignKeys
     * @param array<int, array{table: string, column: string}> $aviarioIdColumns
     */
    private function renderRelationshipDiscovery(array $foreignKeys, array $aviarioIdColumns): void
    {
        $this->line('Descoberta de relacoes:');

        if ($foreignKeys === []) {
            $this->line('- Foreign keys formais para aviarios.id: nenhuma encontrada.');
        } else {
            foreach ($foreignKeys as $foreignKey) {
                $this->line("- FK formal: {$foreignKey['table']}.{$foreignKey['column']} -> aviarios.id");
            }
        }

        if ($aviarioIdColumns === []) {
            $this->line('- Colunas provaveis aviario_id sem FK: nenhuma encontrada.');
        } else {
            foreach ($aviarioIdColumns as $column) {
                $this->line("- Coluna provavel: {$column['table']}.{$column['column']}");
            }
        }
    }

    /**
     * @param array{keep: int, duplicate: int, reason: string} $pair
     */
    private function renderPair(PDO $pdo, array $pair, array &$report): void
    {
        $keep = $this->aviario($pdo, $pair['keep']);
        $duplicate = $this->aviario($pdo, $pair['duplicate']);

        $this->newLine();
        $this->line("Par {$pair['keep']} <- {$pair['duplicate']}");
        $report[] = '## Par '.$pair['keep'].' <- '.$pair['duplicate'];
        $report[] = '';

        if ($keep === null || $duplicate === null) {
            $this->error('Um dos registros do par nao foi encontrado. A simulacao foi interrompida para este par.');
            $report[] = '- ERRO: um dos registros nao foi encontrado.';

            return;
        }

        $this->table(
            ['papel', 'id', 'nome', 'cidade', 'km', 'created_at', 'updated_at'],
            [
                ['principal', $keep['id'], $keep['nome'], $keep['cidade'], $keep['km'] ?? 'NULL', $keep['created_at'], $keep['updated_at']],
                ['duplicado', $duplicate['id'], $duplicate['nome'], $duplicate['cidade'], $duplicate['km'] ?? 'NULL', $duplicate['created_at'], $duplicate['updated_at']],
            ]
        );

        $exactReferences = $this->exactTextReferenceCounts($pdo, (string) $duplicate['nome']);
        $normalizedReferences = $this->normalizedTextReferenceCounts($pdo, (string) $duplicate['nome']);
        $normalizedValues = $this->normalizedTextReferenceValues($pdo, (string) $duplicate['nome']);
        $probableIdReferences = $this->idReferenceCounts($pdo, (int) $duplicate['id']);
        $differences = $this->fieldDifferences($keep, $duplicate);

        $this->line('Criterio do principal: '.$pair['reason']);
        $this->line('Diferencas relevantes: '.($differences === [] ? 'somente id/nome com acento ou caixa' : implode('; ', $differences)));
        $this->line('Classificacao sugerida: A - duplicado real, seguro mesclar apos aprovacao humana e backup.');

        $this->line('Referencias exatas ao nome duplicado: '.$this->formatCounts($exactReferences));
        $this->line('Referencias normalizadas ao nome duplicado: '.$this->formatCounts($normalizedReferences));
        $this->line('Valores textuais normalizados encontrados: '.$this->formatValueCounts($normalizedValues));
        $this->line('Referencias por aviario_id duplicado: '.$this->formatCounts($probableIdReferences));

        $affected = array_sum($exactReferences) + array_sum($probableIdReferences);
        $this->line("Simulacao: atualizar {$affected} referencia(s) direta(s) e remover/arquivar o aviario duplicado id {$pair['duplicate']} somente depois da validacao.");

        $report[] = '- Principal: `'.$keep['id'].'` '.$keep['nome'].' / '.$keep['cidade'].' / km '.$keep['km'];
        $report[] = '- Duplicado: `'.$duplicate['id'].'` '.$duplicate['nome'].' / '.$duplicate['cidade'].' / km '.$duplicate['km'];
        $report[] = '- Diferencas relevantes: '.($differences === [] ? 'somente id/nome com acento ou caixa' : implode('; ', $differences));
        $report[] = '- Referencias textuais exatas ao duplicado: '.$this->formatCounts($exactReferences);
        $report[] = '- Referencias textuais normalizadas: '.$this->formatCounts($normalizedReferences);
        $report[] = '- Valores textuais normalizados: '.$this->formatValueCounts($normalizedValues);
        $report[] = '- Referencias por aviario_id: '.$this->formatCounts($probableIdReferences);
        $report[] = '- Acao planejada: atualizar '.$affected.' referencia(s) direta(s) e remover/arquivar o duplicado depois da validacao.';
        $report[] = '';
    }

    /**
     * @return array<int, string>
     */
    private function validateExpectedRows(PDO $pdo): array
    {
        $errors = [];

        foreach ($this->expectedRows as $expected) {
            $row = $this->aviario($pdo, $expected['id']);

            if ($row === null) {
                $errors[] = "Aviario esperado nao encontrado: id {$expected['id']}.";

                continue;
            }

            foreach (['nome', 'cidade'] as $field) {
                if ((string) $row[$field] !== $expected[$field]) {
                    $errors[] = "Aviario {$expected['id']} com {$field} inesperado: {$row[$field]}.";
                }
            }

            if ((string) (0 + (float) ($row['km'] ?? 0)) !== (string) (0 + (float) $expected['km'])) {
                $errors[] = "Aviario {$expected['id']} com km inesperado: ".($row['km'] ?? 'NULL').'.';
            }
        }

        foreach ($this->pairs as $pair) {
            $idReferences = $this->idReferenceCounts($pdo, $pair['duplicate']);

            if ($idReferences !== []) {
                $errors[] = "Duplicado {$pair['duplicate']} possui referencias por ID: ".$this->formatCounts($idReferences);
            }
        }

        return $errors;
    }

    private function backupSqlite(string $sqlitePath): string
    {
        $backupDir = storage_path('app/private/migration-backups/'.date('Ymd-His').'-aviarios-fix');

        if (! is_dir($backupDir) && ! mkdir($backupDir, 0775, true)) {
            throw new \RuntimeException('Nao foi possivel criar pasta de backup.');
        }

        $target = $backupDir.'/database.sqlite';

        if (! copy($sqlitePath, $target)) {
            throw new \RuntimeException('Falha ao copiar backup do SQLite.');
        }

        return $target;
    }

    /**
     * @return array<int, string>
     */
    private function executeFix(PDO $pdo): array
    {
        $report = [];
        $pdo->beginTransaction();

        try {
            foreach ($this->pairs as $pair) {
                $keep = $this->aviario($pdo, $pair['keep']);
                $duplicate = $this->aviario($pdo, $pair['duplicate']);

                if ($keep === null || $duplicate === null) {
                    throw new \RuntimeException("Par {$pair['keep']} <- {$pair['duplicate']} incompleto.");
                }

                foreach ($this->knownTextReferences as $table => $columns) {
                    foreach ($columns as $column) {
                        if (! $this->tableHasColumn($pdo, $table, $column)) {
                            continue;
                        }

                        $stmt = $pdo->prepare(
                            'UPDATE '.$this->quote($table)
                            .' SET '.$this->quote($column).' = :keep'
                            .' WHERE '.$this->quote($column).' = :duplicate'
                        );
                        $stmt->execute([
                            'keep' => (string) $keep['nome'],
                            'duplicate' => (string) $duplicate['nome'],
                        ]);

                        $affected = $stmt->rowCount();
                        if ($affected > 0) {
                            $report[] = "{$table}.{$column}: {$affected} texto(s) atualizado(s) de duplicado {$pair['duplicate']} para principal {$pair['keep']}";
                        }
                    }
                }

                $stmt = $pdo->prepare('DELETE FROM '.$this->quote('aviarios').' WHERE '.$this->quote('id').' = :id');
                $stmt->execute(['id' => $pair['duplicate']]);
                $deleted = $stmt->rowCount();

                if ($deleted !== 1) {
                    throw new \RuntimeException("Duplicado {$pair['duplicate']} nao foi removido exatamente uma vez.");
                }

                $report[] = "aviarios: duplicado {$pair['duplicate']} removido; principal {$pair['keep']} mantido";
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();

            throw $e;
        }

        return $report;
    }

    private function remainingDuplicateCount(PDO $pdo): int
    {
        $ids = collect($this->pairs)->pluck('duplicate')->all();
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM '.$this->quote('aviarios').' WHERE '.$this->quote('id').' IN ('.$placeholders.')');
        $stmt->execute($ids);

        return (int) $stmt->fetchColumn();
    }

    /**
     * @param array<int, string> $lines
     */
    private function writeReport(array $lines): void
    {
        $path = $this->resolvePath((string) $this->option('report'));
        $dir = dirname($path);

        if (! is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        file_put_contents($path, implode(PHP_EOL, $lines).PHP_EOL);
        $this->line("Relatorio: {$path}");
    }

    /**
     * @return array<string, mixed>|null
     */
    private function aviario(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare('SELECT * FROM '.$this->quote('aviarios').' WHERE '.$this->quote('id').' = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    /**
     * @return array<string, int>
     */
    private function exactTextReferenceCounts(PDO $pdo, string $name): array
    {
        $counts = [];

        foreach ($this->knownTextReferences as $table => $columns) {
            foreach ($columns as $column) {
                if (! $this->tableHasColumn($pdo, $table, $column)) {
                    continue;
                }

                $stmt = $pdo->prepare('SELECT COUNT(*) FROM '.$this->quote($table).' WHERE '.$this->quote($column).' = :value');
                $stmt->execute(['value' => $name]);
                $count = (int) $stmt->fetchColumn();

                if ($count > 0) {
                    $counts["{$table}.{$column}"] = $count;
                }
            }
        }

        return $counts;
    }

    /**
     * @return array<string, int>
     */
    private function normalizedTextReferenceCounts(PDO $pdo, string $name): array
    {
        $counts = [];
        $needle = $this->normalize($name);

        foreach ($this->knownTextReferences as $table => $columns) {
            foreach ($columns as $column) {
                if (! $this->tableHasColumn($pdo, $table, $column)) {
                    continue;
                }

                $rows = $pdo->query('SELECT '.$this->quote($column).' AS value FROM '.$this->quote($table).' WHERE '.$this->quote($column).' IS NOT NULL')->fetchAll(PDO::FETCH_ASSOC);
                $count = 0;

                foreach ($rows as $row) {
                    if ($this->normalize((string) $row['value']) === $needle) {
                        $count++;
                    }
                }

                if ($count > 0) {
                    $counts["{$table}.{$column}"] = $count;
                }
            }
        }

        return $counts;
    }

    /**
     * @return array<string, array<string, int>>
     */
    private function normalizedTextReferenceValues(PDO $pdo, string $name): array
    {
        $counts = [];
        $needle = $this->normalize($name);

        foreach ($this->knownTextReferences as $table => $columns) {
            foreach ($columns as $column) {
                if (! $this->tableHasColumn($pdo, $table, $column)) {
                    continue;
                }

                $rows = $pdo->query('SELECT '.$this->quote($column).' AS value FROM '.$this->quote($table).' WHERE '.$this->quote($column).' IS NOT NULL')->fetchAll(PDO::FETCH_ASSOC);

                foreach ($rows as $row) {
                    $value = (string) $row['value'];

                    if ($this->normalize($value) !== $needle) {
                        continue;
                    }

                    $location = "{$table}.{$column}";
                    $counts[$location][$value] = ($counts[$location][$value] ?? 0) + 1;
                }
            }
        }

        return $counts;
    }

    /**
     * @return array<string, int>
     */
    private function idReferenceCounts(PDO $pdo, int $id): array
    {
        $counts = [];

        foreach ($this->columnsNamed($pdo, 'aviario_id') as $column) {
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM '.$this->quote($column['table']).' WHERE '.$this->quote($column['column']).' = :id');
            $stmt->execute(['id' => $id]);
            $count = (int) $stmt->fetchColumn();

            if ($count > 0) {
                $counts[$column['table'].'.'.$column['column']] = $count;
            }
        }

        return $counts;
    }

    /**
     * @param array<string, mixed> $keep
     * @param array<string, mixed> $duplicate
     * @return array<int, string>
     */
    private function fieldDifferences(array $keep, array $duplicate): array
    {
        $differences = [];

        foreach ($keep as $field => $value) {
            if ($field === 'id' || $field === 'nome') {
                continue;
            }

            if (($duplicate[$field] ?? null) !== $value) {
                $differences[] = "{$field}: principal={$value}, duplicado=".($duplicate[$field] ?? 'NULL');
            }
        }

        return $differences;
    }

    /**
     * @param array<string, int> $counts
     */
    private function formatCounts(array $counts): string
    {
        if ($counts === []) {
            return 'nenhuma encontrada';
        }

        $parts = [];
        foreach ($counts as $location => $count) {
            $parts[] = "{$location}={$count}";
        }

        return implode(', ', $parts);
    }

    /**
     * @param array<string, array<string, int>> $counts
     */
    private function formatValueCounts(array $counts): string
    {
        if ($counts === []) {
            return 'nenhum valor textual encontrado';
        }

        $locations = [];

        foreach ($counts as $location => $values) {
            $parts = [];

            foreach ($values as $value => $count) {
                $parts[] = "'{$value}'={$count}";
            }

            $locations[] = "{$location}: ".implode(', ', $parts);
        }

        return implode('; ', $locations);
    }

    /**
     * @return array<int, string>
     */
    private function tables(PDO $pdo): array
    {
        return $pdo
            ->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            ->fetchAll(PDO::FETCH_COLUMN);
    }

    /**
     * @return array<int, array{name: string, type: string}>
     */
    private function columns(PDO $pdo, string $table): array
    {
        return $pdo->query('PRAGMA table_info('.$this->quote($table).')')->fetchAll(PDO::FETCH_ASSOC);
    }

    private function tableHasColumn(PDO $pdo, string $table, string $column): bool
    {
        try {
            foreach ($this->columns($pdo, $table) as $candidate) {
                if ($candidate['name'] === $column) {
                    return true;
                }
            }
        } catch (Throwable) {
            return false;
        }

        return false;
    }

    private function normalize(string $value): string
    {
        $text = trim($value);
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
        $text = class_exists(\Normalizer::class)
            ? \Normalizer::normalize($text, \Normalizer::FORM_D)
            : $text;
        $text = preg_replace('/\p{Mn}+/u', '', $text) ?? $text;

        return mb_strtolower($text, 'UTF-8');
    }

    private function quote(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
    }
}
