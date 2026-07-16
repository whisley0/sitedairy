import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SectionHeader } from '../components/CommonComponents';
import { VlmModelPicker, vlmModelTitleKey } from '../components/VlmModelPicker';
import type { RiskAssessmentMode } from '../data/models';
import type { PhotoGps } from '../data/models';
import { colors } from '../theme/colors';
import { useVlmModelState } from '../hooks/useVlmModelState';
import type { VlmModelId } from '../native/llm/modelManager';
import { riskAssessmentQueue } from '../services/riskAssessmentQueue';
import { resolvePhotoGps } from '../utils/photoGps';

type Status = 'idle' | 'queuing';

interface StagedPhoto {
  key: string;
  uri: string;
  gps?: PhotoGps;
}

interface RiskCaptureScreenProps {
  onQueued?: () => void;
}

export function RiskCaptureScreen({ onQueued }: RiskCaptureScreenProps) {
  const { t } = useTranslation();
  const {
    rows,
    selectedId,
    visibleModels,
    recommendedId,
    selectModel,
    handleDownload,
    syncReadyFromDisk,
    anyDownloading,
    selectedReady,
    anyReady,
  } = useVlmModelState();
  const [mode, setMode] = useState<RiskAssessmentMode>('manual');
  const [staged, setStaged] = useState<StagedPhoto[]>([]);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [captureBlocked, setCaptureBlocked] = useState(riskAssessmentQueue.isCaptureBlocked());

  useFocusEffect(
    useCallback(() => {
      riskAssessmentQueue.pauseForCapture();
      syncReadyFromDisk();
      return () => riskAssessmentQueue.resumeAfterCapture();
    }, [syncReadyFromDisk]),
  );

  useEffect(() => {
    const refresh = () => setCaptureBlocked(riskAssessmentQueue.isCaptureBlocked());
    refresh();
    return riskAssessmentQueue.subscribe(refresh);
  }, []);

  const busy = status !== 'idle' || anyDownloading;
  const actionsLocked = busy || captureBlocked;
  const canSubmit =
    staged.length > 0 &&
    !actionsLocked &&
    (mode === 'manual' ? comment.trim().length > 0 : selectedReady);

  const onDownloadModel = async (id: VlmModelId) => {
    setError(null);
    try {
      await handleDownload(id);
    } catch (e) {
      setError(t('riskCapture.downloadError', { error: String(e) }));
    }
  };

  const selectedModelLabel = t(vlmModelTitleKey(selectedId));

  const addStaged = (photos: Array<{ uri: string; gps?: PhotoGps }>) => {
    setStaged((prev) => {
      const existing = new Set(prev.map((p) => p.uri));
      const next = photos
        .filter((photo) => !existing.has(photo.uri))
        .map((photo) => ({
          key: `${photo.uri}-${Date.now()}-${Math.random()}`,
          uri: photo.uri,
          gps: photo.gps,
        }));
      return [...prev, ...next];
    });
  };

  const removeStaged = (key: string) => {
    setStaged((prev) => prev.filter((photo) => photo.key !== key));
  };

  const ensureCanAddPhotos = (): boolean => {
    if (captureBlocked) {
      Alert.alert(t('riskCapture.vlmInProgressTitle'), t('riskCapture.vlmInProgressBody'));
      return false;
    }
    return true;
  };

  const capture = async () => {
    if (!ensureCanAddPhotos()) return;

    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('riskCapture.cameraPermissionTitle'), t('riskCapture.cameraPermissionBody'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6, exif: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const gps = await resolvePhotoGps(asset);
    addStaged([{ uri: asset.uri, gps }]);
  };

  const pickFromLibrary = async () => {
    if (!ensureCanAddPhotos()) return;

    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('riskCapture.libraryPermissionTitle'), t('riskCapture.libraryPermissionBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsMultipleSelection: true,
      exif: true,
    });
    if (result.canceled || !result.assets.length) return;
    const photos = await Promise.all(
      result.assets.map(async (asset) => ({
        uri: asset.uri,
        gps: await resolvePhotoGps(asset),
      })),
    );
    addStaged(photos);
  };

  const submitBatch = async () => {
    if (!canSubmit) {
      if (captureBlocked) {
        Alert.alert(t('riskCapture.vlmInProgressTitle'), t('riskCapture.waitVlm'));
      } else if (mode === 'manual' && !comment.trim()) {
        Alert.alert(t('riskCapture.commentRequiredTitle'), t('riskCapture.commentRequiredBody'));
      } else if (mode === 'vlm' && !selectedReady) {
        Alert.alert(t('riskCapture.modelRequiredTitle'), t('riskCapture.downloadFirst'));
      }
      return;
    }

    setError(null);
    setStatus('queuing');
    const photosToQueue = [...staged];
    const commentToSave = comment.trim();
    const manualModelName = t('riskCapture.manualModelName');

    try {
      if (mode === 'manual') {
        for (const photo of photosToQueue) {
          await riskAssessmentQueue.enqueue({
            photoUri: photo.uri,
            modelId: 'manual',
            modelName: manualModelName,
            mode: 'manual',
            userComment: commentToSave,
            gps: photo.gps,
          });
        }
      } else {
        for (const photo of photosToQueue) {
          await riskAssessmentQueue.enqueue({
            photoUri: photo.uri,
            modelId: selectedId,
            modelName: selectedModelLabel,
            mode: 'vlm',
            gps: photo.gps,
          });
        }
      }

      setStaged([]);
      setComment('');

      const count = photosToQueue.length;
      setTimeout(() => {
        Alert.alert(
          mode === 'manual' ? t('riskCapture.savedManualTitle') : t('riskCapture.pushedTitle'),
          mode === 'manual'
            ? t('riskCapture.savedManualBody', { count })
            : t('riskCapture.pushedBatchBody', { count, model: selectedModelLabel }),
          [
            { text: t('riskCapture.viewQueue'), onPress: onQueued },
            { text: t('common.ok'), style: 'cancel' },
          ],
        );
      }, 100);
    } catch (e) {
      setError(t('riskCapture.queueError', { error: String(e) }));
    } finally {
      setStatus('idle');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SectionHeader title={t('riskCapture.title')} description={t('riskCapture.description')} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {captureBlocked ? (
          <View style={styles.banner}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.bannerText}>{t('riskCapture.vlmBanner')}</Text>
          </View>
        ) : (
          <Text style={styles.hintBanner}>{t('riskCapture.queueHint')}</Text>
        )}

        <Text style={styles.sectionLabel}>{t('riskCapture.entryMode')}</Text>
        <View style={styles.modeRow}>
          {(['manual', 'vlm'] as const).map((value) => {
            const active = mode === value;
            return (
              <Pressable
                key={value}
                style={[styles.modeChip, active && styles.modeChipActive]}
                onPress={() => setMode(value)}
                disabled={busy}
              >
                <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
                  {value === 'vlm' ? t('riskCapture.modeVlm') : t('riskCapture.modeManual')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'vlm' ? (
          <View style={styles.pickerHero}>
            <VlmModelPicker
              models={visibleModels}
              state={rows}
              selectedId={selectedId}
              disabled={busy}
              showHeader
              recommendedId={recommendedId}
              onSelect={selectModel}
              onDownload={onDownloadModel}
            />
            {!anyReady ? <Text style={styles.hint}>{t('riskCapture.downloadFirst')}</Text> : null}
          </View>
        ) : null}

        {mode === 'manual' ? (
          <>
            <Text style={styles.sectionLabel}>{t('riskCapture.commentLabel')}</Text>
            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder={t('riskCapture.commentPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              editable={!busy}
            />
            <Text style={styles.hint}>{t('riskCapture.manualHint')}</Text>
          </>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, actionsLocked && styles.btnDisabled]}
            disabled={actionsLocked}
            onPress={capture}
          >
            <Ionicons name="camera" size={22} color="#fff" />
            <Text style={styles.actionBtnText}>{t('riskCapture.capturePhoto')}</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtnSecondary, actionsLocked && styles.btnDisabled]}
            disabled={actionsLocked}
            onPress={pickFromLibrary}
          >
            <Ionicons name="images" size={22} color={colors.primary} />
            <Text style={styles.actionBtnSecondaryText}>{t('riskCapture.pickPhotos')}</Text>
          </Pressable>
        </View>

        {staged.length > 0 ? (
          <View style={styles.stagedSection}>
            <Text style={styles.sectionLabel}>
              {t('riskCapture.stagedCount', { count: staged.length })}
            </Text>
            <View style={styles.stagedGrid}>
              {staged.map((photo) => (
                <View key={photo.key} style={styles.stagedTile}>
                  <Image source={{ uri: photo.uri }} style={styles.stagedImage} resizeMode="cover" />
                  {photo.gps ? (
                    <View style={styles.gpsBadge}>
                      <Ionicons name="location" size={12} color="#fff" />
                    </View>
                  ) : null}
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => removeStaged(photo.key)}
                    disabled={busy}
                    accessibilityLabel={t('riskCapture.removePhotoA11y')}
                  >
                    <Ionicons name="close-circle" size={24} color={colors.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {status === 'queuing' ? (
          <View style={styles.statusRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.statusText}>{t('riskCapture.saving')}</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {staged.length > 0 ? (
          <Pressable
            style={[styles.submitBtn, !canSubmit && styles.btnDisabled]}
            disabled={!canSubmit}
            onPress={submitBatch}
          >
            <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
            <Text style={styles.submitBtnText}>
              {mode === 'manual'
                ? t('riskCapture.saveManual', { count: staged.length })
                : t('riskCapture.addToGallery', { count: staged.length })}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: 16, paddingBottom: 48 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  hintBanner: {
    marginBottom: 12,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  pickerHero: { marginBottom: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 8, marginTop: 4 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  modeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeChipText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  modeChipTextActive: { color: '#fff' },
  commentInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionBtnSecondaryText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  stagedSection: { marginTop: 16 },
  stagedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stagedTile: { width: '31%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.border },
  stagedImage: { width: '100%', height: '100%' },
  gpsBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    backgroundColor: 'rgba(21, 101, 192, 0.9)',
    borderRadius: 10,
    padding: 3,
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
  },
  submitBtn: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnDisabled: { opacity: 0.45 },
  hint: { marginTop: 8, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  statusText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  error: { color: colors.error, fontSize: 13, marginTop: 12 },
});
