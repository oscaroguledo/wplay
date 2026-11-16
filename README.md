# W Play

[![CI](https://github.com/oscaroguledo/wplay/actions/workflows/ci.yml/badge.svg)](https://github.com/oscaroguledo/wplay/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/Version-1.0.0-7d1524)
![Platform](https://img.shields.io/badge/Platform-Android%207.0%2B-3DDC84?logo=android&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22.11%2B-5FA04E?logo=nodedotjs&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.88.1-61DAFB?logo=react&logoColor=black)
![React](https://img.shields.io/badge/React-19.3.0-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)
![Kotlin](https://img.shields.io/badge/Kotlin-2.2.0-7F52FF?logo=kotlin&logoColor=white)
![Media3](https://img.shields.io/badge/AndroidX%20Media3-1.11.1-4285F4?logo=android&logoColor=white)
![yt-dlp](https://img.shields.io/badge/yt--dlp-2026.10.26-FF0000)
![ONNX Runtime](https://img.shields.io/badge/ONNX%20Runtime-1.32.0-005CED?logo=onnx&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-29-C21325?logo=jest&logoColor=white)
![Licence](https://img.shields.io/badge/Licence-MIT-blue)

**W Play** is an Android music player and downloader. It fetches audio with a copy of yt-dlp that runs on the phone, converts it to a tagged MP3 with cover art, files it by genre, and plays it back with lock-screen and notification controls.

Everything happens on the device. There is no backend server, no account, and no API key to configure.

> **Use it responsibly.** Download only material you own, have permission to download, or that its rights holder offers for download, and respect the terms of the sites you use.

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [Genre detection](#genre-detection)
- [Storage and data](#storage-and-data)
- [Privacy and network use](#privacy-and-network-use)
- [Keeping yt-dlp up to date](#keeping-yt-dlp-up-to-date)
- [Regenerating assets](#regenerating-assets)
- [Testing](#testing)
- [Building and releasing](#building-and-releasing)
- [Known limitations](#known-limitations)
- [Third-party components and licences](#third-party-components-and-licences)
- [Conventions](#conventions)
- [Licence](#licence)

---

## Features

**Download**
- Paste a link; the audio is downloaded, converted to MP3 and saved to the shared `Download/Music` folder.
- Title, artist, album and cover art are written into the file as ID3 tags, so other music apps show them too.
- Live progress, with the time remaining.

**Playback**
- Background playback with notification, lock-screen and headset controls.
- Queue, shuffle, and repeat: off, repeat all (the playlist, genre or library you started from), or repeat one.
- Mini player on every screen and a full Now Playing screen with a seek bar.

**Library**
- Songs, playlists, and an automatic "Liked songs" playlist.
- Search by title, artist, album or genre, with results loaded 20 at a time as you scroll.
- Recent plays and most-played favourites on Home.

**Genres**
- A swipeable genre carousel on Home (eight cards per page). Genres that have songs come first.
- A song can belong to up to three genres.
- Genres are worked out automatically from several sources and can always be changed by hand. See [Genre detection](#genre-detection).

**Per-song menu**
- Like, playlists, genres, repeat this song, lyrics, share, song details, and delete.
- Lyrics are saved by the user: the app opens a web search for them and stores what is pasted in. It does not fetch lyrics itself.

---

## Tech stack

| Area | Technology |
| --- | --- |
| Languages | TypeScript 6.0 (app), Kotlin 2.2 (native modules), Python 3.13 (embedded, for yt-dlp) |
| Framework | React Native 0.88 (New Architecture, Hermes), React 19.3 |
| Navigation | A hand-rolled four-tab shell in `App.tsx`; no navigation library |
| State | React context (`src/state/AppState.tsx`) |
| Downloading | yt-dlp 2026.10.26, run in the Python runtime embedded by `yt-dlp-android` 2.0.2 (Chaquopy) |
| Audio conversion | FFmpegKit (`ffmpeg-kit-audio` 8.1.9): MP3 encoding, ID3 tags and cover art, decoding for analysis |
| Playback | AndroidX Media3 1.11 (ExoPlayer and a `MediaSessionService`) |
| Genre model | Discogs-EffNet (400 music styles) on ONNX Runtime for Android 1.32 |
| Genre lookup | MusicBrainz web API |
| Storage | Android MediaStore for the MP3s; JSON files in the app's private storage for the library and playlists |
| Icons | Material Design Icons paths drawn with `react-native-svg` 15 |
| Layout | `react-native-safe-area-context` 5 (edge-to-edge) |
| Testing | Jest 29 with the React Native preset |
| Code quality | ESLint 8 (`@react-native/eslint-config`), Prettier 2.8, `tsc` |
| CI/CD | GitHub Actions: checks and an Android build on every push; a signed release APK on every version tag |
| Build | Gradle 9.4, Android Gradle Plugin from React Native; `minSdk` 24, `targetSdk` 36, `compileSdk` 37 |

---

## Getting started

### Requirements

- **Node.js 22.11 or newer** and npm
- A JDK and the Android SDK set up for React Native (see the [environment guide](https://reactnative.dev/docs/set-up-your-environment))
- A **64-bit** Android phone or emulator running Android 7.0 or newer. The embedded Python runtime ships `arm64-v8a` and `x86_64` only, so 32-bit ABIs are excluded in [`android/gradle.properties`](android/gradle.properties).

No environment variables, accounts or API keys are needed.

### Install and run

```bash
git clone https://github.com/oscaroguledo/wplay.git
cd wplay
npm ci
npm start                 # Metro dev server; leave it running
npm run android           # in a second terminal: build, install and launch
```

`npm run android` installs a **debug build**, which loads its JavaScript from the Metro server. The app therefore only opens while the phone can reach the computer (over USB, `adb reverse tcp:8081 tcp:8081` forwards the port). To run without a computer, make a release build; see [Building and releasing](#building-and-releasing).

On Android 13 and newer the app asks for the notification permission the first time a song is played. It is needed for the playback notification.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the Metro development server |
| `npm run android` | Build the debug app, install it on a connected device or emulator, and launch it |
| `npm test` | Run the Jest tests once |
| `npm run lint` | Lint the code with ESLint |
| `npm run typecheck` | Type check with `tsc` |

---

## Project structure

```
App.tsx                      Tab shell: header, four tabs, mini player, Now Playing
src/
├── screens/                 Home, Download, Search, Library, Now Playing
├── components/              Track rows and lists, song menu, genre picker, lyrics sheet,
│                            mini player, seek bar, icons
├── state/AppState.tsx       Library, playlists, download progress and playback state
├── services/
│   ├── downloader.ts        Typed bridge to the native download module
│   ├── player.ts            Typed bridge to the native player module
│   └── musicbrainz.ts       Genre lookup by artist and title
├── genres.ts                Genre list, aliases, and the model-style-to-genre mapping
├── trackActions.ts          Share, genre summary and "about this track" rows
├── theme.ts                 Colour tokens and formatters
└── assets/                  In-app logo

android/app/src/main/
├── java/com/wplay/
│   ├── YtDlpModule.kt       Download, MP3 conversion, library index, genre analysis
│   ├── PlaybackService.kt   Media3 session service that owns the player and queue
│   ├── PlayerModule.kt      JS-facing controller for the playback service
│   └── YtDlpPackage.kt      Registers the two native modules
├── assets/
│   ├── pylibs/              The bundled yt-dlp wheel
│   ├── discogs_effnet.onnx  Genre model
│   ├── mel_filterbank_96x257.f32
│   └── discogs_classes.json The model's 400 style names
└── res/                     Launcher icons, notification icon, strings

scripts/
├── make_logo.py             Generates the logo and launcher icons
└── verify_mel_features.py   Checks the model's input stage against Essentia
```

The `ios/` folder comes from the React Native template. iOS is not supported: none of the native modules has an iOS implementation.

---

## Architecture

**Two native modules, one JS state provider.** The React Native side holds the interface and decides what happens; the Kotlin side does the heavy work. `YtDlpModule` and `PlayerModule` are classic native modules reached through React Native's interop layer, and they report progress and playback state back as device events.

**Downloads.** `YtDlpModule` calls yt-dlp through a small Python function, not through the library's Java wrapper, because the wrapper returns neither the output path nor any metadata. Each download goes into its own temporary folder; FFmpegKit then writes the MP3 with ID3 tags and cover art, and the file is published to `Download/Music` through MediaStore. Jobs run one at a time on a single worker, because the embedded Python interpreter is shared across the process.

**Playback.** `PlaybackService` is a Media3 `MediaSessionService` that owns an ExoPlayer and the queue. Running as a foreground media service is what keeps music playing in the background and gives Android its notification and lock-screen controls. `PlayerModule` is a thin `MediaController` client, so playback carries on if the JavaScript side reloads, and a freshly started JS session picks up whatever is already playing.

**State.** `AppStateProvider` is the single source of truth on the JS side for the library, playlists, download progress and playback. Changes to a track are shown at once and then saved. The library index and playlists are stored natively, so they survive reinstalling the JavaScript bundle.

**UI.** Screens are built from the components in `src/components` and take every colour from `src/theme.ts`. All four tab screens stay mounted, so typed text and scroll positions survive switching tabs. Icons are SVG paths, so the app needs no icon font.

---

## Genre detection

A song's genre is decided by the first of these sources that gives an answer:

| # | Source | Shown in the app as |
| --- | --- | --- |
| 1 | The genre the user picks | set by you |
| 2 | The genre stated by the source site or in the file's own tags | from the file's metadata |
| 3 | Genre words in the tags the source site attached | from the source site's tags |
| 4 | [MusicBrainz](https://musicbrainz.org), looked up by artist and title | from MusicBrainz |
| 5 | Another song by the same artist whose genre came from 1 to 4 | same as your other songs by this artist |
| 6 | The on-device audio model | detected from the audio, with a confidence |

**The model.** Step 6 uses Discogs-EffNet from the [Essentia](https://essentia.upf.edu/models.html) project, which scores 400 Discogs music styles. The app listens to three 20-second stretches of the track and keeps up to three genres. A style the app has a genre for is filed there; any other style falls back to its parent genre. The list of genres, their aliases and this mapping are in [`src/genres.ts`](src/genres.ts).

**Why it comes last.** The model is a suggestion, not ground truth. Its confidence is often low, and its style list has gaps: there is no modern Afrobeats entry, for example, so such a song can come out as a neighbouring style. That is the reason for steps 1 to 5.

**How the input stage was verified.** The model expects a log-mel spectrogram computed exactly as Essentia computes it. [`scripts/verify_mel_features.py`](scripts/verify_mel_features.py) compares a plain NumPy implementation with Essentia's own (they agree to about 10⁻⁵) and writes the mel filterbank the app ships. The Kotlin code in `YtDlpModule.kt` follows the NumPy version: 16 kHz mono, 512-sample Hann frames every 256 samples, power spectrum, 96 mel bands, `log10(1 + 10000·x)`, in patches of 128 frames.

---

## Storage and data

| What | Where |
| --- | --- |
| MP3 files | Shared storage, `Download/Music`, through MediaStore (Android 10 and newer). On Android 7 to 9 they stay in the app's own `Music` folder, because shared storage there needs a runtime permission. |
| Library index | `library.json` in the app's private storage: title, artist, genres, play count, liked, saved lyrics, and the file's location |
| Cover images | `covers/` in the app's private storage |
| Playlists | `data_playlists.json` in the app's private storage |

Uninstalling the app removes the index, covers and playlists. MP3s saved to `Download/Music` stay on the phone.

---

## Privacy and network use

The app has no analytics and no server of its own. It contacts the network only for these purposes:

- **Downloading**: requests go to the site the pasted link points to, through yt-dlp, and to the address of the track's thumbnail.
- **Genre lookup**: when no earlier source gives a genre, the song's artist and title are sent to MusicBrainz.
- **Lyrics**: "Find lyrics online" opens a web search in the browser. Nothing is fetched by the app.

ONNX Runtime's Android package registers a telemetry start-up component. It is removed from the merged manifest in [`AndroidManifest.xml`](android/app/src/main/AndroidManifest.xml).

---

## Keeping yt-dlp up to date

Sites change often, and an out-of-date yt-dlp is the usual reason a download starts failing. The `yt-dlp-android` library bundles an older yt-dlp, so the app ships its own: it loads the newest `yt_dlp-*.whl` found in [`android/app/src/main/assets/pylibs/`](android/app/src/main/assets/pylibs/) ahead of the library's copy.

To update, replace that file with a newer wheel and rebuild:

```bash
rm android/app/src/main/assets/pylibs/yt_dlp-*.whl
pip download yt-dlp --no-deps --only-binary :all: -d android/app/src/main/assets/pylibs/
```

The app logs the version it loaded (`wplay: using yt-dlp …`) on the first download after it starts.

---

## Regenerating assets

**Logo and launcher icons.** Needs Python with Pillow:

```bash
python scripts/make_logo.py android/app/src/main/res src/assets preview.png
```

This writes the legacy launcher icons for every density and the in-app mark, plus a preview sheet. The adaptive icon (Android 8 and newer) is drawn from the vector files in `res/drawable`.

**Model filterbank.** Needs Python with `numpy<2`, `essentia` and `onnxruntime`, the model file, and a 16 kHz mono float WAV to test with:

```bash
python scripts/verify_mel_features.py track.wav discogs-effnet-bsdynamic-1.onnx discogs-effnet-bsdynamic-1.json out/
```

---

## Testing

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # Jest
```

Unit tests live in `__tests__/` and cover the logic that decides what the app shows:

| Suite | Covers |
| --- | --- |
| `genres.test.ts` | Normalising genre names, finding genres in tags, turning the model's style scores into genres, multi-genre tracks |
| `musicbrainz.test.ts` | Cleaning titles and artist names, and the lookup itself against a faked network: recording tags, the artist fallback, weak matches, failures |
| `trackActions.test.ts` | The genre summary, the "about this track" rows, and sharing |
| `theme.test.ts` | Time and size formatting |
| `App.test.tsx` | The app renders with the native modules absent |

The native Kotlin code has no unit tests. Downloading, conversion, playback, the media session, genre detection on the device and the song menu have been checked by hand on a physical phone.

**Continuous integration.** [`ci.yml`](.github/workflows/ci.yml) runs on every push to `main` and every pull request: type check, lint and tests, then an Android debug build to prove the native code compiles. The debug APK is kept as a build artifact for a week.

---

## Building and releasing

### Versioning

The version has one source: `"version"` in [`package.json`](package.json), in `MAJOR.MINOR.PATCH` form. The Android build reads it:

- `versionName` is that string;
- `versionCode` is derived from it (`1.4.2` becomes `10402`), so each release sorts above the one before. MINOR and PATCH must stay below 100.

Changes are recorded in [`CHANGELOG.md`](CHANGELOG.md).

### Debug build

```bash
cd android
./gradlew assembleDebug                                        # both ABIs
./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a   # phones only; smaller
```

The APK is written to `android/app/build/outputs/apk/debug/`. It needs the Metro server to run.

### Release build

A release build contains its own JavaScript and runs without a computer. It must be signed with a private key that you keep: Android only installs an update if it is signed with the same key as the installed app.

1. Create a keystore once and keep it, and its passwords, somewhere safe and backed up:

   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore android/app/wplay-release.keystore \
     -alias wplay -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Tell the build where it is, in `android/keystore.properties` (ignored by git):

   ```properties
   storeFile=app/wplay-release.keystore
   storePassword=...
   keyAlias=wplay
   keyPassword=...
   ```

3. Build:

   ```bash
   cd android
   ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
   ```

   The APK is written to `android/app/build/outputs/apk/release/app-release.apk`.

Without a keystore the release build still works but is signed with the public debug key and prints a warning. Never distribute such a build.

> **Moving from a debug install to a release install wipes the app's data.** The two are signed with different keys, so Android refuses to update one with the other; the debug app has to be uninstalled first, which removes the library index, playlists and covers. The MP3 files in `Download/Music` stay on the phone.

### Publishing a release

1. Set the new version in `package.json` and add a section to `CHANGELOG.md`.
2. Commit, then tag and push: `git tag v1.2.3 && git push origin v1.2.3`.

[`release.yml`](.github/workflows/release.yml) checks that the tag matches `package.json`, builds the signed APK, and attaches it with its SHA-256 checksum to a GitHub Release whose notes are that version's changelog section.

The workflow signs with the keystore from four repository secrets. Until they are set, it stops after the version check and builds nothing:

```bash
base64 -i android/app/wplay-release.keystore | gh secret set WPLAY_KEYSTORE_BASE64
gh secret set WPLAY_KEYSTORE_PASSWORD
gh secret set WPLAY_KEY_ALIAS
gh secret set WPLAY_KEY_PASSWORD
```

---

## Known limitations

- **Android only**, 64-bit devices only.
- **Site support depends on yt-dlp.** A site can start refusing downloads at any time until yt-dlp is updated; some content (DRM-protected, members-only, age-restricted) cannot be downloaded at all.
- **Genres are best-effort.** See [Genre detection](#genre-detection).
- **Search is local**: it searches the downloaded library, not the web.
- **Lyrics are manual**: the app does not download them.
- **No automated tests of the native code.**
- **The repository includes binary assets** (an 18 MB model and a 3 MB yt-dlp wheel).

---

## Third-party components and licences

| Component | Used for | Licence |
| --- | --- | --- |
| [React Native](https://reactnative.dev) and React | App framework | MIT |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) (bundled wheel) | Fetching audio | Unlicense |
| `dev.ffmpegkit-maintained:yt-dlp-android` | Embedded Python runtime (Chaquopy) | MIT |
| `dev.ffmpegkit-maintained:ffmpeg-kit-audio` | MP3 conversion and audio decoding | LGPL-3.0 |
| [AndroidX Media3](https://developer.android.com/media/media3) | Playback and media session | Apache-2.0 |
| [ONNX Runtime](https://onnxruntime.ai) | Running the genre model | MIT |
| [Discogs-EffNet](https://essentia.upf.edu/models.html) (Essentia, MTG-UPF) | Genre model, `discogs_effnet.onnx` | **CC BY-NC-SA 4.0** |
| [react-native-svg](https://github.com/software-mansion/react-native-svg) | Drawing icons | MIT |
| [Material Design Icons](https://pictogrammers.com/library/mdi/) | Icon shapes in `src/components/Icon.tsx` | Apache-2.0 |
| [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API) | Online genre lookup | Core data CC0; tags and other supplementary data CC BY-NC-SA 3.0 |

**The genre model is licensed for non-commercial use only.** Before any commercial use of the app, replace or remove it: the `detectGenre` method in `YtDlpModule.kt` and the three model files in `assets/`. Genre steps 1 to 5 keep working without it.

---

## Conventions

- TypeScript throughout on the JS side; `npm run typecheck`, `npm run lint` and `npm test` must pass.
- Colours come from `src/theme.ts`, never hard-coded in screens.
- Calls to native modules go through `src/services`, not from screens or components.
- Anything that taps or types on a test device must first confirm W Play is the app in front.
- Comments explain why, not what.

---

## Licence

W Play's own code is released under the [MIT Licence](LICENSE).

That licence covers this project's code only. The bundled third-party components keep their own licences, listed above. In particular, the genre model is **non-commercial only** (CC BY-NC-SA 4.0), so the app as built here must not be sold or monetised while it includes that model.
