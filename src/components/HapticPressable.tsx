import { Pressable, type PressableProps } from 'react-native';
import { useUiMode } from '../ui/UiModeProvider';
import { hapticLight } from '../utils/haptics';

export function HapticPressable({ onPressIn, disabled, ...rest }: PressableProps) {
  const { isSimplified } = useUiMode();

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        if (!disabled && isSimplified) hapticLight();
        onPressIn?.(event);
      }}
    />
  );
}
