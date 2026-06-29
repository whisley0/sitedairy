# Site Diary (React Native)

Dummy **React Native (Expo)** app for construction site diary management, backed by Firebase project **SiteDiary** (`sitediary-e91dd`, project number `898373108005`).

Includes Firebase SDK wiring and a **mock UI** that does not call real Auth or Firestore yet.

## Features (dummy preview)

| Tab | Purpose |
|-----|---------|
| **Home** | Dashboard with deadline reminders, open issues, escalations |
| **Progress** | Today's tasks and future tasks |
| **Observations** | Site observations (billable items flagged) |
| **Conditions** | Safety & quality issues |
| **Escalate** | Emergency escalation to upper management |
| **Chat** | On-device Gemini Nano chatbot (Android, ML Kit GenAI) |

## Gemini Nano chat (Android only)

The **Chat** tab uses **ML Kit GenAI Prompt API** to run **Gemini Nano on-device** on supported phones (including many Pixel devices with AICore).

- Shows model status (available / downloadable / unavailable)
- Displays **response time in ms** so you can measure efficiency
- Requires a **native Android build** — does not work in Expo Go

```bash
cd C:\Projects\sitedairy
npm run android:clean
```

**Pixel 8 note:** Google’s supported-device list changes over time. If status shows **Unavailable**, ensure AICore is installed/updated, the bootloader is locked, and the device has internet for first-time model config.

## Firebase setup (done)

- Android app registered: **SiteDiary** (`com.sitediary.app`)
- App ID: `1:898373108005:android:b38f71c2422ebd1799dacc`
- `google-services.json` at project root (linked in `app.json`)
- Firestore rules deployed via `firestore.rules`
- Firebase JS SDK initialized in `src/config/firebase.ts`

## One manual step in Firebase Console

Enable **Email/Password** sign-in:

1. Open [Firebase Console → SiteDiary → Authentication](https://console.firebase.google.com/project/sitediary-e91dd/authentication/providers)
2. Click **Email/Password** → Enable → Save

## Run the app

**Important:** Always run from `C:\Projects\sitedairy`. Do **not** use `npx expo` from `C:\Projects` — that causes `npm error ECOMPROMISED`.

```bash
cd C:\Projects\sitedairy
npm install
npm run android:clean
```

Or double-click `run-android.bat` in the project folder.

| Command | What it does |
|---------|----------------|
| `npm run android` | Build and install on device/emulator |
| `npm run android:clean` | Same as `npx expo run:android --no-build-cache` (safe) |
| `npm run start:clean` | Start Metro with cache cleared |
| `npm run clean` | Clear Expo/Metro/Android build caches |

Scan the QR code with **Expo Go** on your phone, or press `a` for Android emulator.

For a native Android build (uses registered `com.sitediary.app` + `google-services.json`):

```bash
npx expo prebuild --platform android
npm run android:clean
```

## Dummy auth

Sign in with any email and a password of 6+ characters — auth is simulated locally via `DummyAuthRepository`.

## Wiring real Firebase (later)

1. Replace `DummyAuthRepository` with `FirebaseAuthRepository` in `App.tsx`
2. Replace `DummySiteDiaryRepository` with Firestore queries
3. Enable Email/Password in Firebase Console (see above)

## Project structure

```
src/
├── config/firebase.ts       # Firebase JS SDK init
├── data/
│   ├── mockData.ts          # Sample data
│   ├── models.ts
│   ├── repositories.ts      # Dummy repos
│   └── firebaseAuthRepository.ts
├── screens/
├── navigation/MainTabs.tsx
└── components/
App.tsx
```

## Deploy Firestore rules

```bash
firebase deploy --only firestore:rules --project sitediary-e91dd
```
