import type { Track } from '../../src/services/downloader';

/** A complete track for tests; pass only the fields a test cares about. */
export function makeTrack(fields: Partial<Track> = {}): Track {
  return {
    id: 'track-1',
    title: 'Test Song',
    artist: 'Test Artist',
    album: null,
    duration: 185,
    uri: 'content://media/external/downloads/1',
    fileName: 'Test Artist - Test Song.mp3',
    folder: 'Download/Music',
    cover: null,
    source: 'https://example.com/watch/1',
    site: 'Example',
    year: 2024,
    size: 4 * 1024 * 1024,
    addedAt: Date.UTC(2026, 0, 15),
    category: null,
    metaGenre: null,
    genreSource: null,
    genres: null,
    genreConfidence: 0,
    playCount: 0,
    lastPlayedAt: 0,
    liked: false,
    lyrics: null,
    tags: null,
    ...fields,
  };
}
