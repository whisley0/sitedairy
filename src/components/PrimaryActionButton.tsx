import { ActivityIndicator, StyleSheet, Text, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { HapticPressable } from './HapticPressable';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface PrimaryActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IoniconName;
  style?: ViewStyle;
}

export function PrimaryActionButton({
  label,
  onPress,
  disabled,
  loading,
  icon = 'checkmark-circle-outline',
  style,
}: PrimaryActionButtonProps) {
  const inactive = disabled || loading;

  return (
    <HapticPressable
      style={[styles.button, inactive && styles.buttonDisabled, style]}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={colors.actionForeground} />
      ) : (
        <>
          <Ionicons name={icon} size={24} color={colors.actionForeground} />
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </HapticPressable>
  );
}

export const primaryActionButtonStyles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.action,
    borderWidth: 3,
    borderColor: colors.actionBorder,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 24,
    minHeight: 64,
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  label: {
    color: colors.actionForeground,
    fontSize: typography.headline,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

const styles = primaryActionButtonStyles;
