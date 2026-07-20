import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { HapticPressable } from './HapticPressable';
import { useSenseVoiceDictation } from '../hooks/useSenseVoiceDictation';
import { colors } from '../theme/colors';

interface EscalationDictationDockProps {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  /** When true, renders only the semicircle (no outer bar chrome). */
  embedded?: boolean;
  /** Semicircle width — should match the submit button width. */
  width?: number;
  /** Semicircle height — typically width / 2. */
  height?: number;
}

export function EscalationDictationDock({
  disabled,
  onTranscript,
  embedded = false,
  width,
  height,
}: EscalationDictationDockProps) {
  const { t } = useTranslation();
  const {
    status,
    isRecording,
    isBusy,
    modelReady,
    error,
    clearError,
    downloadSpeechModel,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useSenseVoiceDictation();

  const dockWidth = width ?? 168;
  const dockHeight = height ?? dockWidth / 2;
  const iconSize = Math.min(42, Math.round(dockWidth * 0.22));

  const promptDownload = () => {
    Alert.alert(t('escalation.dictationModelTitle'), t('escalation.dictationModelBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('escalation.dictationDownload'),
        onPress: () => void downloadSpeechModel(),
      },
    ]);
  };

  const showError = (code: string | null) => {
    if (!code) return;
    if (code === 'mic-denied') {
      Alert.alert(t('escalation.dictationModelTitle'), t('escalation.dictationMicDenied'));
      return;
    }
    if (code === 'no-speech') {
      Alert.alert(t('escalation.dictationModelTitle'), t('escalation.dictationNoSpeech'));
      return;
    }
    Alert.alert(t('escalation.dictationModelTitle'), t('escalation.dictationFailed'));
  };

  const handlePress = async () => {
    if (disabled || isBusy) return;
    clearError();

    if (!modelReady) {
      promptDownload();
      return;
    }

    if (isRecording) {
      const result = await stopRecording();
      if (result.text) onTranscript(result.text);
      else showError(result.error);
      return;
    }

    const started = await startRecording();
    if (!started) showError(error);
  };

  const statusLabel = isRecording
    ? t('escalation.dictationListening')
    : status === 'transcribing'
      ? t('escalation.dictationTranscribing')
      : status === 'downloading'
        ? t('escalation.dictationDownloading')
        : status === 'loading-model'
          ? t('escalation.dictationLoading')
          : null;

  return (
    <View style={embedded ? styles.embeddedWrap : styles.bar}>
      {statusLabel ? <Text style={styles.status}>{statusLabel}</Text> : null}
      <HapticPressable
        style={[
          styles.dock,
          {
            width: dockWidth,
            height: dockHeight,
            borderTopLeftRadius: dockWidth / 2,
            borderTopRightRadius: dockWidth / 2,
            paddingTop: dockHeight * 0.18,
          },
          isRecording && styles.dockRecording,
          (disabled || isBusy) && styles.dockDisabled,
        ]}
        onPress={() => void handlePress()}
        onLongPress={isRecording ? () => cancelRecording() : undefined}
        disabled={disabled || isBusy}
        accessibilityRole="button"
        accessibilityLabel={t('escalation.dictationA11y')}
        accessibilityState={{ busy: isBusy, selected: isRecording }}
      >
        {isBusy ? (
          <ActivityIndicator color={colors.actionForeground} size="large" />
        ) : (
          <Ionicons
            name={isRecording ? 'stop-circle' : 'mic'}
            size={iconSize}
            color={colors.actionForeground}
          />
        )}
      </HapticPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    paddingTop: 8,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    zIndex: 20,
    elevation: 20,
  },
  embeddedWrap: {
    alignItems: 'center',
    width: '100%',
  },
  status: {
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(17,17,17,0.88)',
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
  },
  dock: {
    borderWidth: 5,
    borderBottomWidth: 0,
    borderColor: colors.actionBorder,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  dockRecording: {
    backgroundColor: '#FFE082',
    borderColor: colors.error,
  },
  dockDisabled: {
    opacity: 0.55,
  },
});
