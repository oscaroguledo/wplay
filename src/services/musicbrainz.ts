import { knownGenre } from '../genres';

/**
 * Looks a song up on MusicBrainz (a free, community-maintained music database; no account
 * needed) and returns the genres people have tagged it, or its artist, with.
 */

const API = 'https://musicbrainz.org/ws/2';
// MusicBrainz asks every client to identify itself and to stay under one request a second.
const HEADERS = { 'User-Agent': 'WPlay/1.0 (personal music player)' };

async function getJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      headers: HEADERS,
      signal: controller.signal,
    });
    return response.ok ? await response.json() : null;
  } finally {
    clearTimeout(timer);
  }
}

/** Strips the noise video sites add to titles: "(Official Video)", "[Lyrics]", "ft. X"… */
export function cleanTitle(title: string, artist: string): string {
  let t = title
    .replace(
      /[([][^)\]]*(official|video|audio|lyric|visuali[sz]er|remaster|hd|4k|live|full)[^)\]]*[)\]]/gi,
      ' ',
    )
    .replace(/\b(ft|feat|featuring)\.?\s.*$/i, ' ');
  // "Artist - Title" → "Title"
  const dash = t.split(/\s[-–—]\s/);
  if (
    dash.length > 1 &&
    dash[0].trim().toLowerCase() === artist.toLowerCase()
  ) {
    t = dash.slice(1).join(' - ');
  }
  return t.replace(/\s+/g, ' ').trim();
}

/** Strips the suffixes video sites add to channel names. */
export function cleanArtist(artist: string): string {
  return artist
    .replace(/\s*-\s*topic$/i, '')
    .replace(/vevo$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type Tag = { name: string; count?: number };

/** Known genres among MusicBrainz tags, most-voted first, without repeats. */
function toGenres(tags: Tag[]): string[] {
  const sorted = [...tags].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  const genres = sorted.map(t => knownGenre(t.name)).filter(Boolean);
  return [...new Set(genres)].slice(0, 3);
}

const quote = (text: string) => `"${text.replace(/["\\]/g, ' ')}"`;

/** Up to three genres for the song, or [] when MusicBrainz has no confident match or no tags. */
export async function lookupGenres(
  artist: string,
  title: string,
): Promise<string[]> {
  const who = cleanArtist(artist);
  const what = cleanTitle(title, who);
  if (!who || !what || /^unknown artist$/i.test(who)) {
    return [];
  }
  try {
    const query = encodeURIComponent(
      `recording:${quote(what)} AND artist:${quote(who)}`,
    );
    const found = await getJson(
      `${API}/recording?query=${query}&limit=5&fmt=json`,
    );
    const hits: any[] = (found?.recordings ?? []).filter(
      (r: any) => (r.score ?? 0) >= 85,
    );
    if (hits.length === 0) {
      return [];
    }
    // Tags on the recording itself are the most specific.
    const recordingTags: Tag[] = hits.flatMap(r => r.tags ?? []);
    const fromRecording = toGenres(recordingTags);
    if (fromRecording.length > 0) {
      return fromRecording;
    }
    // Otherwise fall back to the artist's genres.
    const artistId = hits[0]['artist-credit']?.[0]?.artist?.id;
    if (!artistId) {
      return [];
    }
    await new Promise<void>(resolve => setTimeout(resolve, 1100));
    const person = await getJson(
      `${API}/artist/${artistId}?inc=genres+tags&fmt=json`,
    );
    return toGenres([...(person?.genres ?? []), ...(person?.tags ?? [])]);
  } catch {
    return [];
  }
}
