# W Play

An Android music player and downloader built with React Native. It downloads audio with an
embedded copy of yt-dlp, converts it to tagged MP3, files it by genre, and plays it back with
lock-screen and notification controls. Everything runs on the phone; there is no backend server.

> Only download material you own, have permission to download, or that is offered for download
> by its rights holder, and respect the terms of the sites you use.

## Features

- **Download**: paste a link; the audio is fetched, converted to MP3 with cover art and ID3 tags,
  and saved to the shared `Download/Music` folder.
- **Playback**: background playback through a Media3 session service, with notification,
  lock-screen and headset controls, a queue, shuffle, and repeat (off / all / one).
- **Library**: songs, playlists (plus an automatic "Liked songs" list), search with paged results,
  recent plays and most-played favourites.
- **Genres**: a swipeable genre carousel on Home. A song can belong to up to three genres.
- **Per-song menu**: like, playlists, genres, repeat, lyrics (saved by the user), share, details,
  delete.

## How a song's genre is decided

In order, stopping at the first source that gives an answer:

1. the genre the user picks;
2. the genre stated in the file's or source site's metadata;
3. genre words in the source site's tags;
4. [MusicBrainz](https://musicbrainz.org), looked up by artist and title;
5. another song by the same artist whose genre came from steps 1–4;
6. an on-device audio model (Discogs-EffNet, 400 music styles).

The model is a suggestion, not ground truth. Its style list has no modern Afrobeats entry, for
example, which is why steps 1–5 come first. The genre list and the mapping from the model's
styles to the app's genres live in [`src/genres.ts`](src/genres.ts).

## Project layout

| Path | What it holds |
| --- | --- |
| `App.tsx`, `src/screens/` | Tab shell and the Home, Download, Search, Library and Now Playing screens |
| `src/components/` | Shared UI: track rows, the song menu, pickers, icons |
| `src/state/AppState.tsx` | Library, playlists, download and playback state |
| `src/services/` | Bridges to the native modules, and the MusicBrainz client |
| `android/.../YtDlpModule.kt` | Download, MP3 conversion, library index, genre analysis |
| `android/.../PlaybackService.kt`, `PlayerModule.kt` | Media3 playback service and its JS-facing controller |
| `android/app/src/main/assets/` | The genre model, its mel filterbank and class list, and the bundled yt-dlp |
| `scripts/` | Tooling: logo/icon generator and the model-input verification script |

## Requirements

- Node 22.11 or newer
- JDK and the Android SDK set up for React Native
  ([environment guide](https://reactnative.dev/docs/set-up-your-environment))
- A 64-bit Android device or emulator (Android 7.0+). The embedded Python runtime ships
  `arm64-v8a` and `x86_64` only, so 32-bit ABIs are excluded in `android/gradle.properties`.

iOS is not supported: the template's `ios/` folder is present but none of the native modules
have an iOS implementation.

## Running

```sh
npm install
npm start                 # Metro dev server, in one terminal
npm run android           # build, install and launch, in another
```

To build for one ABI only (smaller and quicker to install):

```sh
cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a
```

Checks:

```sh
npx tsc --noEmit
npm run lint
npm test
```

## Updating yt-dlp

Sites change often, and an out-of-date yt-dlp is the usual reason a download starts failing. The
app loads the newest `yt_dlp-*.whl` found in `android/app/src/main/assets/pylibs/` ahead of the
older copy inside the `yt-dlp-android` library. To update, replace that file with a newer wheel
from PyPI and rebuild:

```sh
pip download yt-dlp --no-deps --only-binary :all: -d android/app/src/main/assets/pylibs/
```

Remove the old wheel so only one remains.

## Regenerating assets

- **Logo and launcher icons**: `python scripts/make_logo.py android/app/src/main/res src/assets preview.png`
  (needs Pillow).
- **Model input check**: `scripts/verify_mel_features.py` compares a plain NumPy log-mel
  spectrogram against Essentia's own and writes the mel filterbank the app ships. The Kotlin
  implementation in `YtDlpModule.kt` follows the NumPy version.

## Third-party components

| Component | Used for | Licence |
| --- | --- | --- |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) (bundled wheel) | Fetching audio | Unlicense |
| `dev.ffmpegkit-maintained:yt-dlp-android` | Embedded Python runtime (Chaquopy) | MIT |
| `dev.ffmpegkit-maintained:ffmpeg-kit-audio` | MP3 conversion and audio decoding | LGPL-3.0 |
| [AndroidX Media3](https://developer.android.com/media/media3) | Playback and media session | Apache-2.0 |
| [ONNX Runtime](https://onnxruntime.ai) | Running the genre model | MIT |
| [Discogs-EffNet](https://essentia.upf.edu/models.html) (Essentia, MTG-UPF) | Genre model (`discogs_effnet.onnx`) | **CC BY-NC-SA 4.0** |
| [Material Design Icons](https://pictogrammers.com/library/mdi/) | Icon shapes in `src/components/Icon.tsx` | Apache-2.0 |
| [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API) | Online genre lookup | Data: CC0 / CC BY-NC-SA |

The Discogs-EffNet model is licensed for **non-commercial use only**. Replace or remove it
(`detectGenre` in `YtDlpModule.kt` and the three model files in `assets/`) before any commercial
use of this app.

ONNX Runtime's Android package registers a telemetry start-up component; it is removed in
`AndroidManifest.xml`.
