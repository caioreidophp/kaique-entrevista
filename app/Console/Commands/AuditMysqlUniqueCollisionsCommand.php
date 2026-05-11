<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use PDO;
use Throwable;

class AuditMysqlUniqueCollisionsCommand extends Command
{
    protected $signature = 'app:audit-mysql-unique-collisions
        {--sqlite=database/database.sqlite : Caminho do SQLite}
        {--report=MIGRACAO_MYSQL_COLISOES_UNIQUE.md : Caminho do relatorio Markdown}';

    protected $description = 'Audita colisoes de unique do SQLite sob normalizacao parecida com MySQL/MariaDB';

    /**
     * @var array<int, array<string, mixed>>
     */
    private array $collisions = [];

    public function handle(): int
    {
        $sqlitePath = $this->resolvePath((string) $this->option('sqlite'));
        $reportPath = $this->resolvePath((string) $this->option('report'));

        if (! is_file($sqlitePath)) {
            $this->error("SQLite nao encontrado: {$sqlitePath}");

            return self::FAILURE;
        }

        $pdo = new PDO('sqlite:'.$sqlitePath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $uniqueIndexes = $this->uniqueIndexes($pdo);

        foreach ($uniqueIndexes as $index) {
            $this->auditIndex($pdo, $index);
        }

        $this->writeReport($pdo, $reportPath, $uniqueIndexes);

        $this->info('Auditoria concluida.');
        $this->line('Indices unique analisados: '.count($uniqueIndexes));
        $this->line('Colisoes encontradas: '.count($this->collisions));
        $this->line("Relatorio: {$reportPath}");

        if ($this->collisions !== []) {
            $summary = collect($this->collisions)
                ->groupBy('table')
                ->map(fn ($items, string $table): array => [$table, $items->count()])
                ->values()
                ->all();
            $this->table(['Tabela', 'Colisoes'], $summary);
        }

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
     * @return array<int, array{table: string, index: string, columns: array<int, string>}>
     */
    private function uniqueIndexes(PDO $pdo): array
    {
        $tables = $pdo
            ->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            ->fetchAll(PDO::FETCH_COLUMN);

        $indexes = [];

        foreach ($tables as $table) {
            $indexRows = $pdo->query('PRAGMA index_list('.$this->quote($table).')')->fetchAll(PDO::FETCH_ASSOC);

            foreach ($indexRows as $indexRow) {
                if ((int) $indexRow['unique'] !== 1) {
                    continue;
                }

                $columnRows = $pdo->query('PRAGMA index_info('.$this->quote((string) $indexRow['name']).')')->fetchAll(PDO::FETCH_ASSOC);
                $columns = array_values(array_filter(array_map(fn (array $row): string => (string) $row['name'], $columnRows)));

                if ($columns === []) {
                    continue;
                }

                $indexes[] = [
                    'table' => (string) $table,
                    'index' => (string) $indexRow['name'],
                    'columns' => $columns,
                ];
            }
        }

        return $indexes;
    }

    /**
     * @param array{table: string, index: string, columns: array<int, string>} $index
     */
    private function auditIndex(PDO $pdo, array $index): void
    {
        $table = $index['table'];
        $columns = $index['columns'];
        $selectColumns = array_unique(array_merge(['id'], $columns, ['created_at', 'updated_at']));
        $availableColumns = array_keys($this->columns($pdo, $table));
        $selectColumns = array_values(array_intersect($selectColumns, $availableColumns));
        $sql = 'SELECT '.implode(', ', array_map(fn (string $column): string => $this->quote($column), $selectColumns))
            .' FROM '.$this->quote($table);
        $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
        $groups = [];

        foreach ($rows as $row) {
            $parts = [];
            $hasNull = false;

            foreach ($columns as $column) {
                $value = $row[$column] ?? null;

                if ($value === null) {
                    $hasNull = true;
                }

                $parts[] = $this->normalizeValue($value);
            }

            if ($hasNull) {
                continue;
            }

            $key = implode(' | ', $parts);
            $groups[$key][] = $row;
        }

        foreach ($groups as $normalizedKey => $items) {
            if (count($items) <= 1) {
                continue;
            }

            $this->collisions[] = [
                'table' => $table,
                'index' => $index['index'],
                'columns' => $columns,
                'normalized' => $normalizedKey,
                'rows' => $items,
                'suggestion' => $this->suggestion($table, $columns, $items),
            ];
        }
    }

    private function normalizeValue(mixed $value): string
    {
        if ($value === null) {
            return '<NULL>';
        }

        $text = trim((string) $value);
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
        $text = class_exists(\Normalizer::class)
            ? \Normalizer::normalize($text, \Normalizer::FORM_D)
            : $text;
        $text = preg_replace('/\p{Mn}+/u', '', $text) ?? $text;
        $text = mb_strtolower($text, 'UTF-8');

        return $text;
    }

    /**
     * @param array<int, string> $columns
     * @param array<int, array<string, mixed>> $items
     */
    private function suggestion(string $table, array $columns, array $items): string
    {
        if ($table === 'aviarios') {
            return 'Decisao humana: confirmar se sao o mesmo aviario. Se forem o mesmo, mesclar/renomear com criterio antes da migracao; se forem entidades diferentes, tornar nome/cidade mais especificos.';
        }

        if (in_array('email', $columns, true)) {
            return 'Decisao humana: emails devem ser unicos; validar se contas/registros duplicados devem ser mesclados ou corrigidos.';
        }

        if (in_array('cpf_hash', $columns, true) || in_array('cpf', $columns, true)) {
            return 'Decisao humana obrigatoria: CPF/CPF hash duplicado pode representar pessoa duplicada ou erro cadastral.';
        }

        if (count($items) === 2) {
            return 'Revisar manualmente os dois registros e decidir entre padronizar valor, mesclar ou diferenciar o campo unico.';
        }

        return 'Revisar manualmente o grupo e corrigir os valores que colidem antes da migracao para MySQL.';
    }

    /**
     * @param array<int, array{table: string, index: string, columns: array<int, string>}> $uniqueIndexes
     */
    private function writeReport(PDO $pdo, string $reportPath, array $uniqueIndexes): void
    {
        $lines = [];
        $lines[] = '# Auditoria de colisoes unique para MySQL/MariaDB';
        $lines[] = '';
        $lines[] = 'Gerado em: '.date('Y-m-d H:i:s');
        $lines[] = '';
        $lines[] = '## Resumo geral';
        $lines[] = '';
        $lines[] = '- Indices unique analisados: '.count($uniqueIndexes);
        $lines[] = '- Colisoes encontradas: '.count($this->collisions);
        $lines[] = '- Banco analisado: `database/database.sqlite`';
        $lines[] = '- Nenhum dado foi alterado.';
        $lines[] = '';

        $byTable = collect($this->collisions)->groupBy('table');
        if ($this->collisions === []) {
            $lines[] = 'Nenhuma colisao foi encontrada com a normalizacao aplicada.';
            $lines[] = '';
        } else {
            $lines[] = 'Tabelas com colisao:';
            foreach ($byTable as $table => $items) {
                $lines[] = "- `{$table}`: ".$items->count().' grupo(s)';
            }
            $lines[] = '';
        }

        $lines[] = '## Indices unique analisados';
        $lines[] = '';
        foreach ($uniqueIndexes as $index) {
            $lines[] = '- `'.$index['table'].'`.`'.$index['index'].'` (`'.implode('`, `', $index['columns']).'`)';
        }
        $lines[] = '';

        $lines[] = '## Colisoes encontradas';
        $lines[] = '';

        foreach ($this->collisions as $collision) {
            $lines[] = '### '.$collision['table'].' - '.$collision['index'];
            $lines[] = '';
            $lines[] = '- Colunas: `'.implode('`, `', $collision['columns']).'`';
            $lines[] = '- Valor normalizado: `'.$collision['normalized'].'`';
            $lines[] = '- Registros afetados: '.count($collision['rows']);
            $lines[] = '- Sugestao segura: '.$collision['suggestion'];
            $lines[] = '';
            $lines[] = '| id | valores originais | created_at | updated_at | relacoes |';
            $lines[] = '| --- | --- | --- | --- | --- |';

            foreach ($collision['rows'] as $row) {
                $values = [];
                foreach ($collision['columns'] as $column) {
                    $values[] = $column.'='.($row[$column] ?? 'NULL');
                }

                $relations = $collision['table'] === 'aviarios'
                    ? $this->aviarioRelations($pdo, $row)
                    : '-';

                $lines[] = '| '.($row['id'] ?? '-').' | '.str_replace('|', '\\|', implode('; ', $values)).' | '
                    .($row['created_at'] ?? '-').' | '.($row['updated_at'] ?? '-').' | '
                    .str_replace('|', '\\|', $relations).' |';
            }

            $lines[] = '';
        }

        $lines[] = '## Classificacao do caso aviarios';
        $lines[] = '';
        $lines[] = '- Tipo provavel: C/D.';
        $lines[] = '- C: erro de acento/caixa quando pares diferem apenas por acento, maiusculas/minusculas ou espacos.';
        $lines[] = '- D: ajuste manual no nome/cidade quando os nomes sao parecidos mas nao identicos apos normalizacao humana.';
        $lines[] = '- A decisao final precisa ser humana, porque `aviarios` e usado por texto em programacao/fretes e nao ha foreign key direta.';
        $lines[] = '';

        $lines[] = '## Risco por tabela';
        $lines[] = '';
        foreach ($byTable as $table => $items) {
            $risk = $table === 'aviarios' || $items->count() > 1 ? 'ALTO para migracao de dados' : 'MEDIO';
            $lines[] = "- `{$table}`: {$risk}.";
        }
        if ($this->collisions === []) {
            $lines[] = '- Nenhum risco de colisao unique encontrado pela auditoria.';
        }
        $lines[] = '';

        $lines[] = '## Plano de correcao recomendado';
        $lines[] = '';
        $lines[] = '1. Nao alterar collation nem remover unique como primeira opcao.';
        $lines[] = '2. Revisar cada grupo de colisao e decidir se sao duplicados reais ou entidades diferentes.';
        $lines[] = '3. Para duplicados reais, escolher um registro canonico e planejar mesclagem controlada.';
        $lines[] = '4. Para entidades diferentes, ajustar nome/cidade para ficarem inequivocos no MySQL.';
        $lines[] = '5. Repetir `app:audit-mysql-unique-collisions` ate zerar colisoes antes de nova migracao.';
        $lines[] = '';

        $lines[] = '## Correcoes automaticas versus humanas';
        $lines[] = '';
        $lines[] = '- Automaticas possiveis: padronizar espacos extras e caixa somente apos aprovacao e backup.';
        $lines[] = '- Exigem decisao humana: mesclar registros, alterar nomes de aviarios, emails, CPF/hash, placas e chaves de negocio.';
        $lines[] = '';

        $lines[] = '## Comandos seguros';
        $lines[] = '';
        $lines[] = '```bash';
        $lines[] = 'php artisan app:audit-mysql-unique-collisions --sqlite=database/database.sqlite';
        $lines[] = 'php artisan app:database-audit';
        $lines[] = '```';
        $lines[] = '';

        $lines[] = '## Comandos proibidos nesta fase';
        $lines[] = '';
        $lines[] = '```bash';
        $lines[] = 'php artisan migrate:fresh';
        $lines[] = 'php artisan migrate:refresh';
        $lines[] = 'php artisan db:wipe';
        $lines[] = 'php artisan migrate:rollback';
        $lines[] = '```';
        $lines[] = '';
        $lines[] = 'Tambem nao alterar `.env`, nao apagar `database/database.sqlite`, nao remover indices unique e nao corrigir dados sem aprovacao.';
        $lines[] = '';

        file_put_contents($reportPath, implode(PHP_EOL, $lines).PHP_EOL);
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function columns(PDO $pdo, string $table): array
    {
        $columns = [];
        $rows = $pdo->query('PRAGMA table_info('.$this->quote($table).')')->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rows as $row) {
            $columns[(string) $row['name']] = $row;
        }

        return $columns;
    }

    /**
     * @param array<string, mixed> $aviario
     */
    private function aviarioRelations(PDO $pdo, array $aviario): string
    {
        $name = (string) ($aviario['nome'] ?? '');
        $relations = [];
        $checks = [
            'freight_canceled_loads' => ['aviario'],
            'programacao_viagens' => ['aviario', 'origem'],
        ];

        foreach ($checks as $table => $columns) {
            foreach ($columns as $column) {
                if (! $this->tableHasColumn($pdo, $table, $column)) {
                    continue;
                }

                $stmt = $pdo->prepare('SELECT COUNT(*) FROM '.$this->quote($table).' WHERE '.$this->quote($column).' = :value');
                $stmt->execute(['value' => $name]);
                $count = (int) $stmt->fetchColumn();

                if ($count > 0) {
                    $relations[] = "{$table}.{$column}={$count}";
                }
            }
        }

        return $relations === [] ? 'sem relacao textual encontrada' : implode(', ', $relations);
    }

    private function tableHasColumn(PDO $pdo, string $table, string $column): bool
    {
        try {
            return array_key_exists($column, $this->columns($pdo, $table));
        } catch (Throwable) {
            return false;
        }
    }

    private function quote(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
    }
}
