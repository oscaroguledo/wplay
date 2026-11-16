import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { GENRES, normalizeGenre } from '../genres';
import { colors } from '../theme';
import Pill from './Pill';

type Props = {
  /** Selected genre; empty string means none. */
  value: string;
  onChange: (genre: string) => void;
  /** Extra genres to offer, e.g. ones already used in the library. */
  extra?: string[];
};

const SHOWN = 12;

/** Single-select genre chooser: a filter box over the genre list. Tapping the selection clears it. */
export default function GenrePicker({ value, onChange, extra }: Props) {
  const [filter, setFilter] = useState('');

  const options = useMemo(() => {
    const all = [...new Set([...(extra ?? []), ...GENRES])];
    const q = filter.trim().toLowerCase();
    const matches = q ? all.filter(g => g.toLowerCase().includes(q)) : all;
    // Keep the current selection visible at the front.
    const rest = matches.filter(g => g !== value);
    return (value ? [value, ...rest] : rest).slice(0, SHOWN);
  }, [filter, value, extra]);

  const typed = normalizeGenre(filter);
  const offerCustom =
    typed && !options.some(g => g.toLowerCase() === typed.toLowerCase());

  return (
    <View>
      <TextInput
        placeholder="Filter genres, or type a new one"
        placeholderTextColor={colors.textFaint}
        value={filter}
        onChangeText={setFilter}
        autoCorrect={false}
        style={styles.input}
      />
      <View style={styles.wrap}>
        {options.map(genre => (
          <Pill
            key={genre}
            label={genre}
            active={genre === value}
            onPress={() => onChange(genre === value ? '' : genre)}
          />
        ))}
        {offerCustom && (
          <Pill
            label={`Use “${typed}”`}
            onPress={() => {
              onChange(typed);
              setFilter('');
            }}
          />
        )}
      </View>
      {!filter.trim() && (
        <Text style={styles.hint}>
          Showing {options.length} of {GENRES.length} genres. Type to find the
          rest.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.surfaceHigh,
    color: colors.text,
    fontSize: 14,
    marginBottom: 10,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: 8 },
});
