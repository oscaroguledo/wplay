import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import GenrePicker from '../components/GenrePicker';
import { useApp } from '../state/AppState';
import { colors } from '../theme';

export default function DownloadScreen() {
  const { download, startDownload } = useApp();
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('');
  const disabled = download.busy || !url.trim();

  const submit = async () => {
    if (await startDownload(url.trim(), category)) {
      setUrl('');
    }
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}>
      <Text style={styles.title}>Download</Text>
      <Text style={styles.hint}>
        Paste a link to audio or video you have the right to download. It is
        saved as an MP3 in Download/Music.
      </Text>

      <TextInput
        placeholder="https://…"
        placeholderTextColor={colors.textFaint}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!download.busy}
        style={styles.input}
      />

      <Text style={styles.label}>
        Genre — leave empty to have it worked out automatically
      </Text>
      <GenrePicker value={category} onChange={setCategory} />

      <Pressable
        onPress={submit}
        disabled={disabled}
        style={[styles.button, disabled && styles.buttonDisabled]}>
        <Text style={styles.buttonText}>
          {download.busy ? 'Working…' : 'Download'}
        </Text>
      </Pressable>

      {download.busy && (
        <View style={styles.track}>
          <View
            style={[styles.fill, { width: `${download.progress * 100}%` }]}
          />
        </View>
      )}
      {!!download.status && (
        <Text
          style={[styles.status, download.error && { color: colors.danger }]}>
          {download.status}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 8 },
  hint: { color: colors.textDim, fontSize: 13, marginTop: 6, lineHeight: 19 },
  input: {
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceHigh,
    color: colors.text,
    fontSize: 15,
  },
  label: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
  },
  button: {
    marginTop: 24,
    paddingVertical: 13,
    borderRadius: 24,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  buttonDisabled: { opacity: 0.35 },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  track: {
    height: 3,
    borderRadius: 2,
    marginTop: 18,
    overflow: 'hidden',
    backgroundColor: '#4d4d4d',
  },
  fill: { height: 3, backgroundColor: colors.accentSoft },
  status: { color: colors.textDim, fontSize: 13, marginTop: 12 },
});
