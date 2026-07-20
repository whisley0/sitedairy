import { useUiMode } from '../ui/UiModeProvider';
import { typographyComplete, typographySimplified, type AppTypography } from './typography';

export function useAppTypography(): AppTypography {
  const { isSimplified } = useUiMode();
  return isSimplified ? typographySimplified : typographyComplete;
}
