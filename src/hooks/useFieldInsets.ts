import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FIELD_CASE_INSET, SCREEN_PADDING } from '../theme/layout';

export function useFieldInsets() {
  const insets = useSafeAreaInsets();

  return useMemo(
    () => ({
      top: insets.top,
      bottom: insets.bottom + FIELD_CASE_INSET,
      left: insets.left + FIELD_CASE_INSET,
      right: insets.right + FIELD_CASE_INSET,
      contentPaddingHorizontal: SCREEN_PADDING,
      modalContentPaddingHorizontal: SCREEN_PADDING,
    }),
    [insets.bottom, insets.left, insets.right, insets.top],
  );
}
