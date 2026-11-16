import { useState, type ReactElement } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';

import type { Track } from '../services/downloader';
import { useApp } from '../state/AppState';
import { colors } from '../theme';
import TrackRow from './TrackRow';
import TrackSheet from './TrackSheet';

type Props = {
  /** Rows to show. */
  tracks: Track[];
  /** What tapping a row queues up; defaults to `tracks`. Lets a paged list queue every result. */
  queue?: Track[];
  /** Name shown for the queue this list starts, e.g. a playlist's name. */
  queueName?: string;
  empty: string;
  header?: ReactElement;
  footer?: ReactElement;
  /** Called when the list is scrolled near its end, to load the next page. */
  onEndReached?: () => void;
};

/** Vertical song list. Tapping a row plays it and queues the rest of the list. */
export default function TrackList({
  tracks,
  queue,
  queueName,
  empty,
  header,
  footer,
  onEndReached,
}: Props) {
  const { current, playTrack } = useApp();
  const [menuFor, setMenuFor] = useState<Track | null>(null);

  return (
    <>
      <FlatList
        data={tracks}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={<Text style={styles.empty}>{empty}</Text>}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <TrackRow
            track={item}
            active={item.id === current?.id}
            onPress={() => playTrack(item, queue ?? tracks, queueName)}
            onMore={() => setMenuFor(item)}
          />
        )}
      />
      <TrackSheet track={menuFor} onClose={() => setMenuFor(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  empty: { color: colors.textFaint, marginHorizontal: 16, marginTop: 8 },
});
