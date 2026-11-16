import { useState } from 'react';
import {
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import Icon, { type IconName } from './src/components/Icon';
import MiniPlayer from './src/components/MiniPlayer';
import DownloadScreen from './src/screens/DownloadScreen';
import HomeScreen from './src/screens/HomeScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import NowPlaying from './src/screens/NowPlaying';
import SearchScreen from './src/screens/SearchScreen';
import { AppStateProvider } from './src/state/AppState';
import { colors } from './src/theme';

type Tab = 'home' | 'download' | 'search' | 'library';

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'download', label: 'Download', icon: 'download' },
  { key: 'search', label: 'Search', icon: 'search' },
  { key: 'library', label: 'Library', icon: 'library' },
];

function Shell() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home');
  const [playerOpen, setPlayerOpen] = useState(false);

  // Every screen stays mounted so typed text and scroll positions survive tab switches.
  const screen = (key: Tab) => [styles.screen, tab !== key && styles.hidden];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Image
          source={require('./src/assets/logo.png')}
          style={styles.logo}
          accessibilityIgnoresInvertColors
        />
        {/* The mark is the "W"; the wordmark completes the name. */}
        <Text style={styles.wordmark} accessibilityLabel="W Play">
          PLAY
        </Text>
      </View>

      <View style={screen('home')}>
        <HomeScreen
          active={tab === 'home'}
          onGoToDownload={() => setTab('download')}
        />
      </View>
      <View style={screen('download')}>
        <DownloadScreen />
      </View>
      <View style={screen('search')}>
        <SearchScreen />
      </View>
      <View style={screen('library')}>
        <LibraryScreen active={tab === 'library'} />
      </View>

      <MiniPlayer onOpen={() => setPlayerOpen(true)} />

      <View style={[styles.tabs, { paddingBottom: insets.bottom + 6 }]}>
        {TABS.map(({ key, label, icon }) => {
          const active = key === tab;
          const tint = active ? colors.accentSoft : colors.textFaint;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={styles.tab}>
              <Icon name={icon} size={22} color={tint} />
              <Text style={[styles.tabLabel, { color: tint }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <NowPlaying visible={playerOpen} onClose={() => setPlayerOpen(false)} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <AppStateProvider>
        <Shell />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 56,
  },
  logo: { width: 46, height: 46 },
  wordmark: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '300',
    marginLeft: 2,
    letterSpacing: 5,
  },
  screen: { flex: 1 },
  hidden: { display: 'none' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  tabLabel: { fontSize: 11, fontWeight: '500' },
});
