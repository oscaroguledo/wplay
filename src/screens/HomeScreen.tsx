import { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import Cover from '../components/Cover';
import Icon from '../components/Icon';
import IconButton from '../components/IconButton';
import Pill from '../components/Pill';
import TrackList from '../components/TrackList';
import TrackRow from '../components/TrackRow';
import TrackSheet from '../components/TrackSheet';
import { genreColor, GENRES, trackGenres, UNKNOWN_GENRE } from '../genres';
import type { Track } from '../services/downloader';
import { useApp } from '../state/AppState';
import { colors } from '../theme';

type Props = { active: boolean; onGoToDownload: () => void };

/** Genre cards per carousel page: 2 columns × 4 rows. */
const PER_PAGE = 8;
const SIDE = 16;
const GAP = 10;

export default function HomeScreen({ active, onGoToDownload }: Props) {
  const { tracks, current, analysing, playTrack, playAll, detectGenreFor } =
    useApp();
  const [genre, setGenre] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<Track | null>(null);
  const [page, setPage] = useState(0);
  const { width } = useWindowDimensions();
  const tileWidth = Math.floor((width - SIDE * 2 - GAP) / 2);

  // The system back button leaves an open genre before it leaves the app.
  useEffect(() => {
    if (!active || !genre) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setGenre(null);
      return true;
    });
    return () => sub.remove();
  }, [active, genre]);

  // Genres that have songs come first (most songs first), then the rest of the list. Genres
  // found in metadata that are not in the built-in list get cards of their own.
  const cards = useMemo(() => {
    const counts = new Map<string, number>();
    let unknown = 0;
    // A song with several genres is counted under each of them.
    tracks.forEach(t => {
      const genres = trackGenres(t);
      if (genres.length === 0) {
        unknown++;
      }
      genres.forEach(g => counts.set(g, (counts.get(g) ?? 0) + 1));
    });
    const used = [...counts.keys()].sort(
      (a, b) =>
        (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b),
    );
    const rest = GENRES.filter(g => !counts.has(g));
    return [
      ...(unknown > 0 ? [{ name: UNKNOWN_GENRE, count: unknown }] : []),
      ...used.map(name => ({ name, count: counts.get(name) ?? 0 })),
      ...rest.map(name => ({ name, count: 0 })),
    ];
  }, [tracks]);

  const pages = useMemo(() => {
    const out: (typeof cards)[] = [];
    for (let i = 0; i < cards.length; i += PER_PAGE) {
      out.push(cards.slice(i, i + PER_PAGE));
    }
    return out;
  }, [cards]);

  const recent = useMemo(
    () =>
      tracks
        .filter(t => t.lastPlayedAt > 0)
        .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
        .slice(0, 10),
    [tracks],
  );

  const favourites = useMemo(
    () =>
      tracks
        .filter(t => t.playCount > 0)
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, 10),
    [tracks],
  );

  if (genre) {
    const isUnknown = genre === UNKNOWN_GENRE;
    const inGenre = tracks.filter(t =>
      isUnknown ? !t.category : trackGenres(t).includes(genre),
    );
    const busy = inGenre.some(t => analysing.includes(t.id));
    const detectAll = async () => {
      // One at a time: the model and the decoder share a single worker.
      for (const track of inGenre) {
        await detectGenreFor(track).catch(() => '');
      }
    };
    return (
      <TrackList
        tracks={inGenre}
        queueName={genre}
        empty={
          isUnknown
            ? 'Every song has a genre.'
            : "No songs in this genre yet. It is set when you download, or from a song's ⋮ menu."
        }
        header={
          <View>
            <View style={styles.genreHeader}>
              <Pressable
                onPress={() => setGenre(null)}
                hitSlop={12}
                accessibilityLabel="Back to Home"
              >
                <Icon name="back" size={26} />
              </Pressable>
              <View style={styles.genreHeaderText}>
                <Text style={styles.genreTitle}>{genre}</Text>
                <Text style={styles.genreCount}>
                  {inGenre.length} {inGenre.length === 1 ? 'song' : 'songs'}
                </Text>
              </View>
              <IconButton
                icon="shuffle"
                label={`Shuffle ${genre}`}
                disabled={inGenre.length === 0}
                onPress={() => playAll(inGenre, genre, true)}
              />
              <IconButton
                icon="play"
                label={`Play ${genre}`}
                filled
                disabled={inGenre.length === 0}
                onPress={() => playAll(inGenre, genre, false)}
              />
            </View>
            {isUnknown && inGenre.length > 0 && (
              <View style={styles.detectRow}>
                <Pill
                  label={
                    busy
                      ? 'Listening to your songs…'
                      : 'Find genres (online, then audio)'
                  }
                  active
                  disabled={busy}
                  onPress={detectAll}
                />
              </View>
            )}
          </View>
        }
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.section, styles.firstSection]}>Genres</Text>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e =>
          setPage(Math.round(e.nativeEvent.contentOffset.x / width))
        }
      >
        {pages.map((items, index) => (
          <View key={index} style={[styles.page, { width }]}>
            {items.map(({ name, count }) => (
              <Pressable
                key={name}
                onPress={() => setGenre(name)}
                style={[
                  styles.tile,
                  { width: tileWidth },
                  name === UNKNOWN_GENRE
                    ? styles.tilePlain
                    : { backgroundColor: genreColor(name) },
                  count === 0 && styles.tileEmpty,
                ]}
              >
                <Text numberOfLines={1} style={styles.tileName}>
                  {name}
                </Text>
                <Text style={styles.tileCount}>
                  {count} {count === 1 ? 'song' : 'songs'}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {pages.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index === page && styles.dotActive]}
          />
        ))}
      </View>

      <Text style={styles.section}>Recent plays</Text>
      {recent.length === 0 ? (
        <Text style={styles.empty}>Songs you play will appear here.</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {recent.map(track => (
            <Pressable
              key={track.id}
              onPress={() => playTrack(track, recent, 'Recent plays')}
              style={styles.card}
            >
              <Cover track={track} size={132} radius={6} />
              <Text numberOfLines={2} style={styles.cardTitle}>
                {track.title}
              </Text>
              <Text numberOfLines={1} style={styles.cardArtist}>
                {track.artist}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Text style={styles.section}>Favourites</Text>
      <Text style={styles.sectionHint}>Your most played</Text>
      {favourites.length === 0 ? (
        <Text style={styles.empty}>
          {tracks.length === 0
            ? 'Your library is empty.'
            : 'Play a few songs and your favourites will show here.'}
        </Text>
      ) : (
        favourites.map(track => (
          <TrackRow
            key={track.id}
            track={track}
            active={track.id === current?.id}
            onPress={() => playTrack(track, favourites, 'Favourites')}
            onMore={() => setMenuFor(track)}
          />
        ))
      )}

      {tracks.length === 0 && (
        <Pressable onPress={onGoToDownload} style={styles.cta}>
          <Text style={styles.ctaText}>Download your first song</Text>
        </Pressable>
      )}
      <TrackSheet track={menuFor} onClose={() => setMenuFor(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  section: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '700',
    marginTop: 28,
    marginBottom: 12,
    marginHorizontal: SIDE,
  },
  firstSection: { marginTop: 8 },
  sectionHint: {
    color: colors.textDim,
    fontSize: 13,
    marginTop: -8,
    marginBottom: 8,
    marginHorizontal: SIDE,
  },
  page: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    paddingHorizontal: SIDE,
    gap: GAP,
  },
  tile: {
    height: 72,
    borderRadius: 10,
    padding: 12,
    justifyContent: 'space-between',
  },
  tilePlain: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Genres with no songs yet are shown dimmed.
  tileEmpty: { opacity: 0.45 },
  tileName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tileCount: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: SIDE,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4d4d4d' },
  dotActive: { backgroundColor: colors.accentSoft, width: 14 },
  empty: { color: colors.textFaint, marginHorizontal: SIDE },
  carousel: { paddingHorizontal: SIDE, gap: 14 },
  card: { width: 132 },
  cardTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  cardArtist: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  cta: {
    marginTop: 24,
    marginHorizontal: SIDE,
    paddingVertical: 13,
    borderRadius: 24,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  ctaText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  genreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SIDE,
    paddingTop: 4,
    paddingBottom: 14,
  },
  genreHeaderText: { flex: 1, marginLeft: 6 },
  genreTitle: { color: colors.text, fontSize: 22, fontWeight: '700' },
  genreCount: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  detectRow: {
    flexDirection: 'row',
    paddingHorizontal: SIDE,
    marginBottom: 10,
  },
});
