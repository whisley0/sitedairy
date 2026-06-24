import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AddObservationModal } from '../components/AddObservationModal';
import { AddConditionModal } from '../components/AddConditionModal';
import { InfoCard, SectionHeader, Chip } from '../components/CommonComponents';
import type { SiteDiaryRepository } from '../data/repositories';
import type { SiteConditionIssue, SiteObservation } from '../data/models';
import { colors } from '../theme/colors';

export function ObservationScreen({ diaryRepository }: { diaryRepository: SiteDiaryRepository }) {
  const [loading, setLoading] = useState(true);
  const [observations, setObservations] = useState<SiteObservation[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  const loadObservations = useCallback(async () => {
    setLoading(true);
    setObservations(await diaryRepository.getObservations());
    setLoading(false);
  }, [diaryRepository]);

  useEffect(() => {
    loadObservations();
  }, [loadObservations]);

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SectionHeader
          title="Site observations"
          description="Record on-site findings — billable items highlighted"
        />
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : observations.length === 0 ? (
          <Text style={styles.empty}>No observations yet. Tap + to add one.</Text>
        ) : (
          observations.map((observation) => (
            <InfoCard
              key={observation.id}
              title={observation.title}
              subtitle={`${observation.location} · ${observation.recordedAt}`}
            >
              <Text style={styles.body}>{observation.notes}</Text>
              {observation.photoUri ? (
                <Image source={{ uri: observation.photoUri }} style={styles.thumbnail} resizeMode="cover" />
              ) : null}
              {observation.billable ? <Chip label="Billable feature" /> : null}
            </InfoCard>
          ))
        )}
      </ScrollView>

      <Pressable
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        accessibilityLabel="Add observation"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      <AddObservationModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={async (input) => {
          await diaryRepository.submitObservation(input);
          await loadObservations();
        }}
      />
    </View>
  );
}

export function ConditionScreen({ diaryRepository }: { diaryRepository: SiteDiaryRepository }) {
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<SiteConditionIssue[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    setIssues(await diaryRepository.getConditionIssues());
    setLoading(false);
  }, [diaryRepository]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SectionHeader
          title="Site condition"
          description="Safety and quality issues reported on site"
        />
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : issues.length === 0 ? (
          <Text style={styles.empty}>No conditions yet. Tap + to add one.</Text>
        ) : (
          issues.map((issue) => (
            <InfoCard
              key={issue.id}
              title={`${issue.category} — ${issue.severity}`}
              subtitle={`Reported ${issue.reportedAt} · ${issue.resolved ? 'Resolved' : 'Open'}`}
            >
              <Text
                style={[
                  styles.body,
                  issue.severity === 'HIGH' || issue.severity === 'CRITICAL'
                    ? styles.emphasis
                    : undefined,
                ]}
              >
                {issue.description}
              </Text>
            </InfoCard>
          ))
        )}
      </ScrollView>

      <Pressable
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        accessibilityLabel="Add site condition"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      <AddConditionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={async (input) => {
          await diaryRepository.submitConditionIssue(input);
          await loadIssues();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 96 },
  body: { marginTop: 8, color: colors.text, lineHeight: 22 },
  emphasis: { fontWeight: '600' },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
  thumbnail: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginTop: 12,
    backgroundColor: colors.border,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
