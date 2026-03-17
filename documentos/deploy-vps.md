# Deploy persistente em VPS (sem notebook ligado)

Este guia coloca o projeto para rodar 24/7 em uma VPS Linux, com domínio, SSL, fila em background e deploy automático opcional.

## 1) Pré-requisitos

- VPS Ubuntu 24.04 com acesso SSH
- Domínio com acesso ao painel DNS
- Repositório: `https://github.com/caioreidophp/kaique-entrevista`

## 2) DNS

Crie um registro `A`:

- Host: `app`
- Tipo: `A`
- Valor: `IP_DA_VPS`

Domínio esperado: `app.kaiquetransportes.com.br`

## 3) Provisionar servidor

No servidor:

```bash
ssh usuario@IP_DA_VPS
sudo apt update && sudo apt install -y git
mkdir -p /var/www && cd /var/www
git clone https://github.com/caioreidophp/kaique-entrevista.git
cd kaique-entrevista
bash scripts/deploy/provision-ubuntu.sh
```

## 4) Configurar ambiente do Laravel

```bash
cd /var/www/kaique-entrevista
cp .env.production.example .env
php artisan key:generate
```

Edite `.env` com seus valores reais (DB e SMTP).

## 5) Banco + tabelas internas

```bash
php artisan migrate --force
```

## 6) Nginx

```bash
sudo cp scripts/deploy/nginx-kaique-entrevista.conf.template /etc/nginx/sites-available/kaique-entrevista
sudo ln -s /etc/nginx/sites-available/kaique-entrevista /etc/nginx/sites-enabled/kaique-entrevista
sudo nginx -t
sudo systemctl reload nginx
```

## 7) SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d app.kaiquetransportes.com.br
```

## 8) Permissões + storage

```bash
cd /var/www/kaique-entrevista
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R ug+rwx storage bootstrap/cache
php artisan storage:link
```

## 9) Worker em background (Supervisor)

```bash
sudo cp scripts/deploy/supervisor-laravel-worker.conf.template /etc/supervisor/conf.d/kaique-entrevista-worker.conf
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status
```

## 10) Scheduler (cron)

```bash
crontab -e
```

Adicionar linha:

```cron
* * * * * cd /var/www/kaique-entrevista && php artisan schedule:run >> /dev/null 2>&1
```

## 11) Deploy manual (quando quiser)

```bash
cd /var/www/kaique-entrevista
bash scripts/deploy/server-deploy.sh
```

## 12) Deploy automático pelo GitHub Actions (opcional)

Em GitHub > Settings > Secrets and variables > Actions, criar:

- `SSH_HOST` = IP da VPS
- `SSH_USER` = usuário SSH
- `SSH_PRIVATE_KEY` = chave privada (sem senha)
- `SSH_PORT` = 22
- `APP_DIR` = `/var/www/kaique-entrevista`

Workflow pronto em `.github/workflows/deploy-production.yml`.

## 13) Checklist final

```bash
curl -I https://app.kaiquetransportes.com.br
curl -I https://app.kaiquetransportes.com.br/up
sudo supervisorctl status
php artisan about
```

Se `/up` responder `200`, SSL estiver ativo e worker `RUNNING`, a aplicação está persistente e independente do notebook.
