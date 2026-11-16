import type { Track } from './services/downloader';

/**
 * Genres offered by the app. Each entry is `[name, ...aliases]`; aliases are other spellings seen
 * in metadata and the labels used by the on-device model. A genre found in a file's metadata that
 * is not listed here is kept as its own genre, so this list is a starting point, not a limit.
 *
 * (A track's genre is stored in its `category` field, which predates the move to genres.)
 */
const GENRE_TABLE: string[][] = [
  // African
  [
    'Afro',
    'afrobeats',
    'afrobeat',
    'african',
    'african music',
    'music of africa',
    'afropop',
    'afro-pop',
    'afro pop',
    'afro fusion',
    'naija',
  ],
  ['Amapiano'],
  ['Highlife'],
  ['Fuji'],
  ['Juju'],
  ['Afro House'],
  ['Kwaito'],
  ['Soukous', 'congolese rumba'],
  ['Bongo Flava'],
  // Sacred
  ['Gospel', 'gospel music'],
  [
    'Worship',
    'praise',
    'praise & worship',
    'praise and worship',
    'ccm',
    'christian',
    'christian music',
    'contemporary christian',
  ],
  ['Choral', 'choir', 'chorale', 'chorus'],
  ['Liturgical', 'liturgy', 'mass', 'sacred', 'sacred music'],
  ['Hymns', 'hymn'],
  ['Gregorian Chant', 'gregorian', 'plainchant'],
  // Classical and screen
  ['Classical', 'classical music', 'orchestral', 'symphony'],
  ['Opera'],
  ['Baroque'],
  ['Epic', 'cinematic', 'trailer music'],
  [
    'Soundtrack',
    'ost',
    'film score',
    'score',
    'theme music',
    'soundtrack music',
  ],
  ['Video Game', 'video game music', 'vgm'],
  // Pop, hip-hop, R&B
  ['Pop', 'pop music'],
  ['K-Pop', 'kpop', 'k pop'],
  ['J-Pop', 'jpop', 'j pop'],
  [
    'Hip-Hop',
    'hip hop',
    'hip hop music',
    'rap',
    'hip-hop/rap',
    'rapping',
    'pop rap',
  ],
  ['Trap'],
  ['Drill'],
  ['Grime'],
  [
    'R&B',
    'rnb',
    'r and b',
    'rhythm and blues',
    'rhythm & blues',
    'r&b/soul',
    'rnb/swing',
    'contemporary r&b',
  ],
  ['Soul', 'soul music'],
  ['Neo-Soul', 'neo soul'],
  ['Funk'],
  ['Disco'],
  // Rock
  ['Rock', 'rock music'],
  ['Rock & Roll', 'rock and roll', 'rock n roll'],
  ['Hard Rock'],
  ['Metal', 'heavy metal'],
  ['Punk', 'punk rock'],
  ['Grunge'],
  ['Progressive Rock', 'prog rock'],
  ['Psychedelic', 'psychedelic rock'],
  ['Indie', 'independent music', 'indie rock', 'indie pop'],
  ['Alternative', 'alt rock', 'alternative rock'],
  // Roots
  ['Blues'],
  ['Jazz'],
  ['Swing', 'swing music'],
  ['Country'],
  ['Bluegrass'],
  ['Folk', 'folk music'],
  ['Singer-Songwriter'],
  ['Acoustic'],
  // Caribbean and Latin
  ['Reggae'],
  ['Dancehall'],
  ['Dub'],
  ['Ska'],
  ['Soca'],
  ['Calypso'],
  ['Zouk'],
  ['Latin', 'music of latin america', 'latin music', 'latino'],
  ['Salsa', 'salsa music'],
  ['Reggaeton'],
  ['Bachata'],
  ['Merengue'],
  ['Flamenco'],
  ['Bossa Nova', 'bossanova'],
  ['Samba'],
  ['Tango'],
  // Electronic
  ['Electronic', 'electronic music', 'electronica'],
  ['EDM', 'electronic dance music'],
  ['House', 'house music'],
  ['Techno'],
  ['Trance', 'trance music'],
  ['Dubstep'],
  ['Drum & Bass', 'drum and bass', 'drum n bass', 'dnb', 'd&b'],
  ['Garage', 'uk garage'],
  ['Dance', 'dance music'],
  ['Ambient', 'ambient music'],
  ['Lo-fi', 'lofi', 'lo fi'],
  ['Chill', 'chillout', 'chill out', 'downtempo'],
  ['New Age', 'new-age music', 'new age music', 'new-age'],
  // Other
  ['Instrumental'],
  ['A Cappella', 'a capella', 'acapella', 'a cappella'],
  ['Bollywood', 'music of bollywood'],
  ['Indian Classical', 'carnatic music', 'carnatic', 'hindustani'],
  ['Middle Eastern', 'middle eastern music', 'arabic'],
  ['Asian', 'music of asia'],
  ['Traditional', 'traditional music'],
  ['World', 'world music'],
  ["Children's", 'music for children', 'kids', 'nursery rhymes'],
  ['Lullaby'],
  ['Christmas', 'christmas music', 'holiday'],
  ['Wedding', 'wedding music'],
  ['Spoken Word', 'spoken', 'poetry'],
  ['Musical Theatre', 'musical', 'musicals'],
  ['Marching Band', 'brass band', 'marches', 'military'],
];

export const GENRES: string[] = GENRE_TABLE.map(row => row[0]);

/** Every known spelling (lower case) → canonical genre name. */
const LOOKUP = new Map<string, string>();
GENRE_TABLE.forEach(([name, ...aliases]) => {
  [name, ...aliases].forEach(alias => LOOKUP.set(alias.toLowerCase(), name));
});

/** Label shown for songs whose genre is not known yet. */
export const UNKNOWN_GENRE = 'Unknown';

const PALETTE = [
  '#6d5a8c',
  '#b0692f',
  '#7a3340',
  '#3d5a73',
  '#8a3b2a',
  '#2f6f62',
  '#8a7433',
  '#45507a',
  '#5c6b2f',
  '#7a4a6b',
  '#2f5f7a',
  '#6b4a2f',
];

/** A stable colour for a genre's card, derived from its name. */
export function genreColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 9973;
  }
  return PALETTE[hash % PALETTE.length];
}

/** The current name for a stored genre, so tracks tagged under an older name follow a rename. */
export function canonicalGenre(stored: string): string {
  return LOOKUP.get(stored.toLowerCase()) ?? stored;
}

/**
 * Turns a genre string from metadata into a genre name. Known spellings map to the canonical
 * name; multi-genre strings ("Pop, Dance") use the first part that is known; anything else is
 * kept, tidied, as a genre of its own. Returns '' for empty or meaningless values.
 */
export function normalizeGenre(raw: string | null | undefined): string {
  const text = (raw ?? '').trim();
  if (!text || /^(music|other|unknown|misc|n\/a|none)$/i.test(text)) {
    return '';
  }
  const whole = LOOKUP.get(text.toLowerCase());
  if (whole) {
    return whole;
  }
  const parts = text
    .split(/[,;/|]/)
    .map(p => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    const known = LOOKUP.get(part.toLowerCase());
    if (known) {
      return known;
    }
  }
  const first = parts[0] ?? text;
  if (first.length > 30 || /^(music|other|unknown)$/i.test(first)) {
    return '';
  }
  return first.replace(/\b\w/g, c => c.toUpperCase());
}

/** Looks for a known genre among the tags the source site attached to the track. */
export function genreFromTags(tags: string | null | undefined): string {
  const text = ` ${(tags ?? '').toLowerCase()} `;
  if (!text.trim()) {
    return '';
  }
  // Longest spellings first, so "afro house" wins over "house".
  const spellings = [...LOOKUP.keys()].sort((a, b) => b.length - a.length);
  for (const spelling of spellings) {
    // "mass" and "score" are too ambiguous as loose tags.
    if (spelling.length < 4 || spelling === 'mass' || spelling === 'score') {
      continue;
    }
    const escaped = spelling.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`[^a-z0-9]${escaped}[^a-z0-9]`).test(text)) {
      return LOOKUP.get(spelling) ?? '';
    }
  }
  return '';
}

/** A stated or looked-up genre, only if it is one the app knows; '' otherwise. */
export function knownGenre(raw: string): string {
  return LOOKUP.get(raw.trim().toLowerCase()) ?? '';
}

/** Every genre a track is filed under: its main genre first, then any secondary ones. */
export function trackGenres(track: Track): string[] {
  const extra = (track.genres ?? '').split('|').filter(Boolean);
  return [...new Set([track.category ?? '', ...extra].filter(Boolean))];
}

/**
 * The audio model scores 400 Discogs styles, named "Parent---Style". A style the app has a genre
 * for is filed there; any other style falls back to its parent genre below.
 */
const DISCOGS_PARENT: Record<string, string> = {
  Blues: 'Blues',
  'Brass & Military': 'Marching Band',
  "Children's": "Children's",
  Classical: 'Classical',
  Electronic: 'Electronic',
  'Folk, World, & Country': 'World',
  'Funk / Soul': 'Soul',
  'Hip Hop': 'Hip-Hop',
  Jazz: 'Jazz',
  Latin: 'Latin',
  'Non-Music': '',
  Pop: 'Pop',
  Reggae: 'Reggae',
  Rock: 'Rock',
  'Stage & Screen': 'Soundtrack',
};

/** Style names that only make sense together with their parent ("Hip Hop---Instrumental"). */
const USE_PARENT = new Set([
  'instrumental',
  'acoustic',
  'classical',
  'psychedelic',
]);

export type ModelGuess = {
  /** Up to three genres, strongest first. */
  genres: string[];
  /** The model's score (0–1) for the strongest genre. */
  confidence: number;
};

/** Picks genres from the audio model's style scores. */
export function genreFromModel(
  scores: { label: string; score: number }[],
): ModelGuess | null {
  const byGenre = new Map<string, number>();
  scores.forEach(({ label, score }) => {
    const [parent, style = ''] = label.split('---');
    const key = style.toLowerCase();
    const genre =
      (USE_PARENT.has(key) ? undefined : LOOKUP.get(key)) ??
      DISCOGS_PARENT[parent] ??
      '';
    if (genre) {
      byGenre.set(genre, Math.max(byGenre.get(genre) ?? 0, score));
    }
  });
  const ranked = [...byGenre.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0 || ranked[0][1] < 0.05) {
    return null;
  }
  const top = ranked[0][1];
  return {
    // Secondary genres must be reasonably strong, both outright and next to the main one.
    genres: ranked
      .filter(([, score], i) => i === 0 || (score >= 0.1 && score >= top * 0.5))
      .slice(0, 3)
      .map(([genre]) => genre),
    confidence: top,
  };
}

/** How a track's genre was decided, for display. */
export function genreSourceLabel(track: Track): string {
  switch (track.genreSource) {
    case 'metadata':
      return 'from the file’s metadata';
    case 'tags':
      return 'from the source site’s tags';
    case 'musicbrainz':
      return 'from MusicBrainz';
    case 'artist':
      return 'same as your other songs by this artist';
    case 'model':
      return `detected from the audio, ${Math.round(
        track.genreConfidence * 100,
      )}% confidence`;
    case 'manual':
      return 'set by you';
    default:
      return '';
  }
}
