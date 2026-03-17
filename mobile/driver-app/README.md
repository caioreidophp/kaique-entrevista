# Kaique Motorista (MVP)

App mobile MVP para motoristas, integrado ao backend Laravel já existente.

## O que já funciona

- Login com `POST /api/login`
- Sessão com token Sanctum salvo no aparelho
- Leitura de perfil com `GET /api/me`
- Logout local

## Pré-requisitos

- Node 20+
- Android com app **Expo Go** instalado
- API acessível por URL pública (ex.: cloudflared ou VPS)

## Como rodar no celular (passo a passo)

1. Abra terminal na pasta do app:
   ```bash
   cd mobile/driver-app
   ```
2. Instale dependências:
   ```bash
   npm install
   ```
3. Crie o arquivo de ambiente:
   ```bash
   cp .env.example .env
   ```
4. Edite `.env` e ajuste a URL da API:
   ```env
   EXPO_PUBLIC_API_BASE_URL=https://SEU-DOMINIO-OU-TUNNEL/api
   ```
5. Suba o app Expo:
   ```bash
   npx expo start
   ```
6. No celular, abra **Expo Go** e escaneie o QR Code.
7. Faça login com um usuário existente no sistema web.

## Observações importantes

- Se usar `http://127.0.0.1` no celular, não funciona (127.0.0.1 no celular é o próprio celular).
- Para testar agora sem VPS, pode usar sua URL pública do cloudflared.
- Em produção, troque para `https://app.kaiquetransportes.com.br/api`.

## Próximos passos sugeridos

- Cadastro de viagens do motorista (`iniciar/finalizar`)
- Checklist com upload de foto
- Ocorrências com prioridade
- Tela de histórico do dia
