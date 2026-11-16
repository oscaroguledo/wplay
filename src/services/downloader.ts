import { NativeEventEmitter, NativeModules } from 'react-native';

export type DownloadStage = 'preparing' | 'downloading' | 'converting';

export type DownloadProgress = {
  stage: DownloadStage;
  /** 0–100 */
  progress: number;
  /** Seconds remaining, or -1 when unknown. */
  eta: number;
};

export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  /** Seconds. */
  duration: number;
  /** Playable URI of the MP3 in shared storage. */
  uri: string;
  fileName: string;
  folder: string;
  /** Absolute path of the square cover image, if any. */
  cover: string | null;
  /** Page the track was downloaded from. */
  source: string;
  /** yt-dlp extractor name, e.g. "Youtube". */
  site: string | null;
  year: number;
  size: number;
  addedAt: number;
  /** The track's genre (the field name predates the move from categories to genres). */
  category: string | null;
  /** Genre exactly as the source site or the file's tags stated it, if they did. */
  metaGenre: string | null;
  /** How `category` was decided. */
  genreSource:
    | 'metadata'
    | 'tags'
    | 'musicbrainz'
    | 'artist'
    | 'model'
    | 'manual'
    | null;
  /** Every genre the track is filed under, joined with "|" (main genre first). */
  genres: string | null;
  /** For a model-detected genre: the model's score (0–1) for it. */
  genreConfidence: number;
  playCount: number;
  /** Epoch milliseconds, or 0 if never played. */
  lastPlayedAt: number;
  liked: boolean;
  /** Lyrics the user saved for this track. */
  lyrics: string | null;
  /** Genre-ish words from the source site, used to suggest a category. */
  tags: string | null;
};

export type Playlist = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
};

const { YtDlpModule } = NativeModules;

function requireModule() {
  if (!YtDlpModule) {
    throw new Error('Native downloader is unavailable');
  }
  return YtDlpModule;
}

export function downloadAudio(url: string, category: string): Promise<Track> {
  return requireModule().downloadAudio(url, category);
}

export function setCategory(
  id: string,
  category: string,
): Promise<Track | null> {
  return requireModule().setCategory(id, category);
}

export function setTrackFields(
  id: string,
  fields: Partial<
    Pick<
      Track,
      | 'category'
      | 'genres'
      | 'liked'
      | 'lyrics'
      | 'genreSource'
      | 'genreConfidence'
    >
  >,
): Promise<Track | null> {
  return requireModule().setTrackFields(id, JSON.stringify(fields));
}

/** Runs the on-device model over the track's audio; resolves its "Genre---Style" scores. */
export function detectGenre(
  id: string,
): Promise<{ label: string; score: number }[]> {
  return requireModule().detectGenre(id);
}

export async function loadPlaylists(): Promise<Playlist[]> {
  if (!YtDlpModule) {
    return [];
  }
  const raw: string | null = await YtDlpModule.getData('playlists');
  try {
    return raw ? (JSON.parse(raw) as Playlist[]) : [];
  } catch {
    return [];
  }
}

export function savePlaylists(playlists: Playlist[]): Promise<boolean> {
  return requireModule().setData('playlists', JSON.stringify(playlists));
}

export function recordPlay(id: string): Promise<Track | null> {
  return requireModule().recordPlay(id);
}

export function getLibrary(): Promise<Track[]> {
  return YtDlpModule ? YtDlpModule.getLibrary() : Promise.resolve([]);
}

export function deleteTrack(id: string): Promise<boolean> {
  return requireModule().deleteTrack(id);
}

export function onDownloadProgress(
  callback: (event: DownloadProgress) => void,
): () => void {
  if (!YtDlpModule) {
    return () => {};
  }
  const subscription = new NativeEventEmitter(YtDlpModule).addListener(
    'YtDlpProgress',
    event => callback(event as unknown as DownloadProgress),
  );
  return () => subscription.remove();
}
