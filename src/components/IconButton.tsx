import { Pressable, StyleSheet } from 'react-native';

import { colors } from '../theme';
import Icon, { type IconName } from './Icon';

type Props = {
  icon: IconName;
  /** Spoken by screen readers, since the button has no visible text. */
  label: string;
  onPress: () => void;
  /** Tinted oxblood when on. */
  active?: boolean;
  disabled?: boolean;
  size?: number;
  /** Solid oxblood circle, for the main action in a group. */
  filled?: boolean;
};

/** Round, icon-only button. */
export default function IconButton({
  icon,
  label,
  onPress,
  active,
  disabled,
  size = 24,
  filled,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      android_ripple={{ color: colors.border, borderless: true }}
      style={[
        styles.button,
        { width: size + 20, height: size + 20, borderRadius: size },
        active && styles.active,
        filled && styles.filled,
        disabled && styles.disabled,
      ]}>
      <Icon
        name={icon}
        size={size}
        color={filled ? colors.text : active ? colors.accentSoft : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: 'rgba(208, 80, 95, 0.16)' },
  filled: { backgroundColor: colors.accent },
  disabled: { opacity: 0.35 },
});
