# Kaique Motorista (MVP)

Objetivo deste app: abrir no celular, usar login que já existe no sistema web e entrar.

## O que já está funcionando

- Login com usuário/senha do sistema atual (`/api/login`)
- Sessão salva no celular (não precisa logar toda hora)
- Consulta do usuário logado (`/api/me`)

---

## JEITO MAIS FÁCIL (funciona hoje): Expo Go (SDK 54)

### Passo 1 - No celular do motorista

1. Abrir Play Store.
2. Instalar **Expo Go**.

### Passo 2 - No notebook/PC com este projeto

Na raiz do projeto (`C:\xampp\htdocs\kaique-entrevista`), rode:

```powershell
cd scripts
.\start-fixed-domain-hosting.ps1
```

Agora rode:

```powershell
cd ..\mobile\driver-app
Copy-Item .env.example .env
```

Edite o `.env` e deixe assim:

```env
EXPO_PUBLIC_API_BASE_URL=https://app.kaiquetransportes.com.br/api
```

Depois rode:

```powershell
npm install
npx expo start --lan --port 8092
```

### Passo 3 - Abrir app no celular

1. Com celular e PC no mesmo Wi-Fi, abra o **Expo Go**.
2. Escaneie o QR Code que apareceu no terminal.
3. Se o QR falhar, use entrada manual no Expo Go com: `exp://SEU-IP-LOCAL:8092`
4. Faça login com uma conta já cadastrada no site.

Se entrou, missão cumprida ✅

---

## Para instalar em TODOS os motoristas (APK)

Você pode gerar APK em nuvem com Expo EAS (sem configurar Android Studio local).

No terminal, dentro de `mobile/driver-app`:

```powershell
npm install
npx eas login
npx eas build -p android --profile preview
```

Quando terminar, a Expo te dá um link para baixar o APK e instalar nos celulares.

### Importante sobre APK x Expo Go

- APK **não abre dentro do Expo Go**.
- APK é instalado direto no Android (arquivo `.apk`).
- Expo Go é só para teste de desenvolvimento.

Arquivo de configuração já pronto: `eas.json`.

---

## Importante

- `127.0.0.1` não funciona no celular para API do PC.
- Sem VPS, o notebook precisa ficar ligado para manter o backend no ar.
- Domínio fixo deste projeto: `https://app.kaiquetransportes.com.br`.
