import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { RiskCaptureScreen } from '../screens/RiskCaptureScreen';
import { RiskQueueScreen } from '../screens/RiskQueueScreen';
import { RiskAssessmentDetailScreen } from '../screens/RiskAssessmentDetailScreen';
import { colors } from '../theme/colors';

export type SiteDiaryStackParamList = {
  QueueList: undefined;
  Capture: undefined;
  AssessmentDetail: { itemId: string };
};

const Stack = createNativeStackNavigator<SiteDiaryStackParamList>();

export function SiteDiaryStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="QueueList" options={{ headerShown: false }}>
        {({ navigation }) => (
          <RiskQueueScreen
            onCapture={() => navigation.navigate('Capture')}
            onOpenItem={(itemId) => navigation.navigate('AssessmentDetail', { itemId })}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Capture"
        options={{ title: t('riskCapture.title'), headerBackTitle: t('tabs.siteDiary') }}
      >
        {({ navigation }) => (
          <RiskCaptureScreen onQueued={() => navigation.navigate('QueueList')} />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="AssessmentDetail"
        options={{ title: t('queue.detailTitle'), headerBackTitle: t('tabs.siteDiary') }}
      >
        {({ route, navigation }) => (
          <RiskAssessmentDetailScreen
            itemId={route.params.itemId}
            onDeleted={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

/** @deprecated Use SiteDiaryStack */
export const AssessmentsStack = SiteDiaryStack;
export type AssessmentsStackParamList = SiteDiaryStackParamList;
