import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  /** Filled oxblood when on. */
  active?: boolean;
  disabled?: boolean;
};

/** Small rounded text button, used for toggles and secondary actions. */
export default function Pill({ label, onPress, active, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      style={[
        styles.pill,
        active && styles.active,
        disabled && styles.disabled,
      ]}>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  active: { backgroundColor: colors.accent, borderColor: colors.accent },
  disabled: { opacity: 0.4 },
  label: { color: colors.text, fontSize: 13, fontWeight: '500' },
  labelActive: { fontWeight: '700' },
});
