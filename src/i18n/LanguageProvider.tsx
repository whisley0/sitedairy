import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import i18n, { type AppLanguage, SUPPORTED_LANGUAGES } from './index';

const LANGUAGE_FILE = `${FileSystem.documentDirectory}app-language.json`;

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  ready: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isAppLanguage(value: string): value is AppLanguage {
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(LANGUAGE_FILE);
        if (info.exists) {
          const raw = await FileSystem.readAsStringAsync(LANGUAGE_FILE);
          const parsed = JSON.parse(raw) as { language?: string };
          if (parsed.language && isAppLanguage(parsed.language)) {
            await i18n.changeLanguage(parsed.language);
            setLanguageState(parsed.language);
          }
        }
      } catch {
        // Keep default English.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setLanguage = useCallback(async (next: AppLanguage) => {
    await i18n.changeLanguage(next);
    setLanguageState(next);
    try {
      await FileSystem.writeAsStringAsync(LANGUAGE_FILE, JSON.stringify({ language: next }));
    } catch {
      // Language still applies for this session.
    }
  }, []);

  const value = useMemo(
    () => ({ language, setLanguage, ready }),
    [language, setLanguage, ready],
  );

  if (!ready) return null;

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
