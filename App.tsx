import { useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthScreen } from './src/screens/AuthScreen';
import { MainTabs } from './src/navigation/MainTabs';
import { DummyAuthRepository, DummySiteDiaryRepository } from './src/data/repositories';
import './src/config/firebase';

export default function App() {
  const authRepository = useMemo(() => new DummyAuthRepository(), []);
  const diaryRepository = useMemo(() => new DummySiteDiaryRepository(), []);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {isAuthenticated ? (
        <MainTabs
          authRepository={authRepository}
          diaryRepository={diaryRepository}
          onSignOut={() => setIsAuthenticated(false)}
        />
      ) : (
        <AuthScreen
          authRepository={authRepository}
          onAuthenticated={() => setIsAuthenticated(true)}
        />
      )}
    </SafeAreaProvider>
  );
}
