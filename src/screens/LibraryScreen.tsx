import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Icon from '../components/Icon';
import IconButton from '../components/IconButton';
import Pill from '../components/Pill';
import TrackList from '../components/TrackList';
import type { Track } from '../services/downloader';
import { useApp } from '../state/AppState';
import { colors } from '../theme';

/** Id of the built-in playlist made of every liked song. */
const LIKED = 'liked';

type Props = { active: boolean };

export default function LibraryScreen({ active }: Props) {
  const { tracks, playlists, createPlaylist, deletePlaylist, playAll } =
    useApp();
  const [view, setView] = useState<'songs' | 'playlists'>('songs');
  const [openId, setOpenId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  // The system back button leaves an open playlist before it leaves the app.
  useEffect(() => {
    if (!active || !openId) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpenId(null);
      return true;
    });
    return () => sub.remove();
  }, [active, openId]);

  const liked = useMemo(() => tracks.filter(t => t.liked), [tracks]);
  const tracksOf = (ids: string[]) =>
    ids.map(id => tracks.find(t => t.id === id)).filter((t): t is Track => !!t);

  const tabs = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, styles.flex]}>Library</Text>
        <IconButton
          icon="shuffle"
          label="Shuffle the whole library"
          disabled={tracks.length === 0}
          onPress={() => playAll(tracks, 'Library', true)}
        />
        <IconButton
          icon="play"
          label="Play the whole library"
          filled
          disabled={tracks.length === 0}
          onPress={() => playAll(tracks, 'Library', false)}
        />
      </View>
      <View style={styles.segments}>
        <Pill
          label={`Songs · ${tracks.length}`}
          active={view === 'songs'}
          onPress={() => setView('songs')}
        />
        <Pill
          label={`Playlists · ${playlists.length + 1}`}
          active={view === 'playlists'}
          onPress={() => setView('playlists')}
        />
      </View>
    </View>
  );

  if (view === 'songs') {
    return (
      <TrackList
        tracks={tracks}
        empty="Nothing here yet. Add music from the Download tab."
        header={tabs}
      />
    );
  }

  const open =
    openId === LIKED
      ? { id: LIKED, name: 'Liked songs', list: liked }
      : playlists
          .filter(p => p.id === openId)
          .map(p => ({
            id: p.id,
            name: p.name,
            list: tracksOf(p.trackIds),
          }))[0];

  if (open) {
    return (
      <TrackList
        tracks={open.list}
        queueName={open.name}
        empty={
          open.id === LIKED
            ? 'Songs you like will appear here.'
            : "This playlist is empty. Add songs from a song's ⋮ menu."
        }
        header={
          <View style={styles.detailHeader}>
            <Pressable
              onPress={() => setOpenId(null)}
              hitSlop={12}
              accessibilityLabel="Back to playlists"
            >
              <Icon name="back" size={22} />
            </Pressable>
            <View style={styles.detailText}>
              <Text numberOfLines={1} style={styles.title}>
                {open.name}
              </Text>
              <Text style={styles.sub}>
                {open.list.length} {open.list.length === 1 ? 'song' : 'songs'}
              </Text>
            </View>
            {open.id !== LIKED && (
              <IconButton
                icon="delete"
                label={`Delete playlist ${open.name}`}
                onPress={() =>
                  Alert.alert(
                    open.name,
                    'Delete this playlist? The songs stay in your library.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          deletePlaylist(open.id);
                          setOpenId(null);
                        },
                      },
                    ],
                  )
                }
              />
            )}
            <IconButton
              icon="shuffle"
              label={`Shuffle ${open.name}`}
              disabled={open.list.length === 0}
              onPress={() => playAll(open.list, open.name, true)}
            />
            <IconButton
              icon="play"
              label={`Play ${open.name}`}
              filled
              disabled={open.list.length === 0}
              onPress={() => playAll(open.list, open.name, false)}
            />
          </View>
        }
      />
    );
  }

  const rows = [
    { id: LIKED, name: 'Liked songs', count: liked.length },
    ...playlists.map(p => ({
      id: p.id,
      name: p.name,
      count: tracksOf(p.trackIds).length,
    })),
  ];
  const canCreate = newName.trim().length > 0;
  const create = () => {
    if (canCreate) {
      createPlaylist(newName);
      setNewName('');
    }
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      {tabs}
      <View style={styles.createRow}>
        <TextInput
          placeholder="New playlist name"
          placeholderTextColor={colors.textFaint}
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={create}
          returnKeyType="done"
          style={styles.input}
        />
        <Pill label="Create" active disabled={!canCreate} onPress={create} />
      </View>
      {rows.map(row => (
        <Pressable
          key={row.id}
          onPress={() => setOpenId(row.id)}
          android_ripple={{ color: colors.surfaceHigh }}
          style={styles.playlistRow}
        >
          <View
            style={[
              styles.playlistArt,
              row.id === LIKED && { backgroundColor: colors.accent },
            ]}
          >
            {row.id === LIKED ? (
              <Icon name="heart" size={26} />
            ) : (
              <Icon name="playlist" size={26} color={colors.textDim} />
            )}
          </View>
          <View style={styles.playlistText}>
            <Text numberOfLines={1} style={styles.playlistName}>
              {row.name}
            </Text>
            <Text style={styles.sub}>
              {row.id === LIKED ? 'Auto playlist' : 'Playlist'} • {row.count}{' '}
              {row.count === 1 ? 'song' : 'songs'}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  segments: { flexDirection: 'row', gap: 8, marginTop: 12 },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 3 },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  detailText: { flex: 1, marginLeft: 6 },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceHigh,
    color: colors.text,
    fontSize: 15,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  playlistArt: {
    width: 52,
    height: 52,
    borderRadius: 6,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistText: { flex: 1, marginLeft: 14 },
  playlistName: { color: colors.text, fontSize: 16, fontWeight: '500' },
});
