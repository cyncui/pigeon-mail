# 🕊️ Pigeon Mail

_Take a photo in the moment, write a note, and we mail your friend a real postcard._

Pigeon Mail is a postcard for the digital age — with a deliberately analog ending. You snap a photo of where you are or what you're doing ("thought of you while I was here"), add a short note and the place or activity, enter a friend's mailing address, and Pigeon Mail **prints and physically mails them a real postcard.**

The point is the gesture and the _artefact_: not a notification that gets buried in a thread, but a physical object that lands in someone's mailbox and lives on their fridge. The recipient needs no app and no account — they just get mail.

## How it works

1. **Capture** — take a photo (the front of the card).
2. **Compose** — add a short note plus the place/activity it came from.
3. **Address** — enter the recipient's physical mailing address.
4. **Preview** — see the finished postcard, front and back.
5. **Send** — the app hands the card to a print-and-mail API ([Lob](https://www.lob.com/)), which prints it and drops it in the mail.

The sender uses the app; the recipient just receives physical mail. No receiving app required.

## Status

🚧 **Early setup.** The Expo app is scaffolded and verified running on web + device. The postcard flow, camera, and Lob integration are next, once the Figma designs land. See [Roadmap](#roadmap).

## Tech stack

| Area | Choice |
| --- | --- |
| App | Expo (SDK 56) · React Native 0.85 · React 19 · TypeScript |
| Navigation | Expo Router — file-based routing in `src/app/` |
| Styling | React Native `StyleSheet` + design tokens in `src/constants/theme.ts` (no Tailwind/NativeWind) |
| Print & mail | [Lob](https://www.lob.com/) — US + Canada, **test mode** during development |
| Payments | None yet — v1 is free/beta on Lob's test mode; Stripe later |
| Backend | A thin server (TBD) for the Lob call + image upload, so secrets stay server-side |

## Prerequisites

- **Node.js** 20+ (developed on 24)
- **watchman** — `brew install watchman` (recommended for file watching)
- **Expo Go** on your iPhone (App Store) for on-device testing
- Full **Xcode** is _optional_ — only for the iOS Simulator or local native builds. App Store releases go through EAS Build in the cloud, so it's never strictly required.

## Getting started

```bash
npm install        # if you just cloned
npx expo start
```

Then:

- Press **`w`** to open in your **browser** — the fastest iteration loop.
- **Scan the QR code** with your iPhone to open in **Expo Go** (keep phone and computer on the same Wi-Fi). This is the truest test surface: real iOS, real camera.

Edits hot-reload on both.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run start` | Start the Expo dev server |
| `npm run web` / `ios` / `android` | Start targeting a specific platform |
| `npm run lint` | Run Expo's ESLint |
| `npm run reset-project` | ⚠️ Moves the starter code aside for a blank slate — don't run casually |

## Project structure

```
src/
  app/                 # Expo Router routes (file-based)
    _layout.tsx        # tab layout
    index.tsx          # Home (starter)
    explore.tsx        # Explore (starter)
  components/          # shared UI (ThemedText, ThemedView, …)
  constants/
    theme.ts           # Colors (light/dark), Fonts, Spacing, layout tokens
  hooks/               # useColorScheme, useTheme
  global.css           # web font variables
assets/                # icons, images, splash
```

## Conventions

- **Read the versioned Expo docs for SDK 56 before writing native code** — APIs changed (the template's `AGENTS.md` flags this): <https://docs.expo.dev/versions/v56.0.0/>
- **Styling** uses `StyleSheet.create` + tokens from `theme.ts` (`Spacing.three`, `Colors`, `Fonts`). Prefer the `ThemedText` / `ThemedView` components so light/dark mode works automatically.
- **Routing** is file-based — add a screen by adding a file under `src/app/`.

## Roadmap

- [ ] Restructure routes into the real flow: **Capture → Compose → Address → Preview → Sent**
- [ ] Camera, photo library, and location (`expo-camera`, `expo-image-picker`, `expo-location`)
- [ ] Translate the Figma designs into themed components
- [ ] Backend + image upload; **Lob test-mode** send (full pipeline, end-to-end, free)
- [ ] Address entry/validation and postcard print specs (4×6 @ 300 DPI)
- [ ] Go-live: Stripe payments, real mailing, optional sender accounts
- [ ] Android + App Store via EAS Build
