import { useMemo, useState, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { AuthScreen } from './src/screens/AuthScreen';
import { MainTabs } from './src/navigation/MainTabs';
import { DummyAuthRepository, DummySiteDiaryRepository } from './src/data/repositories';
import { LanguageProvider } from './src/i18n/LanguageProvider';
import './src/i18n';
import './src/config/firebase';

const AUTH_FLAG_FILE = `${FileSystem.documentDirectory}auth-session.json`;

export default function App() {
  const authRepository = useMemo(() => new DummyAuthRepository(), []);
  const diaryRepository = useMemo(() => new DummySiteDiaryRepository(), []);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(AUTH_FLAG_FILE);
        if (info.exists) {
          const raw = await FileSystem.readAsStringAsync(AUTH_FLAG_FILE);
          const parsed = JSON.parse(raw) as { active?: boolean };
          if (parsed.active) {
            await authRepository.signIn('', '');
            setIsAuthenticated(true);
          }
        }
      } catch {
        // Ignore corrupt session file.
      } finally {
        setAuthReady(true);
      }
    })();
  }, [authRepository]);

  const handleAuthenticated = async () => {
    setIsAuthenticated(true);
    try {
      await FileSystem.writeAsStringAsync(AUTH_FLAG_FILE, JSON.stringify({ active: true }));
    } catch {
      // Session still works for this run even if persistence fails.
    }
  };

  if (!authReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {isAuthenticated ? (
            <MainTabs
              authRepository={authRepository}
              diaryRepository={diaryRepository}
            />
          ) : (
            <AuthScreen
              authRepository={authRepository}
              onAuthenticated={handleAuthenticated}
            />
          )}
        </SafeAreaView>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
