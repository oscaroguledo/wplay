import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../state/AppState';
import { colors } from '../theme';
import Cover from './Cover';
import Icon from './Icon';

export default function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const { current, playing, position, duration, toggle, next } = useApp();
  if (!current) {
    return null;
  }
  const ratio = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <Pressable onPress={onOpen} style={styles.container}>
      <View style={styles.row}>
        <Cover track={current} size={44} />
        <View style={styles.text}>
          <Text numberOfLines={1} style={styles.title}>
            {current.title}
          </Text>
          <Text numberOfLines={1} style={styles.artist}>
            {current.artist}
          </Text>
        </View>
        <Pressable
          onPress={toggle}
          hitSlop={10}
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          style={styles.button}>
          <Icon name={playing ? 'pause' : 'play'} size={22} />
        </Pressable>
        <Pressable
          onPress={next}
          hitSlop={10}
          accessibilityLabel="Next track"
          style={styles.button}>
          <Icon name="next" size={22} />
        </Pressable>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surfaceHigh },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: { flex: 1, marginHorizontal: 12 },
  title: { color: colors.text, fontSize: 14, fontWeight: '600' },
  artist: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  button: { padding: 8 },
  track: { height: 2, backgroundColor: '#4d4d4d' },
  fill: { height: 2, backgroundColor: colors.text },
});
