import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AuthRepository } from '../data/repositories';
import { SectionHeader } from '../components/CommonComponents';
import { colors } from '../theme/colors';

const gammonLogo = require('../../assets/logo-gammon-480x480-2021.webp');

interface AuthScreenProps {
  authRepository: AuthRepository;
  onAuthenticated: () => void;
}

export function AuthScreen({ authRepository, onAuthenticated }: AuthScreenProps) {
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
      <SectionHeader title={t('auth.title')} description={t('auth.tagline')} />
      <View style={styles.inner}>
        <Image
          source={gammonLogo}
          style={styles.logoImage}
          resizeMode="contain"
          accessibilityLabel={t('auth.logoA11y')}
        />
        <Text style={styles.hint}>{t('auth.hint')}</Text>

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

        <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isSignUp ? t('auth.createAccount') : t('auth.signIn')}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            setIsSignUp(!isSignUp);
            setError(null);
          }}
        >
          <Text style={styles.link}>
            {isSignUp ? t('auth.alreadyHaveAccount') : t('auth.needAccount')}
          </Text>
        </Pressable>
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
    padding: 24,
    paddingRight: 72,
  },
  logoImage: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: 16,
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  tagline: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: 8,
  },
  hint: {
    textAlign: 'center',
    color: colors.secondary,
    fontSize: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  error: {
    color: colors.error,
    marginBottom: 12,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    textAlign: 'center',
    color: colors.primary,
    marginTop: 8,
  },
});
