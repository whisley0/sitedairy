import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AuthRepository } from '../data/repositories';
import { HapticPressable } from '../components/HapticPressable';
import { SectionHeader } from '../components/CommonComponents';
import { AuthScreen as CompleteAuthScreen } from './complete/AuthScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useUiMode } from '../ui/UiModeProvider';

const gammonLogo = require('../../assets/logo-gammon-480x480-2021.webp');

interface AuthScreenProps {
  authRepository: AuthRepository;
  onAuthenticated: () => void;
}

export function AuthScreen(props: AuthScreenProps) {
  const { isSimplified } = useUiMode();
  if (!isSimplified) return <CompleteAuthScreen {...props} />;
  return <AuthScreenSimplified {...props} />;
}

function AuthScreenSimplified({ authRepository, onAuthenticated }: AuthScreenProps) {
  const { t } = useTranslation();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        await authRepository.signUp(email, password, displayName);
      } else {
        await authRepository.signIn(email, password);
      }
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.authFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SectionHeader title={t('auth.title')} />
      <View style={styles.inner}>
        <Image
          source={gammonLogo}
          style={styles.logoImage}
          resizeMode="contain"
          accessibilityLabel={t('auth.logoA11y')}
        />

        {isSignUp ? (
          <TextInput
            style={styles.input}
            placeholder={t('auth.displayName')}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />
        ) : null}

        <TextInput
          style={styles.input}
          placeholder={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <HapticPressable style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isSignUp ? t('auth.createAccount') : t('auth.signIn')}
            </Text>
          )}
        </HapticPressable>

        <HapticPressable
          onPress={() => {
            setIsSignUp(!isSignUp);
            setError(null);
          }}
        >
          <Text style={styles.link}>
            {isSignUp ? t('auth.alreadyHaveAccount') : t('auth.needAccount')}
          </Text>
        </HapticPressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
    paddingRight: 72,
  },
  logoImage: {
    width: 132,
    height: 132,
    alignSelf: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
    fontSize: typography.body,
  },
  error: {
    color: colors.error,
    marginBottom: 14,
    fontSize: typography.body,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  buttonText: {
    color: '#fff',
    fontSize: typography.body,
    fontWeight: '600',
  },
  link: {
    textAlign: 'center',
    color: colors.primary,
    marginTop: 10,
    fontSize: typography.body,
    fontWeight: '500',
  },
});
