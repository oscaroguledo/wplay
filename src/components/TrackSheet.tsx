import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Track } from '../services/downloader';
import { useApp } from '../state/AppState';
import { colors } from '../theme';
import { genreSummary, shareTrack, trackDetails } from '../trackActions';
import Cover from './Cover';
import GenrePicker from './GenrePicker';
import Icon, { type IconName } from './Icon';
import LyricsSheet from './LyricsSheet';
import Pill from './Pill';

type Props = { track: Track | null; onClose: () => void };

type Section = 'playlists' | 'genres' | 'about' | null;

/** One line of the menu: icon, label, optional value on the right. */
function Row({
  icon,
  label,
  value,
  onPress,
  danger,
  active,
  expanded,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  active?: boolean;
  /** Set for rows that open a section below them: shows an up/down chevron. */
  expanded?: boolean;
}) {
  const tint = danger
    ? colors.danger
    : active
    ? colors.accentSoft
    : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: colors.surfaceHigh }}
      style={styles.row}
    >
      <Icon name={icon} size={22} color={tint} />
      {/* With no value to its right, the label takes the spare width so any chevron sits at the edge. */}
      <Text style={[styles.rowLabel, !value && styles.grow, { color: tint }]}>
        {label}
      </Text>
      {!!value && (
        <Text numberOfLines={1} style={styles.rowValue}>
          {value}
        </Text>
      )}
      {expanded !== undefined && (
        <Icon
          name={expanded ? 'up' : 'down'}
          size={20}
          color={colors.textFaint}
        />
      )}
    </Pressable>
  );
}

/** The ⋮ menu for a song: every action that applies to one track. */
export default function TrackSheet({ track, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const {
    tracks,
    playlists,
    analysing,
    current,
    repeatMode,
    updateTrack,
    detectGenreFor,
    toggleInPlaylist,
    removeTrack,
    repeatSong,
  } = useApp();
  const [open, setOpen] = useState<Section>(null);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  // Read the live copy so the sheet reflects each change as soon as it is made.
  const live = tracks.find(t => t.id === track?.id) ?? track;

  // Start collapsed each time the menu is opened for a different song.
  useEffect(() => {
    setOpen(null);
    setLyricsOpen(false);
  }, [track?.id]);

  if (!live) {
    return null;
  }

  const toggleSection = (section: Section) =>
    setOpen(now => (now === section ? null : section));
  const inPlaylists = playlists.filter(p => p.trackIds.includes(live.id));
  const finding = analysing.includes(live.id);
  const repeating = current?.id === live.id && repeatMode === 1;

  const confirmDelete = () =>
    Alert.alert(live.title, `Delete this track from ${live.folder}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onClose();
          removeTrack(live).catch(() => {});
        },
      },
    ]);

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onClose} />
      <ScrollView
        style={styles.sheet}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
      >
        <View style={styles.header}>
          <Cover track={live} size={48} />
          <View style={styles.headerText}>
            <Text numberOfLines={1} style={styles.title}>
              {live.title}
            </Text>
            <Text numberOfLines={1} style={styles.artist}>
              {live.artist}
            </Text>
          </View>
        </View>

        <Row
          icon={live.liked ? 'heart' : 'heartOutline'}
          label={live.liked ? 'Liked' : 'Like'}
          active={live.liked}
          onPress={() => {
            updateTrack(live, { liked: !live.liked }).catch(() => {});
          }}
        />

        <Row
          icon="playlistAdd"
          label="Playlists"
          value={inPlaylists.map(p => p.name).join(', ') || 'None'}
          expanded={open === 'playlists'}
          onPress={() => toggleSection('playlists')}
        />
        {open === 'playlists' && (
          <View style={styles.section}>
            {playlists.length === 0 ? (
              <Text style={styles.hint}>
                No playlists yet. Create one from Library → Playlists.
              </Text>
            ) : (
              <View style={styles.wrap}>
                {playlists.map(p => (
                  <Pill
                    key={p.id}
                    label={p.name}
                    active={p.trackIds.includes(live.id)}
                    onPress={() => toggleInPlaylist(p.id, live.id)}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        <Row
          icon="tag"
          label="Genres"
          value={finding ? 'Working it out…' : genreSummary(live) || 'Unknown'}
          expanded={open === 'genres'}
          onPress={() => toggleSection('genres')}
        />
        {open === 'genres' && (
          <View style={styles.section}>
            <Text style={styles.hint}>
              {genreSummary(live) || 'No genre yet.'}
            </Text>
            <View style={styles.detect}>
              <Pill
                label={
                  finding
                    ? 'Working it out…'
                    : 'Detect again (online, then audio)'
                }
                disabled={finding}
                onPress={() => {
                  detectGenreFor(live).catch(() => {});
                }}
              />
            </View>
            <Text style={styles.sectionLabel}>Or choose one yourself</Text>
            <GenrePicker
              value={live.category ?? ''}
              extra={
                [
                  ...new Set(tracks.map(t => t.category).filter(Boolean)),
                ] as string[]
              }
              onChange={category => {
                updateTrack(live, {
                  category,
                  genres: category,
                  genreSource: 'manual',
                }).catch(() => {});
              }}
            />
          </View>
        )}

        <Row
          icon="repeatOne"
          label={repeating ? 'Repeating this song' : 'Repeat this song'}
          active={repeating}
          onPress={() => repeatSong(live)}
        />
        <Row icon="lyrics" label="Lyrics" onPress={() => setLyricsOpen(true)} />
        <Row icon="share" label="Share" onPress={() => shareTrack(live)} />

        <Row
          icon="info"
          label="About this song"
          expanded={open === 'about'}
          onPress={() => toggleSection('about')}
        />
        {open === 'about' && (
          <View style={styles.section}>
            {trackDetails(live).map(([label, value]) => (
              <View key={label} style={styles.detail}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={styles.detailValue} selectable>
                  {value}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Row icon="delete" label="Delete" danger onPress={confirmDelete} />
      </ScrollView>

      {lyricsOpen && (
        <LyricsSheet track={live} onClose={() => setLyricsOpen(false)} />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    flexGrow: 0,
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  headerText: { flex: 1, marginLeft: 14 },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  artist: { color: colors.textDim, fontSize: 13, marginTop: 3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  rowLabel: { fontSize: 16 },
  grow: { flex: 1 },
  rowValue: {
    flex: 1,
    textAlign: 'right',
    color: colors.textDim,
    fontSize: 13,
  },
  section: { paddingHorizontal: 20, paddingBottom: 12 },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 10,
  },
  hint: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detect: { flexDirection: 'row', marginTop: 10 },
  detail: { flexDirection: 'row', paddingVertical: 6 },
  detailLabel: { width: 76, color: colors.textFaint, fontSize: 13 },
  detailValue: { flex: 1, color: colors.text, fontSize: 13 },
});
