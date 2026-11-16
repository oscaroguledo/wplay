import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import TrackList from '../components/TrackList';
import { useApp } from '../state/AppState';
import { colors } from '../theme';

const PAGE = 20;

/**
 * Searches the downloaded library by title, artist, album and genre. With nothing typed it
 * lists the whole library. Results appear 20 at a time, with more added as the list is scrolled.
 */
export default function SearchScreen() {
  const { tracks } = useApp();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return tracks;
    }
    return tracks.filter(t => {
      const haystack = [t.title, t.artist, t.album, t.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return words.every(w => haystack.includes(w));
    });
  }, [tracks, query]);

  // A new search starts again from the first page.
  useEffect(() => setLimit(PAGE), [query]);

  const shown = results.slice(0, limit);
  const typed = query.trim();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search</Text>
      <TextInput
        placeholder="Songs, artists, albums, genres"
        placeholderTextColor={colors.textFaint}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.input}
      />
      <TrackList
        tracks={shown}
        queue={results}
        queueName={typed ? 'Search results' : 'Library'}
        onEndReached={() => {
          if (limit < results.length) {
            setLimit(n => n + PAGE);
          }
        }}
        header={
          results.length > 0 ? (
            <Text style={styles.count}>
              {typed ? 'Results' : 'All songs'} • showing {shown.length} of{' '}
              {results.length}
            </Text>
          ) : undefined
        }
        empty={
          typed
            ? `Nothing in your library matches “${typed}”.`
            : 'Your library is empty. Add music from the Download tab.'
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
    marginHorizontal: 16,
  },
  input: {
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceHigh,
    color: colors.text,
    fontSize: 15,
  },
  count: {
    color: colors.textDim,
    fontSize: 13,
    marginHorizontal: 16,
    marginBottom: 8,
  },
});
