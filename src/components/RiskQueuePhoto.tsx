import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

interface RiskQueuePhotoProps {
  uri?: string;
  missing?: boolean;
  style?: StyleProp<ImageStyle>;
  missingStyle?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export function RiskQueuePhoto({ uri, missing, style, missingStyle, compact }: RiskQueuePhotoProps) {
  if (missing || !uri) {
    return (
      <View style={[styles.missing, compact && styles.missingCompact, missingStyle]}>
        <Ionicons name="image-outline" size={compact ? 22 : 32} color={colors.textMuted} />
        {!compact ? <Text style={styles.missingText}>Photo unavailable</Text> : null}
      </View>
    );
  }

  return <Image source={{ uri }} style={style} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  missing: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.border,
  },
  missingCompact: { gap: 0 },
  missingText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
});
