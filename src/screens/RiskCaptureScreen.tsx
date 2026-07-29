import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { HapticPressable } from '../components/HapticPressable';
import { PhotoTagsEditor } from '../components/PhotoTagsEditor';
import { VlmModelPicker, vlmModelTitleKey } from '../components/VlmModelPicker';
import type { PhotoBle, PhotoGps, RiskAssessmentMode } from '../data/models';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useVlmModelState } from '../hooks/useVlmModelState';
import type { VlmModelId } from '../native/llm/modelManager';
import { riskAssessmentQueue } from '../services/riskAssessmentQueue';
import { formatPhotoTag } from '../utils/photoTags';
import { resolvePhotoBle } from '../utils/photoBle';
import { resolvePhotoGps } from '../utils/photoGps';

type Status = 'idle' | 'queuing';

interface StagedPhoto {
  key: string;
  uri: string;
  gps?: PhotoGps;
  ble?: PhotoBle;
  classifying?: boolean;
  inspectionType?: string;
  domain?: string;
  subject?: string;
  tags?: string[];
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
  // Manual: photos alone are enough (classifier tags / comment are optional).
  // AI: need a ready VLM selected.
  const canSubmit =
    staged.length > 0 && !actionsLocked && (mode === 'manual' || selectedReady);

  const onDownloadModel = async (id: VlmModelId) => {
    setError(null);
    try {
      await handleDownload(id);
    } catch (e) {
      setError(t('riskCapture.downloadError', { error: String(e) }));
    }
  };

  const selectedModelLabel = t(vlmModelTitleKey(selectedId));

  const addStaged = (photos: Array<{ uri: string; gps?: PhotoGps; ble?: PhotoBle }>) => {
    const stamped = photos.map((photo) => ({
      key: `${photo.uri}-${Date.now()}-${Math.random()}`,
      uri: photo.uri,
      gps: photo.gps,
      ble: photo.ble,
      classifying: true,
      tags: [] as string[],
    }));

    setStaged((prev) => {
      const existing = new Set(prev.map((p) => p.uri));
      return [...prev, ...stamped.filter((photo) => !existing.has(photo.uri))];
    });

    for (const photo of stamped) {
      void riskAssessmentQueue
        .classifyPhoto(photo.uri)
        .then((meta) => {
          setStaged((prev) =>
            prev.map((entry) =>
              entry.key === photo.key
                ? {
                    ...entry,
                    classifying: false,
                    inspectionType: meta.inspectionType,
                    domain: meta.domain,
                    subject: meta.subject,
                    tags: meta.tags,
                  }
                : entry,
            ),
          );
        })
        .catch(() => {
          setStaged((prev) =>
            prev.map((entry) => (entry.key === photo.key ? { ...entry, classifying: false } : entry)),
          );
        });
    }
  };

  const removeStaged = (key: string) => {
    setStaged((prev) => prev.filter((photo) => photo.key !== key));
  };

  const updateStagedTags = (key: string, tags: string[]) => {
    setStaged((prev) =>
      prev.map((photo) => {
        if (photo.key !== key) return photo;
        const [inspectionType, domain, subject] = tags;
        return {
          ...photo,
          tags,
          inspectionType: inspectionType ?? photo.inspectionType,
          domain: domain ?? photo.domain,
          subject: subject ?? photo.subject,
        };
      }),
    );
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
    const [gps, ble] = await Promise.all([resolvePhotoGps(asset), resolvePhotoBle()]);
    addStaged([{ uri: asset.uri, gps, ble }]);
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
    const ble = await resolvePhotoBle();
    const photos = await Promise.all(
      result.assets.map(async (asset) => ({
        uri: asset.uri,
        gps: await resolvePhotoGps(asset),
        ble,
      })),
    );
    addStaged(photos);
  };

  const submitBatch = async () => {
    if (!canSubmit) {
      if (captureBlocked) {
        Alert.alert(t('riskCapture.vlmInProgressTitle'), t('riskCapture.waitVlm'));
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
            ble: photo.ble,
            inspectionType: photo.inspectionType,
            domain: photo.domain,
            subject: photo.subject,
            tags: photo.tags,
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
            ble: photo.ble,
            inspectionType: photo.inspectionType,
            domain: photo.domain,
            subject: photo.subject,
            tags: photo.tags,
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
      <SectionHeader title={t('riskCapture.title')} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {captureBlocked ? (
          <View style={styles.banner}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.bannerText}>{t('riskCapture.vlmBanner')}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>{t('riskCapture.entryMode')}</Text>
        <View style={styles.modeRow}>
          {(['manual', 'vlm'] as const).map((value) => {
            const active = mode === value;
            return (
              <HapticPressable
                key={value}
                style={[styles.modeChip, active && styles.modeChipActive]}
                onPress={() => setMode(value)}
                disabled={busy}
              >
                <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
                  {value === 'vlm' ? t('riskCapture.modeVlm') : t('riskCapture.modeManual')}
                </Text>
              </HapticPressable>
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
          </>
        ) : null}

        <View style={styles.actionRow}>
          <HapticPressable
            style={[styles.actionBtn, actionsLocked && styles.btnDisabled]}
            disabled={actionsLocked}
            onPress={capture}
          >
            <Ionicons name="camera" size={24} color="#fff" />
            <Text style={styles.actionBtnText}>{t('riskCapture.capturePhoto')}</Text>
          </HapticPressable>
          <HapticPressable
            style={[styles.actionBtnSecondary, actionsLocked && styles.btnDisabled]}
            disabled={actionsLocked}
            onPress={pickFromLibrary}
          >
            <Ionicons name="images" size={24} color={colors.primary} />
            <Text style={styles.actionBtnSecondaryText}>{t('riskCapture.pickPhotos')}</Text>
          </HapticPressable>
        </View>

        {staged.length > 0 ? (
          <View style={styles.stagedSection}>
            <Text style={styles.sectionLabel}>
              {t('riskCapture.stagedCount', { count: staged.length })}
            </Text>
            {staged.map((photo) => (
              <View key={photo.key} style={styles.stagedCard}>
                <View style={styles.stagedTop}>
                  <Image source={{ uri: photo.uri }} style={styles.stagedImage} resizeMode="cover" />
                  <View style={styles.stagedMeta}>
                    {photo.gps ? (
                      <View style={styles.gpsRow}>
                        <Ionicons name="location" size={14} color={colors.primary} />
                        <Text style={styles.gpsText}>{t('riskCapture.gpsAttached')}</Text>
                      </View>
                    ) : null}
                    {photo.ble ? (
                      <View style={styles.gpsRow}>
                        <Ionicons name="bluetooth" size={14} color={colors.primary} />
                        <Text style={styles.gpsText}>
                          {t('photoBle.zone', { zone: photo.ble.zoneId })}
                        </Text>
                      </View>
                    ) : null}
                    {photo.classifying ? (
                      <View style={styles.classifyingRow}>
                        <ActivityIndicator color={colors.primary} size="small" />
                        <Text style={styles.classifyingText}>{t('riskCapture.classifying')}</Text>
                      </View>
                    ) : photo.tags?.length ? (
                      <Text style={styles.tagPreview} numberOfLines={2}>
                        {formatPhotoTag(photo.tags)}
                      </Text>
                    ) : (
                      <Text style={styles.classifyingText}>{t('riskDetail.tagEmpty')}</Text>
                    )}
                  </View>
                  <HapticPressable
                    style={styles.removeBtn}
                    onPress={() => removeStaged(photo.key)}
                    disabled={busy}
                    accessibilityLabel={t('riskCapture.removePhotoA11y')}
                  >
                    <Ionicons name="close-circle" size={26} color={colors.error} />
                  </HapticPressable>
                </View>
                <PhotoTagsEditor
                  tags={photo.tags ?? []}
                  onChange={(tags) => updateStagedTags(photo.key, tags)}
                  editable={!busy && !photo.classifying}
                  compact
                />
              </View>
            ))}
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
          <HapticPressable
            style={[styles.submitBtn, !canSubmit && styles.btnDisabled]}
            disabled={!canSubmit}
            onPress={submitBatch}
          >
            <Ionicons name="cloud-upload-outline" size={24} color="#fff" />
            <Text style={styles.submitBtnText}>
              {mode === 'manual'
                ? t('riskCapture.saveManual', { count: staged.length })
                : t('riskCapture.addToGallery', { count: staged.length })}
            </Text>
          </HapticPressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: 18, paddingBottom: 52 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerText: { flex: 1, color: colors.text, fontSize: typography.body, fontWeight: '600', lineHeight: typography.lineHeight.body },
  pickerHero: { marginBottom: 18 },
  sectionLabel: { fontSize: typography.body, fontWeight: '700', color: colors.textMuted, marginBottom: 10, marginTop: 6 },
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
  modeChipText: { color: colors.textMuted, fontWeight: '700', fontSize: typography.body },
  modeChipTextActive: { color: '#fff' },
  commentInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: typography.body,
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
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: typography.body },
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
  actionBtnSecondaryText: { color: colors.primary, fontWeight: '700', fontSize: typography.body },
  stagedSection: { marginTop: 16 },
  stagedCard: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stagedTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stagedImage: { width: 88, height: 88, borderRadius: 10, backgroundColor: colors.border },
  stagedMeta: { flex: 1, gap: 6, paddingTop: 2 },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gpsText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  classifyingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  classifyingText: { color: colors.textMuted, fontSize: 13 },
  tagPreview: { color: colors.text, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  removeBtn: {
    padding: 2,
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
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: typography.md },
  btnDisabled: { opacity: 0.45 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  statusText: { color: colors.text, fontSize: typography.body, fontWeight: '600' },
  error: { color: colors.error, fontSize: typography.body, marginTop: 14 },
});
