import { useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';

import { colors } from '../theme';

type Props = {
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
};

/** Tap or drag to seek. The playback position only changes when the finger lifts. */
export default function SeekBar({ position, duration, onSeek }: Props) {
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);

  const ratioAt = (e: GestureResponderEvent) =>
    width > 0 ? Math.min(1, Math.max(0, e.nativeEvent.locationX / width)) : 0;

  const ratio =
    drag ?? (duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0);

  return (
    <View
      style={{ height: 32, justifyContent: 'center' }}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => duration > 0}
      onMoveShouldSetResponder={() => duration > 0}
      onResponderGrant={e => setDrag(ratioAt(e))}
      onResponderMove={e => setDrag(ratioAt(e))}
      onResponderRelease={e => {
        onSeek(ratioAt(e) * duration);
        setDrag(null);
      }}
      onResponderTerminate={() => setDrag(null)}>
      <View
        pointerEvents="none"
        style={{ height: 3, borderRadius: 2, backgroundColor: '#4d4d4d' }}>
        <View
          style={{
            height: 3,
            borderRadius: 2,
            width: `${ratio * 100}%`,
            backgroundColor: colors.text,
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: ratio * width - 7,
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: colors.text,
        }}
      />
    </View>
  );
}
