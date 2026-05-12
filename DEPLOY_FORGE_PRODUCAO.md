# Deploy Forge Producao - Laravel + MySQL

Este documento e um roteiro de producao. Ele nao executa deploy, nao troca DNS e nao altera o `.env` local.

## Veredito de pre-producao

- Projeto pronto para preparar hospedagem no Laravel Forge com MySQL: SIM.
- Risco restante: BAIXO a MEDIO.
- Principal cuidado restante: executar a janela final com sistema congelado, backup completo e comparacao pos-migracao antes de liberar usuarios.

## Requisitos recomendados da VPS

- Ubuntu LTS suportado pelo Laravel Forge.
- PHP 8.2 ou superior, alinhado ao ambiente testado.
- MySQL 8 ou MariaDB 10.4+.
- Nginx gerenciado pelo Forge.
- Node.js LTS para `npm ci` e `npm run build`.
- Supervisor para queue worker.
- Cron configurado pelo Forge Scheduler.
- Memoria recomendada: 2 GB minimo; 4 GB recomendado se varios usuarios/importacoes XLSX forem simultaneos.
- Disco: SSD, com folga para `storage`, backups e dumps MySQL.

Dominio sugerido:

```text
app.kaiquetransportes.com.br
```

## Variaveis .env de producao

Usar valores reais/secretos no Forge, nao copiar o `.env` local diretamente.

```dotenv
APP_NAME=Kaique
APP_ENV=production
APP_KEY=base64:GERAR_COM_PHP_ARTISAN_KEY_GENERATE
APP_DEBUG=false
APP_URL=https://app.kaiquetransportes.com.br

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=NOME_DO_BANCO_PRODUCAO
DB_USERNAME=USUARIO_PRODUCAO
DB_PASSWORD=SENHA_FORTE
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci

CACHE_STORE=database
SESSION_DRIVER=database
QUEUE_CONNECTION=database
FILESYSTEM_DISK=local
LOG_CHANNEL=stack
LOG_LEVEL=warning

MAIL_MAILER=log
```

Conferir tambem qualquer variavel especifica do projeto em `.env.production.example`.

## Backup obrigatorio antes da janela

Salvar em local fora do projeto e, se possivel, fora da VPS:

- `database/database.sqlite` original.
- Dump MySQL final apos migracao.
- `storage/app/public`.
- `storage/app/private`.
- `.env` local.
- `.env` de producao.
- `logo/logokaique.png` e demais arquivos em `logo`.
- Estado/link `public/storage`.
- Snapshot do VPS no provedor.

## Ordem final de migracao para producao

1. Congelar uso do sistema local.
2. Fazer backup SQLite + storage + `.env`.
3. Criar banco MySQL de producao no Forge.
4. Configurar `.env` de producao.
5. Rodar migrations no MySQL de producao.
6. Migrar dados SQLite -> MySQL producao.
7. Rodar comparacao SQLite x MySQL.
8. Copiar `storage/app/public`, `storage/app/private` e `logo`.
9. Rodar deploy Forge.
10. Testar login e fluxos principais.
11. Liberar usuarios somente depois dos testes.

## Comandos de banco

Migrations em producao:

```bash
php artisan migrate --force --no-interaction
```

Migracao de dados, ajustando credenciais reais:

```bash
php artisan app:migrate-sqlite-to-mysql \
  --confirm \
  --sqlite=database/database.sqlite \
  --mysql=mysql \
  --mysql-host=127.0.0.1 \
  --mysql-port=3306 \
  --mysql-database=NOME_DO_BANCO_PRODUCAO \
  --mysql-username=USUARIO_PRODUCAO \
  --mysql-password='SENHA_FORTE' \
  --chunk=200 \
  --no-interaction
```

Comparacao pos-migracao:

```bash
php artisan app:compare-sqlite-mysql \
  --sqlite=database/database.sqlite \
  --mysql=mysql \
  --mysql-host=127.0.0.1 \
  --mysql-port=3306 \
  --mysql-database=NOME_DO_BANCO_PRODUCAO \
  --mysql-username=USUARIO_PRODUCAO \
  --mysql-password='SENHA_FORTE' \
  --no-interaction
```

## Copia de storage

Copiar preservando estrutura:

```bash
rsync -av storage/app/public/ usuario@servidor:/home/forge/app.kaiquetransportes.com.br/storage/app/public/
rsync -av storage/app/private/ usuario@servidor:/home/forge/app.kaiquetransportes.com.br/storage/app/private/
rsync -av logo/ usuario@servidor:/home/forge/app.kaiquetransportes.com.br/logo/
```

Permissoes no servidor:

```bash
cd /home/forge/app.kaiquetransportes.com.br
chmod -R ug+rw storage bootstrap/cache
php artisan storage:link || true
```

## Deploy script recomendado no Forge

Como `routes/web.php` ainda usa closures, usar `route:clear` em vez de `route:cache`.

```bash
cd /home/forge/app.kaiquetransportes.com.br

git pull origin $FORGE_SITE_BRANCH

composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader

npm ci
npm run build

php artisan migrate --force --no-interaction

php artisan storage:link || true

php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:cache
php artisan config:cache

php artisan queue:restart
```

## Queue worker

Configurar no Forge Worker:

```bash
php artisan queue:work database --sleep=3 --tries=3 --timeout=120
```

Recomendacao inicial:

- Processes: 1
- Stop seconds: 10
- Restart on deploy: sim, via `php artisan queue:restart`.

## Scheduler

Configurar no Forge Scheduler para rodar a cada minuto:

```bash
php artisan schedule:run
```

Depois do deploy, validar regras de lembretes/reminders em:

- painel de sistema/reminders;
- filas/jobs;
- logs Laravel.

## SSL

No Forge:

1. Apontar DNS `app.kaiquetransportes.com.br` para o IP da VPS.
2. Criar site no Forge com esse dominio.
3. Emitir certificado Let's Encrypt.
4. Forcar HTTPS.
5. Confirmar `APP_URL=https://app.kaiquetransportes.com.br`.

## Checklist pos-deploy

Testar manualmente:

- Login.
- Home.
- Usuarios/permissoes.
- Entrevistas.
- Proximos passos.
- Documentos/PDFs.
- Cadastro de colaborador.
- Cadastro de unidade.
- Pagamentos/salarios.
- Gestao de fretes.
- Importacao XLSX.
- Dashboards.
- Filtros por unidade/mes/colaborador.
- Exports/downloads.
- Uploads/storage.
- Fila/jobs.
- Scheduler/reminders.
- Logs em `storage/logs`.

## Rollback

Se algo falhar antes de liberar usuarios:

1. Manter usuarios bloqueados.
2. Colocar aplicacao em manutencao:

```bash
php artisan down
```

3. Restaurar dump MySQL ou recriar banco.
4. Restaurar `storage` correspondente.
5. Restaurar `.env` anterior, se necessario.
6. Rodar:

```bash
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:cache
php artisan config:cache
php artisan queue:restart
```

7. Validar novamente.
8. Sair de manutencao:

```bash
php artisan up
```
