# Kaique Driver App

Mobile companion app for drivers. This app is an MVP focused on authenticated access from a phone using the same backend as the web platform.

## Current Scope

- Login with the existing web system credentials through `/api/login`.
- Persisted mobile session so the user does not need to sign in every time.
- Current user lookup through `/api/me`.
- API base URL configured through environment variables.

## Development With Expo Go

### 1. Prepare the phone

Install **Expo Go** from the Android Play Store.

### 2. Prepare the project

From the repository root:

```powershell
cd mobile\driver-app
Copy-Item .env.example .env
```

Set the public API URL:

```env
EXPO_PUBLIC_API_BASE_URL=https://app.kaiquetransportes.com.br/api
```

Install dependencies and start Expo:

```powershell
npm install
npx expo start --lan --port 8092
```

### 3. Open on the phone

1. Keep the phone and computer on the same Wi-Fi network.
2. Open Expo Go.
3. Scan the QR code shown in the terminal.
4. If the QR code fails, open manually with `exp://YOUR_LOCAL_IP:8092`.
5. Sign in with an account already registered in the web system.

## Android APK Build

The app can be built through Expo EAS without setting up Android Studio locally.

From `mobile/driver-app`:

```powershell
npm install
npx eas login
npx eas build -p android --profile preview
```

Expo will provide a download link for the APK after the build finishes.

## Notes

- `127.0.0.1` does not work from a phone when the API is running on a computer.
- Use the public API domain when testing against the deployed backend.
- APK builds are installed directly on Android. They do not open inside Expo Go.
- The current production domain is `https://app.kaiquetransportes.com.br`.
