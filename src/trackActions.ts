import { Share } from 'react-native';

import { genreSourceLabel, trackGenres } from './genres';
import type { Track } from './services/downloader';
import { formatSize, formatTime } from './theme';

/** Opens the system share sheet with the song's title, artist and source link. */
export function shareTrack(track: Track) {
  Share.share({
    message: `${track.title} — ${track.artist}\n${track.source}`,
  }).catch(() => {});
}

/** One line describing a track's genres and how they were decided, or '' if it has none. */
export function genreSummary(track: Track): string {
  const genres = trackGenres(track);
  if (genres.length === 0) {
    return '';
  }
  const source = genreSourceLabel(track);
  return genres.join(', ') + (source ? ` (${source})` : '');
}

/** The "About this track" rows, as [label, value] pairs; rows with no value are left out. */
export function trackDetails(track: Track): [string, string][] {
  const rows: [string, string][] = [
    ['Artist', track.artist],
    ['Album', track.album ?? ''],
    ['Year', track.year > 0 ? String(track.year) : ''],
    ['Genre', genreSummary(track)],
    ['Plays', String(track.playCount)],
    ['Length', formatTime(track.duration)],
    ['Source', track.site ?? ''],
    ['Link', track.source],
    ['File', track.fileName],
    ['Saved in', track.folder],
    ['Size', formatSize(track.size)],
    ['Added', new Date(track.addedAt).toLocaleDateString()],
  ];
  return rows.filter(([, value]) => value);
}
