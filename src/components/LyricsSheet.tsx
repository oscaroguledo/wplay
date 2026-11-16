import { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Track } from '../services/downloader';
import { useApp } from '../state/AppState';
import { colors } from '../theme';
import IconButton from './IconButton';
import Pill from './Pill';

type Props = { track: Track | null; onClose: () => void };

/**
 * Shows the lyrics saved for a track. The app does not fetch lyrics itself: the user finds them
 * (a button opens a web search) and pastes them in, and they are stored with the track.
 */
export default function LyricsSheet({ track, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { tracks, updateTrack } = useApp();
  const live = tracks.find(t => t.id === track?.id) ?? track;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setEditing(false);
    setDraft(live?.lyrics ?? '');
    // Reset only when a different track is opened, not on every lyrics save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.id]);

  if (!live) {
    return null;
  }

  const searchOnline = () => {
    const q = encodeURIComponent(`${live.artist} ${live.title} lyrics`);
    Linking.openURL(`https://www.google.com/search?q=${q}`).catch(() => {});
  };

  const save = () => {
    updateTrack(live, { lyrics: draft.trim() }).catch(() => {});
    setEditing(false);
  };

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
        ]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.heading}>Lyrics</Text>
            <Text numberOfLines={1} style={styles.sub}>
              {live.title} • {live.artist}
            </Text>
          </View>
          <IconButton icon="close" label="Close lyrics" onPress={onClose} />
        </View>

        {editing ? (
          <>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              autoFocus
              placeholder="Paste or type the lyrics here"
              placeholderTextColor={colors.textFaint}
              textAlignVertical="top"
              style={styles.editor}
            />
            <View style={styles.actions}>
              <Pill label="Save" active onPress={save} />
              <Pill label="Cancel" onPress={() => setEditing(false)} />
            </View>
          </>
        ) : (
          <>
            <ScrollView style={styles.body}>
              {live.lyrics ? (
                <Text style={styles.lyrics} selectable>
                  {live.lyrics}
                </Text>
              ) : (
                <Text style={styles.empty}>
                  No lyrics saved for this song yet. Find them online, then
                  paste them here to keep them with the song.
                </Text>
              )}
            </ScrollView>
            <View style={styles.actions}>
              <Pill label="Find lyrics online" onPress={searchOnline} />
              <Pill
                label={live.lyrics ? 'Edit' : 'Paste lyrics'}
                active={!live.lyrics}
                onPress={() => {
                  setDraft(live.lyrics ?? '');
                  setEditing(true);
                }}
              />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerText: { flex: 1, marginRight: 12 },
  heading: { color: colors.text, fontSize: 22, fontWeight: '700' },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 3 },
  body: { flex: 1 },
  lyrics: { color: colors.text, fontSize: 17, lineHeight: 28 },
  empty: { color: colors.textFaint, fontSize: 15, lineHeight: 22 },
  editor: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.surfaceHigh,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
});
