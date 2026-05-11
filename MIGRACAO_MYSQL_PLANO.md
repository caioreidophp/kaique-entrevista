# Plano seguro de migracao SQLite para MySQL

Este documento cobre somente a preparacao da migracao. Ele nao autoriza migrar dados, trocar o `.env` real, apagar SQLite, apagar storage ou rodar comandos destrutivos.

## Veredito atual

- Migrar diretamente o banco real agora: **nao recomendado**.
- Risco atual: **medio**.
- Caminho recomendado: testar MySQL vazio e migracao de dados em ambiente separado antes de hospedagem/Forge.

## Backup obrigatorio

Antes de qualquer teste de migracao com dados reais, fazer backup de:

- `database/database.sqlite`
- `.env`
- `storage/app/public`
- `storage/app/private`
- `logo`
- `composer.lock`
- `package-lock.json`

Sugestao de backup manual no Windows PowerShell, sem apagar nada:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force "backups\fase1-$stamp"
Copy-Item "database\database.sqlite" "backups\fase1-$stamp\database.sqlite"
Copy-Item ".env" "backups\fase1-$stamp\.env.local"
Copy-Item "storage\app\public" "backups\fase1-$stamp\storage-app-public" -Recurse
Copy-Item "storage\app\private" "backups\fase1-$stamp\storage-app-private" -Recurse
Copy-Item "logo" "backups\fase1-$stamp\logo" -Recurse
Copy-Item "composer.lock" "backups\fase1-$stamp\composer.lock"
Copy-Item "package-lock.json" "backups\fase1-$stamp\package-lock.json"
```

## Arquivos que precisam ir para producao

Arquivos e diretorios essenciais:

- codigo versionado do projeto;
- `.env` de producao baseado em `.env.production.example`;
- `storage/app/public`, pois contem anexos publicos;
- `storage/app/private`, pois contem arquivos privados/backups/exportacoes;
- `logo`, usado por geracao de PDF;
- banco migrado para MySQL, quando a fase de migracao for aprovada.

Em producao tambem sera necessario:

```bash
php artisan storage:link
php artisan queue:work
php artisan schedule:run
```

No Forge, `queue:work` deve ficar como worker/supervisor e `schedule:run` deve ficar no scheduler.

## Migration ausente

Migration registrada no SQLite, mas sem arquivo no projeto:

```text
2026_04_07_183000_add_indexes_to_interview_curriculums_filters
```

Analise:

- O banco SQLite atual tem indices extras em `interview_curriculums`:
  - `interview_curriculums_status_role_index` em `(status, role_name)`;
  - `interview_curriculums_status_unit_index` em `(status, unit_name)`;
  - `interview_curriculums_status_role_unit_index` em `(status, role_name, unit_name)`;
  - indices simples em `role_name` e `unit_name`.
- A migration existente `2026_04_07_170000_add_filter_indexes_to_interview_curriculums_table.php` ja cria:
  - `interview_curriculums_status_role_index`;
  - `interview_curriculums_status_unit_index`.
- Portanto, parte do que a migration ausente provavelmente fazia ja esta coberta.
- O indice composto `interview_curriculums_status_role_unit_index` e os indices simples `role_name`/`unit_name` existem no SQLite atual, mas nao aparecem nos arquivos atuais de migrations.

Decisao recomendada:

- **Nao recriar automaticamente agora** sem confirmar o conteudo original.
- Para MySQL vazio, a migration ausente nao bloqueia `php artisan migrate`, porque ela nao existe mais como arquivo.
- O risco e de diferenca de performance/filtros, nao de perda imediata de dados.
- Antes da migracao final, decidir se vale criar uma nova migration com nome atual adicionando os indices faltantes, com verificacao para evitar duplicidade.

## Riscos encontrados

- `database/database.sqlite` e local e ignorado pelo Git.
- Existe uma migration registrada no SQLite que nao existe mais como arquivo.
- O schema real do SQLite pode nao ser identico ao schema gerado do zero em MySQL.
- Ha migrations com `enum()`, `change()` e `DB::statement`, o que exige teste real em MySQL vazio.
- O teste em MariaDB/MySQL vazio falhou na migration `2026_03_09_000500_add_launch_fields_to_pagamentos_table.php`.
  - Erro: `Cannot drop index 'pagamentos_colaborador_competencia_unique': needed in a foreign key constraint`.
  - Causa provavel: no MySQL/MariaDB, o indice unico antigo em `pagamentos(colaborador_id, competencia_mes, competencia_ano)` esta sendo usado para sustentar a foreign key de `colaborador_id`; a migration tenta remover esse indice antes de garantir outro indice simples/compativel para a foreign key.
  - Impacto: as migrations **nao rodam do zero em MySQL vazio** no estado atual.
- Ha filas/jobs e scheduler; em producao eles precisam ser configurados.
- Ha arquivos em storage que nao estao no Git e precisam ser copiados.
- `bootstrap/cache` possui caches locais; em producao devem ser recriados com o `.env` correto.

## Correcao aplicada na migration de pagamentos

Arquivo alterado:

- `database/migrations/2026_03_09_000500_add_launch_fields_to_pagamentos_table.php`

Causa exata do erro:

- A migration tentava remover o indice unico `pagamentos_colaborador_competencia_unique`.
- Esse indice era composto por:
  - `colaborador_id`
  - `competencia_mes`
  - `competencia_ano`
- A foreign key afetada e `pagamentos_colaborador_id_foreign`.
- A coluna/tabela envolvida e `pagamentos.colaborador_id`, referenciando `colaboradores.id`.
- Em MySQL/MariaDB, toda foreign key precisa ter um indice utilizavel na coluna local. Como o indice unico antigo comecava por `colaborador_id`, ele servia como indice de apoio para a foreign key. Ao tentar remover esse indice antes de criar outro indice para `colaborador_id`, o MySQL bloqueava a operacao.
- No SQLite isso nao apareceu porque o mecanismo de alteracao/indices/foreign keys e diferente e a migration ja havia sido aplicada no banco local.

Solucao aplicada:

- Antes de remover `pagamentos_colaborador_competencia_unique`, a migration agora garante o indice simples `pagamentos_colaborador_id_index` em `colaborador_id`.
- Depois disso, remove o indice unico antigo e cria o indice unico novo `pagamentos_colaborador_tipo_data_unique`.
- No `down()`, o indice simples so e removido depois de recriar o indice unico antigo, preservando suporte para a foreign key.
- Foi usado `Schema::hasIndex()` para evitar erro se o indice ja existir ou nao existir em algum ambiente.

Essa alteracao nao muda regra de negocio, nao migra dados e nao altera o SQLite real.

## Resultado do novo teste MySQL vazio

Ambiente usado:

- MariaDB `10.4.32-MariaDB`, via XAMPP local.
- Banco de teste anterior com falha: `kaique_entrevista_migration_test`.
- Banco novo e vazio usado apos a correcao: `kaique_entrevista_migration_test_fix_20260511`.
- `.env` real nao foi alterado; foram usadas variaveis de ambiente temporarias no processo do PowerShell.
- O SQLite real nao foi alterado.

Comandos usados:

```powershell
$env:APP_CONFIG_CACHE='C:\xampp\htdocs\kaique-entrevista\storage\framework\cache\mysqltest-config.php'
$env:DB_CONNECTION='mysql'
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='3306'
$env:DB_DATABASE='kaique_entrevista_migration_test_fix_20260511'
$env:DB_USERNAME='root'
$env:DB_PASSWORD=''
php artisan migrate --database=mysql --force --no-interaction
php artisan migrate:status --database=mysql --no-interaction
```

Resultado anterior, antes da correcao:

```text
2026_03_09_000500_add_launch_fields_to_pagamentos_table
SQLSTATE[HY000]: General error: 1553 Cannot drop index 'pagamentos_colaborador_competencia_unique': needed in a foreign key constraint
```

Resultado apos a correcao:

- `php artisan migrate --database=mysql --force --no-interaction`: **OK**.
- `php artisan migrate:status --database=mysql --no-interaction`: **101 migrations Ran**.
- Banco de teste final: **53 tabelas**.
- Tabela `migrations` no MySQL de teste: **101 registros**.
- Indices finais confirmados em `pagamentos`:
  - `pagamentos_colaborador_tipo_data_unique`
  - `pagamentos_colaborador_id_index`

Conclusao atual:

- As migrations do projeto agora rodam 100% em MySQL/MariaDB vazio.
- Ainda nao houve migracao de dados SQLite para MySQL.

## Comandos seguros

Diagnostico local, somente leitura:

```bash
php artisan app:database-audit
php artisan app:compare-sqlite-mysql
php artisan route:list
php artisan about --only=environment
composer validate --no-check-publish
composer install --no-dev --dry-run --no-interaction --prefer-dist --optimize-autoloader
npm run types
```

Teste em MySQL vazio de teste, sem tocar no SQLite real:

```bash
php artisan migrate --database=mysql --pretend
php artisan migrate --database=mysql
php artisan migrate:status --database=mysql
```

Esses comandos so devem apontar para um banco MySQL vazio criado exclusivamente para teste.

## Comandos proibidos nesta fase

Nao rodar no banco atual:

```bash
php artisan migrate:fresh
php artisan migrate:fresh --seed
php artisan migrate:refresh
php artisan migrate:rollback
php artisan db:wipe
php artisan db:seed
```

Nao executar:

- exclusao manual de `database/database.sqlite`;
- exclusao de `storage`;
- troca do `.env` real para MySQL;
- restore/import SQL no banco real;
- deploy em producao.

## Plano de rollback

Se qualquer teste de migracao falhar:

1. Nao mexer no SQLite original.
2. Parar qualquer worker apontando para o banco de teste.
3. Descartar apenas o banco MySQL de teste.
4. Conferir se o `.env` real continua com `DB_CONNECTION=sqlite`.
5. Conferir se `database/database.sqlite` continua no lugar.
6. Conferir anexos em `storage/app/public` e `storage/app/private`.
7. Registrar o erro encontrado e corrigir migrations/codigo antes de novo teste.

Rollback em producao futura, se ja houver deploy aprovado:

1. Colocar aplicacao em manutencao.
2. Restaurar snapshot do banco anterior.
3. Restaurar storage correspondente.
4. Reverter `.env`/release para a versao anterior.
5. Limpar e recriar caches com a configuracao restaurada.
6. Validar login, anexos e paginas principais antes de sair da manutencao.

## Proxima fase

Depois desta fase, o proximo passo seguro e criar um banco MySQL de teste, rodar migrations do zero, comparar schema/contagens e so entao planejar a migracao dos dados.

## Migracao de dados SQLite para MySQL de teste

Comando criado:

```bash
php artisan app:migrate-sqlite-to-mysql
```

Caracteristicas de seguranca:

- exige `--confirm`;
- nao altera `.env`;
- aceita parametros explicitos de MySQL de teste;
- faz backup automatico do `database/database.sqlite` antes da validacao/copia;
- valida tabelas e colunas antes de copiar;
- aborta se encontrar diferenca critica de schema;
- copia em ordem baseada nas foreign keys do MySQL;
- preserva IDs e campos de data como `created_at`, `updated_at` e `deleted_at`;
- se a tabela de destino ja tiver a mesma contagem, pula a tabela para evitar duplicidade;
- se a tabela de destino tiver contagem parcial/diferente, aborta;
- trata `migrations` como metadado, usando `updateOrInsert` por nome da migration.

Comando exato usado no teste:

```bash
php artisan app:migrate-sqlite-to-mysql --confirm --sqlite=database/database.sqlite --mysql=mysql --mysql-host=127.0.0.1 --mysql-port=3306 --mysql-database=kaique_entrevista_migration_test_fix_20260511 --mysql-username=root --mysql-password= --chunk=200 --no-interaction
```

Backup automatico criado:

```text
storage/app/private/migration-backups/20260511-132417/database.sqlite
```

Resultado do teste:

- Validacao de schema: **0 diferencas criticas**.
- Avisos de schema: **0**.
- Diferencas de tipo revisaveis: **0**.
- Tabelas copiadas antes do erro:
  - `activity_log`: 2371 registros;
  - `users`: 6 registros;
  - `async_exports`: 0;
  - `async_operations`: 0;
  - `automated_reminder_rules`: 0;
  - `automated_reminder_deliveries`: 0.
- A migracao parou em `aviarios`, conforme regra de parar no primeiro erro.

Erro encontrado:

```text
SQLSTATE[23000]: Integrity constraint violation: 1062 Duplicate entry 'DALMO JOSE BUENO-Amparo/SP' for key 'aviarios_nome_cidade_unique'
```

Causa provavel:

- O SQLite possui indice unico em `aviarios(nome, cidade)`, mas a comparacao do SQLite e mais permissiva/diferente para maiusculas, minusculas e acentos.
- O MySQL/MariaDB de teste usa collation `utf8mb4_unicode_ci`, que e case-insensitive e accent-insensitive.
- Assim, valores como `Dalmo José Bueno / Amparo/SP` e `DALMO JOSE BUENO / Amparo/SP` podem ser considerados diferentes no SQLite, mas iguais no MySQL/MariaDB.
- Isso nao e problema de migration; e problema de compatibilidade dos dados atuais com a collation/unique constraint do MySQL.

Estado do banco MySQL de teste apos o erro:

- O banco de teste ficou parcialmente populado.
- `activity_log`: 2371 registros.
- `users`: 6 registros.
- `aviarios`: 0 registros, pois o lote falhou dentro de transacao.
- Nao usar esse banco parcial como base final; para novo teste, usar um MySQL de teste novo/vazio ou limpar apenas o banco de teste.

## Comparacao SQLite x MySQL

Comando melhorado:

```bash
php artisan app:compare-sqlite-mysql
```

Comando recomendado para o banco de teste:

```bash
php artisan app:compare-sqlite-mysql --sqlite=database/database.sqlite --mysql=mysql --mysql-host=127.0.0.1 --mysql-port=3306 --mysql-database=kaique_entrevista_migration_test_fix_20260511 --mysql-username=root --mysql-password= --no-interaction
```

Ele compara:

- contagem por tabela;
- menor e maior ID por tabela;
- somatorios financeiros e de frete;
- contagens por unidade e por mes quando aplicavel;
- registros orfaos em foreign keys do MySQL;
- ultimas datas por tabela.

Como a migracao de dados parou em `aviarios`, a comparacao final completa nao foi executada nesta fase. A proxima fase deve primeiro resolver a incompatibilidade de dados/collation em `aviarios`, recriar um banco MySQL de teste vazio, rodar migrations e repetir a migracao.

## Fase atual - correcao de aviarios e nova migracao de teste

Executado em 2026-05-11.

### Correcao dos duplicados de aviarios

Comando executado:

```bash
php artisan app:fix-aviarios-duplicates --confirm --no-interaction
```

Backup automatico criado antes de alterar dados:

```text
storage/app/private/migration-backups/20260511-140645-aviarios-fix/database.sqlite
```

Validacoes antes da transacao:

- IDs `5`, `7`, `17`, `49`, `80`, `54` encontrados.
- Nome, cidade e km conferidos contra os valores esperados.
- Nenhuma foreign key formal para `aviarios.id`.
- Nenhuma coluna `aviario_id`.
- Nenhuma referencia exata aos nomes duplicados em:
  - `freight_canceled_loads.aviario`;
  - `programacao_viagens.aviario`;
  - `programacao_viagens.origem`.

Registros mantidos:

- `5`: Dalmo José Bueno / Amparo/SP / km 28
- `7`: José Ademir Dariolli / Amparo/SP / km 16
- `17`: Edi Márcio Dariolli / Amparo/SP / km 17

Registros removidos:

- `49`: DALMO JOSE BUENO / Amparo/SP / km 28
- `80`: JOSE ADEMIR DARIOLLI / Amparo/SP / km 16
- `54`: EDI MARCIO DARIOLLI / Amparo/SP / km 17

Textos padronizados:

- 0 textos alterados por match exato.
- As 5 referencias normalizadas a `JOSÉ ADEMIR DARIOLLI` em `freight_canceled_loads.aviario` foram mantidas, porque nao batiam exatamente com o nome duplicado e nao bloqueiam o unique de `aviarios`.

Auditoria unique apos a correcao:

```bash
php artisan app:audit-mysql-unique-collisions --sqlite=database/database.sqlite
```

Resultado:

- Indices unique analisados: 33
- Colisoes encontradas: **0**

### Banco MySQL de teste novo

Primeira tentativa:

- Banco criado: `kaique_entrevista_migration_test_final_20260511_110713`
- Esse banco ficou vazio.
- Motivo: havia `bootstrap/cache/config.php` local apontando `database.connections.mysql.database` para `laravel`; a execucao inicial de `php artisan migrate --database=mysql` leu esse cache e nao usou o banco novo.
- Nao usar esse banco como base.

Contorno seguro usado:

```powershell
$env:APP_CONFIG_CACHE='bootstrap/cache/config-test-not-used.php'
```

Isso fez o Laravel ignorar o cache local antigo apenas no processo atual, sem alterar `.env` e sem apagar o cache real.

Banco efetivo usado:

```text
kaique_entrevista_migration_test_final_20260511_110851
```

Migrations:

```powershell
$env:APP_CONFIG_CACHE='bootstrap/cache/config-test-not-used.php'
$env:DB_CONNECTION='mysql'
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='3306'
$env:DB_DATABASE='kaique_entrevista_migration_test_final_20260511_110851'
$env:DB_USERNAME='root'
$env:DB_PASSWORD=''
php artisan migrate --database=mysql --force --no-interaction
```

Resultado:

- Migrations: **OK**
- Tabelas criadas no banco novo: **53**

### Nova migracao SQLite -> MySQL de teste

Comando executado:

```bash
php artisan app:migrate-sqlite-to-mysql --confirm --sqlite=database/database.sqlite --mysql=mysql --mysql-host=127.0.0.1 --mysql-port=3306 --mysql-database=kaique_entrevista_migration_test_final_20260511_110851 --mysql-username=root --mysql-password= --chunk=200 --no-interaction
```

Backup automatico criado pelo comando antes da validacao/copia:

```text
storage/app/private/migration-backups/20260511-140927/database.sqlite
```

Validacao de schema antes da copia:

- Diferencas criticas: 0
- Avisos: 0
- Diferencas de tipo revisaveis: 0

Tabelas copiadas antes do erro:

- `activity_log`: 2371 registros
- `users`: 6 registros
- `async_exports`: 0
- `async_operations`: 0
- `automated_reminder_rules`: 0
- `automated_reminder_deliveries`: 0
- `aviarios`: 397 registros
- `bob_assistant_messages`: 26 registros
- `cache`: 52 registros
- `cache_locks`: 0
- `funcoes`: 8 registros
- `unidades`: 4 registros
- `colaboradores`: 85 registros
- `descontos_colaboradores`: 6 registros
- `interview_curriculums`: 51 registros

Erro encontrado:

```text
Tabela: driver_interviews
SQLSTATE[22001]: String data, right truncated: 1406 Data too long for column 'cpf' at row 1
```

Causa identificada por leitura:

- No SQLite, `driver_interviews.cpf`, `driver_interviews.rg` e `driver_interviews.cnh_number` contem payloads criptografados com cerca de 200 caracteres.
- No MySQL gerado pelas migrations atuais:
  - `driver_interviews.cpf` = `varchar(11)`
  - `driver_interviews.rg` = `varchar(30)`
  - `driver_interviews.cnh_number` = `varchar(9)`
- O model `App\Models\DriverInterview` possui casts `encrypted` para esses campos.
- Existe migration para criptografar dados sensiveis, mas as migrations atuais nao ampliam o tamanho dessas colunas em `driver_interviews` para comportar payload criptografado.

Conclusao da fase:

- Colisoes UNIQUE em `aviarios`: **resolvidas**.
- Migrations em MySQL vazio: **OK**.
- Migracao de dados completa: **NAO**.
- Novo bloqueio: tamanho das colunas criptografadas em `driver_interviews`.
- Comparacao SQLite x MySQL completa: **nao executada**, porque a migracao parou no primeiro erro, como planejado.

Proximo passo recomendado:

- Criar uma migration compatível com MySQL/SQLite para ampliar `driver_interviews.cpf`, `driver_interviews.rg` e `driver_interviews.cnh_number` para `string(255)` ou `text`, sem alterar dados nem regra de negocio.
- Recriar outro banco MySQL de teste novo/vazio.
- Rodar migrations, repetir a migracao de dados e entao executar `app:compare-sqlite-mysql`.

## Fase atual - campos criptografados em driver_interviews

Executado em 2026-05-11.

### Causa do erro

A migracao SQLite -> MySQL parou em:

```text
Tabela: driver_interviews
Erro: Data too long for column 'cpf' at row 1
```

Causa:

- `App\Models\DriverInterview` usa cast `encrypted` em `cpf`, `rg` e `cnh_number`.
- O SQLite atual tem payload criptografado com aproximadamente 200 caracteres nesses campos.
- As migrations antigas deixavam o MySQL final com:
  - `driver_interviews.cpf`: `varchar(11)`
  - `driver_interviews.rg`: `varchar(30)`
  - `driver_interviews.cnh_number`: `varchar(9)`
- Payload criptografado do Laravel nao cabe nesses tamanhos.

### Campos encrypted encontrados

| Model | Tabela | Coluna | Cast | Tipo SQLite atual | Max SQLite | Tipo MySQL antes | Risco |
| --- | --- | --- | --- | --- | ---: | --- | --- |
| `DriverInterview` | `driver_interviews` | `cpf` | `encrypted` | `varchar`, not null | 200 | `varchar(11)` | ALTO |
| `DriverInterview` | `driver_interviews` | `rg` | `encrypted` | `varchar`, not null | 200 | `varchar(30)` | ALTO |
| `DriverInterview` | `driver_interviews` | `cnh_number` | `encrypted` | `varchar`, not null | 200 | `varchar(9)` | ALTO |
| `Colaborador` | `colaboradores` | `cpf` | `encrypted` | `varchar`, not null | 200 | `varchar(255)` | BAIXO |
| `Colaborador` | `colaboradores` | `rg` | `encrypted` | `varchar`, nullable | 200 | `varchar(255)` | BAIXO |
| `Colaborador` | `colaboradores` | `cnh` | `encrypted` | `varchar`, nullable | 200 | `varchar(255)` | BAIXO |

Nao foram encontrados casts `encrypted:string`, `encrypted:array`, `encrypted:collection`, `AsEncryptedArrayObject` ou cast customizado de criptografia nos models atuais.

### Alteracao aplicada

Arquivo criado:

```text
database/migrations/2026_05_11_120000_expand_driver_interview_encrypted_fields.php
```

Alteracao:

- `driver_interviews.cpf`: `text`, not null
- `driver_interviews.rg`: `text`, not null
- `driver_interviews.cnh_number`: `text`, not null

A criptografia foi preservada. Nao houve alteracao de regra de negocio, indice, collation, `.env` ou dados de producao.

### MySQL de teste novo

Banco criado:

```text
kaique_entrevista_migration_test_encrypted_20260511_112909
```

Como existe `bootstrap/cache/config.php` local apontando `mysql.database` para outro banco, os comandos de teste usaram:

```powershell
$env:APP_CONFIG_CACHE='bootstrap/cache/config-test-not-used.php'
```

Isso nao altera `.env` nem apaga cache.

Migrations:

```bash
php artisan migrate --database=mysql --force --no-interaction
```

Resultado:

- Migrations: **OK**
- Tabelas: **53**
- Nova migration `2026_05_11_120000_expand_driver_interview_encrypted_fields`: **Ran**
- Tipos finais confirmados no MySQL:
  - `cpf`: `text`, `NOT NULL`
  - `rg`: `text`, `NOT NULL`
  - `cnh_number`: `text`, `NOT NULL`

### Migracao SQLite -> MySQL

Comando executado:

```bash
php artisan app:migrate-sqlite-to-mysql --confirm --sqlite=database/database.sqlite --mysql=mysql --mysql-host=127.0.0.1 --mysql-port=3306 --mysql-database=kaique_entrevista_migration_test_encrypted_20260511_112909 --mysql-username=root --mysql-password= --chunk=200 --no-interaction
```

Backup automatico criado:

```text
storage/app/private/migration-backups/20260511-143000/database.sqlite
```

Resultado:

- Validacao de schema: 0 diferencas criticas, 0 avisos, 0 diferencas de tipo revisaveis.
- Migracao de dados: **OK em todas as 53 tabelas**.
- `driver_interviews`: 12 registros migrados.
- `colaboradores`: 85 registros migrados.
- `pagamentos`: 587 registros migrados.
- `freight_entries`: 174 registros migrados.
- `freight_canceled_loads`: 102 registros migrados.
- `freight_spot_entries`: 15 registros migrados.
- `activity_log`: 2371 registros migrados.

### Comparacao SQLite x MySQL

Comando executado:

```bash
php artisan app:compare-sqlite-mysql --sqlite=database/database.sqlite --mysql=mysql --mysql-host=127.0.0.1 --mysql-port=3306 --mysql-database=kaique_entrevista_migration_test_encrypted_20260511_112909 --mysql-username=root --mysql-password= --no-interaction
```

Resultado:

- Tabelas: SQLite 53, MySQL 53.
- Contagens e faixas de IDs: OK para todas as tabelas operacionais.
- Somatorios financeiros e fretes: OK.
- Contagens por unidade/mes: OK.
- Registros orfaos em foreign keys: 0 em todas as FKs.
- Ultimas datas por tabela: OK.

Unico alerta:

- Tabela `migrations`: contagem igual (`102` x `102`), mas `MAX(id)` diferente.
- Motivo:
  - Existe no SQLite e nao no codigo/MySQL: `2026_04_07_183000_add_indexes_to_interview_curriculums_filters`.
  - Existe no MySQL/codigo e nao no SQLite: `2026_05_11_120000_expand_driver_interview_encrypted_fields`.
- Isso e divergencia de metadado de migrations, nao divergencia de dados operacionais.

Conclusao desta fase:

- Dados migraram para MySQL de teste: **SIM, com alerta nao operacional em `migrations`**.
- Para considerar 100% limpo no comparador, o comando de comparacao deve tratar `migrations.id` como metadado, ou o relatorio deve aceitar essa diferenca documentada.

## Fase final de pre-producao Forge

Executado em 2026-05-11.

### Comparador ajustado

Arquivo alterado:

```text
app/Console/Commands/CompareSqliteMysqlCommand.php
```

Mudanca:

- A tabela `migrations` passou a ser tratada como metadado.
- A comparacao operacional nao compara mais `migrations` por `id` minimo/maximo.
- O comando agora mostra:
  - dados operacionais;
  - metadados de migrations;
  - migrations presentes so no SQLite;
  - migrations presentes so no MySQL;
  - impacto provavel.

Comparacao final no MySQL de teste:

```bash
php artisan app:compare-sqlite-mysql --sqlite=database/database.sqlite --mysql=mysql --mysql-host=127.0.0.1 --mysql-port=3306 --mysql-database=kaique_entrevista_migration_test_encrypted_20260511_112909 --mysql-username=root --mysql-password= --no-interaction
```

Resultado:

- Comparacao operacional: **OK**.
- Tabelas: SQLite 53, MySQL 53.
- Contagens e IDs operacionais: OK.
- Pagamentos, fretes e totais financeiros: OK.
- Contagens por unidade/mes: OK.
- Orfaos em foreign keys: 0.
- Ultimas datas: OK.

Metadados de migration:

- Somente SQLite:
  - `2026_04_07_183000_add_indexes_to_interview_curriculums_filters`
- Somente MySQL:
  - `2026_05_11_120000_expand_driver_interview_encrypted_fields`
  - `2026_05_11_130000_add_missing_indexes_to_interview_curriculums_for_mysql`

Impacto: metadado/paridade de schema; nao afeta dados operacionais.

### Indices de interview_curriculums

Auditoria:

- O SQLite tinha indices que o MySQL novo nao tinha:
  - `interview_curriculums_status_role_unit_index` (`status`, `role_name`, `unit_name`)
  - `interview_curriculums_role_name_index` (`role_name`)
  - `interview_curriculums_unit_name_index` (`unit_name`)
- Esses indices sao de performance/filtro, nao de regra de negocio nem integridade de dados.

Arquivo criado:

```text
database/migrations/2026_05_11_130000_add_missing_indexes_to_interview_curriculums_for_mysql.php
```

Resultado no MySQL de teste:

- Migration: **Ran**.
- Indices confirmados:
  - `interview_curriculums_status_role_unit_index`
  - `interview_curriculums_role_name_index`
  - `interview_curriculums_unit_name_index`

### Testes de pre-producao

Todos usando MySQL de teste e variaveis temporarias, sem alterar `.env` real:

```text
kaique_entrevista_migration_test_encrypted_20260511_112909
```

Executados:

- `php artisan about`: OK.
- `php artisan route:list --no-interaction`: OK, 313 rotas.
- `php artisan migrate:status --database=mysql --no-interaction`: OK.
- `php artisan config:clear --no-interaction`: OK.
- `php artisan cache:clear --no-interaction`: OK no MySQL de teste.
- `php artisan config:cache --no-interaction`: OK com cache temporario.
- `php artisan view:cache --no-interaction`: OK.
- `php artisan route:clear --no-interaction`: OK.
- `composer install --no-dev --dry-run --no-interaction --prefer-dist --optimize-autoloader`: OK.
- `npm run build`: OK.

Observacao sobre rotas:

- `routes/web.php` usa closures para paginas Inertia.
- Por isso, o deploy recomendado usa `php artisan route:clear`, nao `route:cache`.

### Veredito final de pre-producao

- Projeto pronto para preparar Forge + MySQL: **SIM**.
- Risco restante: **BAIXO a MEDIO**.
- Bloqueio tecnico encontrado: nenhum bloqueio de dados/migrations no ambiente de teste.
- Ainda falta: deploy real, copia real de storage, configuracao real de `.env` de producao, DNS/SSL e validacao manual no navegador apos deploy.
