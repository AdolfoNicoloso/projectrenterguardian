# Project Renter Guardian (PRG)

Mobile-first React Native (Expo) app for documenting rental property condition at move-in.

## Tech stack

- **Expo** ~51 / **React Native** 0.74 / **React** 18 / **TypeScript** ~5.3
- **Expo Router** — file-based routing
- **Zustand** — auth state
- **Firebase Auth** — identity
- **Cloud Functions** — API + ownership
- **Cloud Firestore** — app data
- **Cloud Storage** — photo bytes (`project-renter-guardian-media`)

See [docs/CURRENT_ARCHITECTURE.md](./docs/CURRENT_ARCHITECTURE.md).

**Using the app:** see [docs/QUICK_START.md](./docs/QUICK_START.md) for creating properties and running inspections.

## Quick start

```bash
npm install
```

Create a root `.env` with Firebase web config (`EXPO_PUBLIC_FIREBASE_*`). See architecture doc for required keys. No Directus/Strapi env vars.

```bash
npm run verify-setup
npm start          # Expo
# npm run ios | android | web
```

Backend (deployed): Functions already use Firestore. Local Functions:

```bash
cd functions && npm install && npm run serve
```

Set `EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true` to hit the emulator.

## Architecture (short)

```
Expo app → backendClient → Cloud Functions (Bearer ID token)
                        → Firestore + Storage
```

| Area | Path |
|------|------|
| Routes | `app/` |
| UI | `src/components/` |
| Property dashboard panels | `src/screens/` |
| Domain API clients | `src/services/` |
| Auth store | `src/state/authStore.ts` |
| HTTP handlers | `functions/src/http/` |
| Data layer | `functions/src/firestore/` |

## Core flows

1. **Auth** — Firebase login → `bootstrapProfile` creates/loads Firestore `app_profiles`
2. **Properties / spaces** — CRUD via Functions
3. **Photos** — client HEIC→JPEG if needed → `uploadFile` → `createPhoto` → `getFile` for display
4. **Inspections** — `createInspection` seeds steps; wizard updates steps/progress
5. **Reports** — `createReport` / list / detail (PDF export UI still stubbed)

## Coding rules

[docs/CODINGRULES.md](./docs/CODINGRULES.md)

Historical Directus/Strapi notes: [docs/archive/](./docs/archive/).

## Troubleshooting

- **App won’t start** — check `.env` Firebase vars; `npx expo start -c`
- **Auth fails** — Firebase Auth enabled; correct project id
- **Data empty** — user signed in; Functions deployed; Firestore rules deny client (expected — use Functions)
- **Photos fail** — file size &lt; 20MB; HEIC converted on client; Functions can write to media bucket
