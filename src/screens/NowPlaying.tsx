import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Cover from '../components/Cover';
import Icon from '../components/Icon';
import IconButton from '../components/IconButton';
import LyricsSheet from '../components/LyricsSheet';
import SeekBar from '../components/SeekBar';
import TrackSheet from '../components/TrackSheet';
import { useApp } from '../state/AppState';
import { colors, formatTime } from '../theme';
import { shareTrack, trackDetails } from '../trackActions';

type Props = { visible: boolean; onClose: () => void };

export default function NowPlaying({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const {
    current,
    queue,
    queueName,
    playing,
    position,
    duration,
    repeatMode,
    shuffle,
    toggle,
    next,
    previous,
    seek,
    skipTo,
    cycleRepeat,
    toggleShuffle,
    updateTrack,
  } = useApp();
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!current) {
    return null;
  }
  const artSize = Math.min(width - 56, height * 0.38);
  const details = trackDetails(current);

  // Repeat-all loops whatever was started: a playlist, a category, or the whole library.
  const repeatText =
    repeatMode === 1
      ? 'this song'
      : repeatMode === 2
      ? queueName === 'Library'
        ? 'the whole library'
        : `“${queueName}”`
      : 'off';

  const share = () => shareTrack(current);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 28,
        }}
      >
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={14}
            accessibilityLabel="Close player"
          >
            <Icon name="down" size={26} />
          </Pressable>
          <Text style={styles.headerText}>Now playing</Text>
          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={14}
            accessibilityLabel="Song options"
          >
            <Icon name="more" size={22} />
          </Pressable>
        </View>

        <View style={styles.art}>
          <Cover track={current} size={artSize} radius={8} />
        </View>

        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text numberOfLines={2} style={styles.title}>
              {current.title}
            </Text>
            <Text numberOfLines={1} style={styles.artist}>
              {current.artist}
            </Text>
          </View>
          <IconButton
            icon={current.liked ? 'heart' : 'heartOutline'}
            label={current.liked ? 'Unlike' : 'Like'}
            active={current.liked}
            size={26}
            onPress={() => {
              updateTrack(current, { liked: !current.liked }).catch(() => {});
            }}
          />
        </View>

        <View style={styles.seek}>
          <SeekBar position={position} duration={duration} onSeek={seek} />
          <View style={styles.times}>
            <Text style={styles.time}>{formatTime(position)}</Text>
            <Text style={styles.time}>{formatTime(duration)}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={previous}
            hitSlop={12}
            accessibilityLabel="Previous track"
          >
            <Icon name="previous" size={34} />
          </Pressable>
          <Pressable
            onPress={toggle}
            accessibilityLabel={playing ? 'Pause' : 'Play'}
            style={styles.playButton}
          >
            <Icon
              name={playing ? 'pause' : 'play'}
              size={30}
              color={colors.bg}
            />
          </Pressable>
          <Pressable
            onPress={next}
            hitSlop={12}
            accessibilityLabel="Next track"
          >
            <Icon name="next" size={34} />
          </Pressable>
        </View>

        <View style={styles.actions}>
          <IconButton
            icon="shuffle"
            label={shuffle ? 'Turn shuffle off' : 'Turn shuffle on'}
            active={shuffle}
            onPress={toggleShuffle}
          />
          <IconButton
            icon={repeatMode === 1 ? 'repeatOne' : 'repeat'}
            label={`Repeat: ${repeatText}. Tap to change`}
            active={repeatMode !== 0}
            onPress={cycleRepeat}
          />
          <IconButton
            icon="lyrics"
            label="Lyrics"
            onPress={() => setLyricsOpen(true)}
          />
          <IconButton icon="share" label="Share" onPress={share} />
          <IconButton
            icon="playlistAdd"
            label="Add to playlist"
            onPress={() => setMenuOpen(true)}
          />
        </View>
        <Text style={styles.modes}>
          {[
            shuffle ? 'Shuffle on' : '',
            repeatMode !== 0 ? `Repeating ${repeatText}` : '',
          ]
            .filter(Boolean)
            .join(' • ') || `Playing from ${queueName}`}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>About this track</Text>
          {details.map(([label, value]) => (
            <View key={label} style={styles.detail}>
              <Text style={styles.detailLabel}>{label}</Text>
              <Text style={styles.detailValue} selectable>
                {value}
              </Text>
            </View>
          ))}
        </View>

        {queue.length > 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Queue • {queueName}</Text>
            {queue.map((track, index) => {
              const isCurrent = track.id === current.id;
              return (
                <Pressable
                  key={track.id}
                  onPress={() => skipTo(index)}
                  style={styles.queueRow}
                >
                  <Cover track={track} size={40} />
                  <View style={styles.queueText}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.queueTitle,
                        isCurrent && { color: colors.accentSoft },
                      ]}
                    >
                      {track.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.queueArtist}>
                      {track.artist} • {formatTime(track.duration)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {lyricsOpen && (
        <LyricsSheet track={current} onClose={() => setLyricsOpen(false)} />
      )}
      {menuOpen && (
        <TrackSheet track={current} onClose={() => setMenuOpen(false)} />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: -8,
    height: 44,
  },
  headerText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  art: { alignItems: 'center', marginTop: 16, marginBottom: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  titleText: { flex: 1, marginRight: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  artist: { color: colors.textDim, fontSize: 16, marginTop: 6 },
  seek: { marginTop: 16 },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: colors.textDim, fontSize: 12 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    marginTop: 14,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  modes: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  card: {
    marginTop: 28,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surfaceHigh,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  queueRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  queueText: { flex: 1, marginLeft: 12 },
  queueTitle: { color: colors.text, fontSize: 14, fontWeight: '500' },
  queueArtist: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  detail: { flexDirection: 'row', paddingVertical: 7 },
  detailLabel: { width: 76, color: colors.textFaint, fontSize: 13 },
  detailValue: { flex: 1, color: colors.text, fontSize: 13 },
});
