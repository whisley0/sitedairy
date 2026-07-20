import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

export type UiMode = 'simplified' | 'complete';

const UI_MODE_FILE = `${FileSystem.documentDirectory}app-ui-mode.json`;

interface UiModeContextValue {
  mode: UiMode;
  isSimplified: boolean;
  isComplete: boolean;
  setMode: (mode: UiMode) => Promise<void>;
  ready: boolean;
}

const UiModeContext = createContext<UiModeContextValue | null>(null);

function isUiMode(value: string): value is UiMode {
  return value === 'simplified' || value === 'complete';
}

export function UiModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<UiMode>('simplified');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(UI_MODE_FILE);
        if (info.exists) {
          const raw = await FileSystem.readAsStringAsync(UI_MODE_FILE);
          const parsed = JSON.parse(raw) as { mode?: string };
          if (parsed.mode && isUiMode(parsed.mode)) {
            setModeState(parsed.mode);
          }
        }
      } catch {
        // Keep default simplified.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setMode = useCallback(async (next: UiMode) => {
    setModeState(next);
    try {
      await FileSystem.writeAsStringAsync(UI_MODE_FILE, JSON.stringify({ mode: next }));
    } catch {
      // Mode still applies for this session.
    }
  }, []);

  const value = useMemo(
    () => ({
      mode,
      isSimplified: mode === 'simplified',
      isComplete: mode === 'complete',
      setMode,
      ready,
    }),
    [mode, setMode, ready],
  );

  if (!ready) return null;

  return <UiModeContext.Provider value={value}>{children}</UiModeContext.Provider>;
}

export function useUiMode() {
  const context = useContext(UiModeContext);
  if (!context) {
    throw new Error('useUiMode must be used within UiModeProvider');
  }
  return context;
}
