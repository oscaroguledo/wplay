import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import {
  canonicalGenre,
  genreFromModel,
  genreFromTags,
  normalizeGenre,
} from '../genres';
import {
  deleteTrack,
  detectGenre,
  downloadAudio,
  getLibrary,
  loadPlaylists,
  onDownloadProgress,
  recordPlay,
  savePlaylists,
  setTrackFields,
  type Playlist,
  type Track,
} from '../services/downloader';
import { lookupGenres } from '../services/musicbrainz';
import {
  onPlayerState,
  player,
  type PlayerEvent,
  type RepeatMode,
} from '../services/player';

type DownloadState = {
  busy: boolean;
  /** 0–1 */
  progress: number;
  status: string;
  error: boolean;
};

type AppState = {
  tracks: Track[];
  download: DownloadState;
  /** `genre` may be '' to have it worked out from metadata, tags, or the audio model. */
  startDownload: (url: string, genre: string) => Promise<boolean>;
  /**
   * Finds a track's genres online (MusicBrainz) or, failing that, with the audio model, and saves
   * them. Returns the main genre, or '' if neither found one.
   */
  detectGenreFor: (track: Track) => Promise<string>;
  /** Ids of tracks whose genre is currently being worked out. */
  analysing: string[];
  removeTrack: (track: Track) => Promise<void>;
  updateTrack: (
    track: Track,
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
  ) => Promise<void>;

  playlists: Playlist[];
  createPlaylist: (name: string) => void;
  deletePlaylist: (id: string) => void;
  /** Adds the track to the playlist, or removes it if it is already there. */
  toggleInPlaylist: (playlistId: string, trackId: string) => void;

  current: Track | null;
  /** The list playback is running through, in its unshuffled order. */
  queue: Track[];
  /** Where the queue came from: "Library", a playlist name, a category… Repeat-all loops this. */
  queueName: string;
  playing: boolean;
  position: number;
  duration: number;
  repeatMode: RepeatMode;
  shuffle: boolean;
  /** Plays `track`, queueing the rest of `queue` (default: the whole library) around it. */
  playTrack: (track: Track, queue?: Track[], queueName?: string) => void;
  /** Plays a whole list from the top, or from a random song with shuffle switched on. */
  playAll: (list: Track[], queueName: string, shuffled: boolean) => void;
  skipTo: (index: number) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  /** Off → repeat all → repeat one → off. */
  cycleRepeat: () => void;
  /** Repeats one song: starts it if it is not the one playing, then switches repeat-one on. */
  repeatSong: (track: Track) => void;
  toggleShuffle: () => void;
};

const Context = createContext<AppState | null>(null);

export function useApp(): AppState {
  const value = useContext(Context);
  if (!value) {
    throw new Error('useApp must be used inside AppStateProvider');
  }
  return value;
}

let askedForNotifications = false;

/** Android 13+ needs this for the playback notification to appear in the shade. */
function ensureNotificationPermission() {
  if (
    askedForNotifications ||
    Platform.OS !== 'android' ||
    Number(Platform.Version) < 33
  ) {
    return;
  }
  askedForNotifications = true;
  PermissionsAndroid.request(
    'android.permission.POST_NOTIFICATIONS' as never,
  ).catch(() => {});
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [download, setDownload] = useState<DownloadState>({
    busy: false,
    progress: 0,
    status: '',
    error: false,
  });
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [queueName, setQueueName] = useState('Library');
  const [analysing, setAnalysing] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(0);
  const [shuffle, setShuffle] = useState(false);

  // Event handlers read these so they never act on a stale render.
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const currentIdRef = useRef(currentId);
  currentIdRef.current = currentId;

  const current = useMemo(
    () => tracks.find(t => t.id === currentId) ?? null,
    [tracks, currentId],
  );
  const queue = useMemo(
    () =>
      queueIds
        .map(id => tracks.find(t => t.id === id))
        .filter((t): t is Track => !!t),
    [tracks, queueIds],
  );

  const refresh = useCallback(async () => {
    try {
      const library = await getLibrary();
      // Tracks tagged under a genre name that has since been renamed or merged follow it.
      const renamed = library.filter(
        t => t.category && canonicalGenre(t.category) !== t.category,
      );
      if (renamed.length > 0) {
        await Promise.all(
          renamed.map(t =>
            setTrackFields(t.id, { category: canonicalGenre(t.category!) }),
          ),
        );
        setTracks(await getLibrary());
      } else {
        setTracks(library);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const apply = (event: PlayerEvent, countPlay: boolean) => {
      if (event.id !== currentIdRef.current) {
        currentIdRef.current = event.id;
        setCurrentId(event.id);
        if (event.id && countPlay) {
          recordPlay(event.id)
            .then(refresh)
            .catch(() => {});
        }
      }
      setPlaying(event.playing);
      setPosition(event.ended ? 0 : event.position);
      if (event.duration > 0) {
        setDuration(event.duration);
      }
      setRepeatMode(event.repeatMode ?? 0);
      setShuffle(!!event.shuffle);
    };

    refresh();
    loadPlaylists()
      .then(setPlaylists)
      .catch(() => {});
    // Pick up a track the service was already playing before this JS session started.
    player
      .getState()
      .then(state => state && apply(state, false))
      .catch(() => {});

    const offPlayer = onPlayerState(event => apply(event, true));
    const offDownload = onDownloadProgress(event => {
      if (event.stage === 'preparing') {
        setDownload(d => ({ ...d, status: 'Starting downloader…' }));
      } else if (event.stage === 'converting') {
        setDownload(d => ({ ...d, progress: 1, status: 'Converting to MP3…' }));
      } else {
        const eta = event.eta >= 0 ? ` · ${Math.round(event.eta)}s left` : '';
        setDownload(d => ({
          ...d,
          progress: Math.min(1, Math.max(0, event.progress / 100)),
          status: `Downloading ${event.progress.toFixed(0)}%${eta}`,
        }));
      }
    });
    return () => {
      offDownload();
      offPlayer();
    };
  }, [refresh]);

  const detectGenreFor = useCallback(
    async (track: Track) => {
      setAnalysing(ids => [...ids, track.id]);
      try {
        // People's tags first (MusicBrainz), then the artist's other songs, then the audio model.
        const online = await lookupGenres(track.artist, track.title);
        if (online.length > 0) {
          await setTrackFields(track.id, {
            category: online[0],
            genres: online.join('|'),
            genreSource: 'musicbrainz',
          });
          await refresh();
          return online[0];
        }
        // Next best: another song by the same artist whose genre came from something more
        // reliable than the audio model (you, metadata, the source site's tags, MusicBrainz).
        const sibling = tracksRef.current.find(
          t =>
            t.id !== track.id &&
            t.category &&
            t.genreSource &&
            t.genreSource !== 'model' &&
            t.genreSource !== 'artist' &&
            t.artist.trim().toLowerCase() ===
              track.artist.trim().toLowerCase() &&
            !/^unknown artist$/i.test(t.artist),
        );
        if (sibling?.category) {
          await setTrackFields(track.id, {
            category: sibling.category,
            genres: sibling.genres ?? sibling.category,
            genreSource: 'artist',
          });
          await refresh();
          return sibling.category;
        }
        const guess = genreFromModel(await detectGenre(track.id));
        if (guess) {
          await setTrackFields(track.id, {
            category: guess.genres[0],
            genres: guess.genres.join('|'),
            genreSource: 'model',
            genreConfidence: guess.confidence,
          });
          await refresh();
        }
        return guess?.genres[0] ?? '';
      } finally {
        setAnalysing(ids => ids.filter(id => id !== track.id));
      }
    },
    [refresh],
  );

  const startDownload = useCallback(
    async (url: string, genre: string) => {
      setDownload({
        busy: true,
        progress: 0,
        status: 'Starting…',
        error: false,
      });
      try {
        const track = await downloadAudio(url, genre);
        // Genre, most trustworthy source first: your choice, the file's metadata, the source
        // site's tags, MusicBrainz, and only then the audio model.
        let filed = genre;
        if (genre) {
          await setTrackFields(track.id, {
            genres: genre,
            genreSource: 'manual',
          });
        } else {
          const fromMeta = normalizeGenre(track.metaGenre);
          const fromTags = fromMeta ? '' : genreFromTags(track.tags);
          if (fromMeta || fromTags) {
            filed = fromMeta || fromTags;
            await setTrackFields(track.id, {
              category: filed,
              genres: filed,
              genreSource: fromMeta ? 'metadata' : 'tags',
            });
          } else {
            setDownload(d => ({
              ...d,
              status: 'Working out the genre…',
            }));
            filed = await detectGenreFor(track).catch(() => '');
          }
        }
        await refresh();
        setDownload({
          busy: false,
          progress: 0,
          status:
            `Saved “${track.title}” to ${track.folder}` +
            (filed ? ` · ${filed}` : ''),
          error: false,
        });
        return true;
      } catch (e) {
        setDownload({
          busy: false,
          progress: 0,
          status: e instanceof Error ? e.message : 'Download failed',
          error: true,
        });
        return false;
      }
    },
    [refresh, detectGenreFor],
  );

  const changePlaylists = useCallback(
    (change: (list: Playlist[]) => Playlist[]) => {
      setPlaylists(list => {
        const next = change(list);
        savePlaylists(next).catch(() => {});
        return next;
      });
    },
    [],
  );

  const removeTrack = useCallback(
    async (track: Track) => {
      if (currentIdRef.current === track.id) {
        player.stop();
      }
      await deleteTrack(track.id);
      changePlaylists(list =>
        list.map(p => ({
          ...p,
          trackIds: p.trackIds.filter(id => id !== track.id),
        })),
      );
      await refresh();
    },
    [refresh, changePlaylists],
  );

  const updateTrack = useCallback<AppState['updateTrack']>(
    async (track, fields) => {
      // Show the change immediately, then persist it.
      setTracks(list =>
        list.map(t => (t.id === track.id ? { ...t, ...fields } : t)),
      );
      await setTrackFields(track.id, fields);
      await refresh();
    },
    [refresh],
  );

  const createPlaylist = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }
      changePlaylists(list => [
        ...list,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: trimmed,
          trackIds: [],
          createdAt: Date.now(),
        },
      ]);
    },
    [changePlaylists],
  );

  const deletePlaylist = useCallback(
    (id: string) => changePlaylists(list => list.filter(p => p.id !== id)),
    [changePlaylists],
  );

  const toggleInPlaylist = useCallback(
    (playlistId: string, trackId: string) =>
      changePlaylists(list =>
        list.map(p =>
          p.id !== playlistId
            ? p
            : {
                ...p,
                trackIds: p.trackIds.includes(trackId)
                  ? p.trackIds.filter(id => id !== trackId)
                  : [...p.trackIds, trackId],
              },
        ),
      ),
    [changePlaylists],
  );

  const playTrack = useCallback(
    (track: Track, list?: Track[], name?: string) => {
      ensureNotificationPermission();
      const source = list?.length ? list : tracksRef.current;
      const index = source.findIndex(t => t.id === track.id);
      const items = index >= 0 ? source : [track];
      setQueueIds(items.map(t => t.id));
      setQueueName(list?.length && name ? name : 'Library');
      setDuration(track.duration);
      setPosition(0);
      player.setQueue(items, Math.max(0, index)).catch(() => setPlaying(false));
    },
    [],
  );

  const playAll = useCallback(
    (list: Track[], name: string, shuffled: boolean) => {
      if (list.length === 0) {
        return;
      }
      player.setShuffle(shuffled);
      setShuffle(shuffled);
      const start = shuffled ? Math.floor(Math.random() * list.length) : 0;
      playTrack(list[start], list, name);
    },
    [playTrack],
  );

  const toggle = useCallback(() => {
    setPlaying(wasPlaying => {
      if (wasPlaying) {
        player.pause();
      } else {
        player.resume();
      }
      return !wasPlaying;
    });
  }, []);

  const next = useCallback(() => player.next(), []);
  const previous = useCallback(() => player.previous(), []);
  const skipTo = useCallback((index: number) => player.skipTo(index), []);
  const seek = useCallback((seconds: number) => {
    player.seekTo(seconds);
    setPosition(seconds);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatMode(mode => {
      const nextMode: RepeatMode = mode === 0 ? 2 : mode === 2 ? 1 : 0;
      player.setRepeatMode(nextMode);
      return nextMode;
    });
  }, []);

  const repeatSong = useCallback(
    (track: Track) => {
      if (currentIdRef.current !== track.id) {
        playTrack(track, [track], track.title);
      }
      player.setRepeatMode(1);
      setRepeatMode(1);
    },
    [playTrack],
  );

  const toggleShuffle = useCallback(() => {
    setShuffle(on => {
      player.setShuffle(!on);
      return !on;
    });
  }, []);

  const value = useMemo(
    () => ({
      tracks,
      download,
      startDownload,
      detectGenreFor,
      analysing,
      removeTrack,
      updateTrack,
      playlists,
      createPlaylist,
      deletePlaylist,
      toggleInPlaylist,
      current,
      queue,
      queueName,
      playing,
      position,
      duration,
      repeatMode,
      shuffle,
      playTrack,
      playAll,
      skipTo,
      toggle,
      next,
      previous,
      seek,
      cycleRepeat,
      repeatSong,
      toggleShuffle,
    }),
    [
      tracks,
      download,
      startDownload,
      detectGenreFor,
      analysing,
      removeTrack,
      updateTrack,
      playlists,
      createPlaylist,
      deletePlaylist,
      toggleInPlaylist,
      current,
      queue,
      queueName,
      playing,
      position,
      duration,
      repeatMode,
      shuffle,
      playTrack,
      playAll,
      skipTo,
      toggle,
      next,
      previous,
      seek,
      cycleRepeat,
      repeatSong,
      toggleShuffle,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
