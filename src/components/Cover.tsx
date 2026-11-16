import { Image, Text, View } from 'react-native';

import type { Track } from '../services/downloader';
import { colors } from '../theme';

type Props = { track: Track; size: number; radius?: number };

/** Square artwork, or a lettered placeholder when the track has none. */
export default function Cover({ track, size, radius = 4 }: Props) {
  const style = { width: size, height: size, borderRadius: radius };
  if (track.cover) {
    return <Image source={{ uri: `file://${track.cover}` }} style={style} />;
  }
  return (
    <View
      style={[
        style,
        {
          backgroundColor: colors.surfaceHigh,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}>
      <Text
        style={{
          color: colors.textFaint,
          fontSize: size * 0.42,
          fontWeight: '700',
        }}>
        {(track.title.trim()[0] ?? '♪').toUpperCase()}
      </Text>
    </View>
  );
}
