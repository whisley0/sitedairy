import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { InfoCard, SectionHeader, Chip } from '../components/CommonComponents';
import type { AuthRepository, SiteDiaryRepository } from '../data/repositories';
import type { SiteTask } from '../data/models';
import { colors } from '../theme/colors';

interface DashboardScreenProps {
  authRepository: AuthRepository;
  diaryRepository: SiteDiaryRepository;
  onSignOut: () => void;
}

export function DashboardScreen({
  authRepository,
  diaryRepository,
  onSignOut,
}: DashboardScreenProps) {
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<SiteTask[]>([]);
  const [openIssues, setOpenIssues] = useState(0);
  const [openEscalations, setOpenEscalations] = useState(0);
  const user = authRepository.currentUser();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [deadlines, issues, escalations] = await Promise.all([
        diaryRepository.getDeadlineReminders(),
        diaryRepository.getConditionIssues(),
        diaryRepository.getEscalations(),
      ]);
      setReminders(deadlines);
      setOpenIssues(issues.filter((i) => !i.resolved).length);
      setOpenEscalations(escalations.filter((e) => e.status !== 'RESOLVED').length);
      setLoading(false);
    })();
  }, [diaryRepository]);

  const handleSignOut = async () => {
    await authRepository.signOut();
    onSignOut();
  };

  const handlePrintDiary = () => {
    const email = user?.email ?? 'your email';
    Alert.alert(
      'Site diary sent',
      `Today's consolidated site diary has been sent to ${email}.`,
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionHeader
        title={`Welcome, ${user?.displayName ?? 'Supervisor'}`}
        description="Site diary overview — dummy data preview"
      />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <>
          <InfoCard title="Deadline reminders" subtitle="Tasks due within the next 3 days">
            {reminders.length === 0 ? (
              <Text style={styles.body}>No upcoming deadlines.</Text>
            ) : (
              reminders.map((task) => (
                <Text key={task.id} style={styles.body}>
                  • {task.title} — due {task.dueDate}
                </Text>
              ))
            )}
          </InfoCard>
          <InfoCard title="Open condition issues" subtitle="Safety & quality items needing attention">
            <Text style={styles.stat}>{openIssues} open issue(s)</Text>
          </InfoCard>
          <InfoCard title="Active escalations" subtitle="Emergency channels to upper management">
            <Text style={styles.stat}>{openEscalations} active escalation(s)</Text>
          </InfoCard>
          <InfoCard title="Premium features preview" subtitle="Site observations can be marked billable">
            <Chip label="Billable observations — coming soon" />
          </InfoCard>
          <Pressable style={styles.printButton} onPress={handlePrintDiary}>
            <Text style={styles.printButtonText}>Print consolidated site diary</Text>
          </Pressable>
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  loader: { marginTop: 24 },
  body: { marginTop: 8, color: colors.text, lineHeight: 22 },
  stat: { marginTop: 8, fontSize: 24, fontWeight: '700', color: colors.text },
  printButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  printButtonText: { color: colors.primary, fontWeight: '600', fontSize: 16 },
  signOutButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  signOutText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
