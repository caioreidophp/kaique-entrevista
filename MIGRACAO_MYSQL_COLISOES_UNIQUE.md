# Auditoria de colisoes unique para MySQL/MariaDB

Gerado em: 2026-05-11 14:06:50

## Resumo geral

- Indices unique analisados: 33
- Colisoes encontradas: 0
- Banco analisado: `database/database.sqlite`
- Nenhum dado foi alterado.

Nenhuma colisao foi encontrada com a normalizacao aplicada.

## Indices unique analisados

- `async_exports`.`sqlite_autoindex_async_exports_1` (`id`)
- `async_operations`.`sqlite_autoindex_async_operations_1` (`id`)
- `aviarios`.`aviarios_nome_cidade_unique` (`nome`, `cidade`)
- `cache`.`sqlite_autoindex_cache_1` (`key`)
- `cache_locks`.`sqlite_autoindex_cache_locks_1` (`key`)
- `colaboradores`.`colaboradores_cpf_hash_unique` (`cpf_hash`)
- `failed_jobs`.`failed_jobs_uuid_unique` (`uuid`)
- `financial_approvals`.`financial_approvals_execution_token_unique` (`execution_token`)
- `financial_approvals`.`financial_approvals_request_uuid_unique` (`request_uuid`)
- `freight_entries`.`freight_entries_data_unidade_id_unique` (`data`, `unidade_id`)
- `funcoes`.`funcoes_nome_unique` (`nome`)
- `job_batches`.`sqlite_autoindex_job_batches_1` (`id`)
- `multa_infracoes`.`multa_infracoes_nome_unique` (`nome`)
- `multa_orgaos_autuadores`.`multa_orgaos_nome_unique` (`nome`)
- `onboarding_items`.`onboarding_items_onboarding_id_code_unique` (`onboarding_id`, `code`)
- `onboardings`.`onboardings_driver_interview_id_unique` (`driver_interview_id`)
- `pagamentos`.`pagamentos_colaborador_tipo_data_unique` (`colaborador_id`, `tipo_pagamento_id`, `data_pagamento`)
- `password_reset_tokens`.`sqlite_autoindex_password_reset_tokens_1` (`email`)
- `personal_access_tokens`.`personal_access_tokens_token_unique` (`token`)
- `placas_frota`.`placas_frota_placa_unique` (`placa`)
- `programacao_escalas`.`programacao_escalas_programacao_viagem_id_unique` (`programacao_viagem_id`)
- `programacao_viagens`.`programacao_viagens_unique_trip` (`data_viagem`, `unidade_id`, `codigo_viagem`)
- `role_permissions`.`role_permissions_role_unique` (`role`)
- `service_accounts`.`service_accounts_key_hash_unique` (`key_hash`)
- `service_accounts`.`service_accounts_key_prefix_unique` (`key_prefix`)
- `sessions`.`sqlite_autoindex_sessions_1` (`id`)
- `tipos_pagamento`.`tipos_pagamento_nome_unique` (`nome`)
- `unidades`.`unidades_slug_unique` (`slug`)
- `unidades`.`unidades_nome_unique` (`nome`)
- `unit_fleet_sizes`.`unit_fleet_sizes_unit_month_unique` (`unidade_id`, `reference_month`)
- `user_access_scopes`.`user_access_scopes_user_id_module_key_unique` (`user_id`, `module_key`)
- `user_quick_accesses`.`user_quick_accesses_user_id_shortcut_key_unique` (`user_id`, `shortcut_key`)
- `users`.`users_email_unique` (`email`)

## Colisoes encontradas

## Classificacao do caso aviarios

- Tipo provavel: C/D.
- C: erro de acento/caixa quando pares diferem apenas por acento, maiusculas/minusculas ou espacos.
- D: ajuste manual no nome/cidade quando os nomes sao parecidos mas nao identicos apos normalizacao humana.
- A decisao final precisa ser humana, porque `aviarios` e usado por texto em programacao/fretes e nao ha foreign key direta.

## Risco por tabela

- Nenhum risco de colisao unique encontrado pela auditoria.

## Correcao executada em aviarios

Executado em 2026-05-11 com backup automatico e transacao:

```bash
php artisan app:fix-aviarios-duplicates --confirm --no-interaction
```

Backup criado antes da alteracao:

```text
storage/app/private/migration-backups/20260511-140645-aviarios-fix/database.sqlite
```

Registros mantidos:

- `5`: Dalmo José Bueno / Amparo/SP / km 28
- `7`: José Ademir Dariolli / Amparo/SP / km 16
- `17`: Edi Márcio Dariolli / Amparo/SP / km 17

Registros duplicados removidos:

- `49`: DALMO JOSE BUENO / Amparo/SP / km 28
- `80`: JOSE ADEMIR DARIOLLI / Amparo/SP / km 16
- `54`: EDI MARCIO DARIOLLI / Amparo/SP / km 17

Textos padronizados:

- Nenhum texto exato foi alterado, porque nao havia referencias exatas aos nomes duplicados em `freight_canceled_loads.aviario`, `programacao_viagens.aviario` ou `programacao_viagens.origem`.
- Existem 5 referencias textuais normalizadas a `JOSÉ ADEMIR DARIOLLI` em `freight_canceled_loads.aviario`, mas elas nao batiam exatamente com o nome duplicado `JOSE ADEMIR DARIOLLI`; por seguranca, nao foram alteradas.

Auditoria posterior:

```bash
php artisan app:audit-mysql-unique-collisions --sqlite=database/database.sqlite
```

Resultado: **0 colisoes unique**.

## Plano de correcao recomendado

1. Nao alterar collation nem remover unique como primeira opcao.
2. Revisar cada grupo de colisao e decidir se sao duplicados reais ou entidades diferentes.
3. Para duplicados reais, escolher um registro canonico e planejar mesclagem controlada.
4. Para entidades diferentes, ajustar nome/cidade para ficarem inequivocos no MySQL.
5. Repetir `app:audit-mysql-unique-collisions` ate zerar colisoes antes de nova migracao.

## Correcoes automaticas versus humanas

- Automaticas possiveis: padronizar espacos extras e caixa somente apos aprovacao e backup.
- Exigem decisao humana: mesclar registros, alterar nomes de aviarios, emails, CPF/hash, placas e chaves de negocio.

## Comandos seguros

```bash
php artisan app:audit-mysql-unique-collisions --sqlite=database/database.sqlite
php artisan app:database-audit
```

## Comandos proibidos nesta fase

```bash
php artisan migrate:fresh
php artisan migrate:refresh
php artisan db:wipe
php artisan migrate:rollback
```

Tambem nao alterar `.env`, nao apagar `database/database.sqlite`, nao remover indices unique e nao corrigir dados sem aprovacao.

## Status final de pre-producao

Atualizado em 2026-05-11.

- Auditoria unique apos correcao: **0 colisoes**.
- Migracao SQLite -> MySQL de teste apos correcoes: **OK**.
- Comparacao operacional SQLite x MySQL: **OK**.
- `aviarios`: 397 registros no SQLite e 397 no MySQL.
- IDs operacionais de `aviarios`: minimo 1, maximo 402 em ambos.
- Nenhum ajuste de collation foi feito.
- Nenhum indice unique foi removido.

Conclusao: as colisoes unique que bloqueavam a migracao para MySQL foram resolvidas.

