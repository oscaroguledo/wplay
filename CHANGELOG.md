# Changelog

All notable changes to W Play are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-16

First release.

### Added

- Download audio from a pasted link with an on-device yt-dlp, converted to MP3 with ID3 tags and
  cover art and saved to `Download/Music`.
- Background playback with notification, lock-screen and headset controls, a queue, shuffle, and
  repeat (off, all, one).
- Library with songs, playlists and an automatic "Liked songs" playlist; search with paged
  results; recent plays and most-played favourites.
- Genre carousel on Home, with up to three genres per song.
- Automatic genres from, in order: the file's metadata, the source site's tags, MusicBrainz,
  the artist's other songs, and an on-device audio model (Discogs-EffNet).
- Per-song menu: like, playlists, genres, repeat, lyrics, share, details and delete.
- User-saved lyrics per song.
- Version taken from `package.json`, release signing from a private keystore, unit tests, and
  GitHub Actions for checks, Android builds and tagged releases.

[1.0.0]: https://github.com/oscaroguledo/wplay/releases/tag/v1.0.0
