import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Track } from '../services/downloader';
import { colors, formatTime } from '../theme';
import Cover from './Cover';
import Icon from './Icon';

type Props = {
  track: Track;
  active: boolean;
  onPress: () => void;
  onMore: () => void;
};

export default function TrackRow({ track, active, onPress, onMore }: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onMore}
      android_ripple={{ color: colors.surfaceHigh }}
      style={styles.row}>
      <Cover track={track} size={52} />
      <View style={styles.text}>
        <Text
          numberOfLines={1}
          style={[styles.title, active && { color: colors.accentSoft }]}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={styles.subtitle}>
          {track.artist} • {formatTime(track.duration)}
          {track.category ? ` • ${track.category}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={onMore}
        hitSlop={12}
        accessibilityLabel={`More options for ${track.title}`}
        style={styles.more}>
        <Icon name="more" size={20} color={colors.textDim} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: { flex: 1, marginLeft: 14, marginRight: 8 },
  title: { color: colors.text, fontSize: 16, fontWeight: '500' },
  subtitle: { color: colors.textDim, fontSize: 13, marginTop: 3 },
  more: { padding: 4 },
});
