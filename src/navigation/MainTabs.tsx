import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EscalationModal } from '../components/EscalationModal';
import { HapticPressable } from '../components/HapticPressable';
import type { AuthRepository, SiteDiaryRepository } from '../data/repositories';
import type { SiteTask } from '../data/models';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SiteDiaryStack } from './SiteDiaryStack';
import { colors } from '../theme/colors';
import { fieldTabBarBottomInset } from '../theme/layout';
import { typography } from '../theme/typography';
import { useUiMode } from '../ui/UiModeProvider';
import { MainTabs as CompleteMainTabs } from '../components/complete/MainTabs';

export type MainTabParamList = {
  Home: undefined;
  Progress: undefined;
  SiteDiary: undefined;
  Settings: undefined;
};

const TAB_LABEL_KEYS: Record<keyof MainTabParamList, string> = {
  Home: 'tabs.home',
  Progress: 'tabs.progress',
  SiteDiary: 'tabs.siteDiary',
  Settings: 'tabs.settings',
};

const Tab = createBottomTabNavigator<MainTabParamList>();

interface MainTabsProps {
  authRepository: AuthRepository;
  diaryRepository: SiteDiaryRepository;
}

function CustomTabBar({
  state,
  descriptors,
  navigation,
  onEmergency,
}: BottomTabBarProps & { onEmergency: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const leftRoutes = state.routes.slice(0, 2);
  const rightRoutes = state.routes.slice(2);

  const renderTab = (route: (typeof state.routes)[number], index: number) => {
    const { options } = descriptors[route.key];
    const isFocused = state.index === index;
    const color = isFocused ? colors.primary : colors.textMuted;
    const label = options.title ?? t(TAB_LABEL_KEYS[route.name as keyof MainTabParamList]);

    return (
      <HapticPressable
        key={route.key}
        style={styles.tabItem}
        onPress={() => navigation.navigate(route.name)}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={label}
      >
        {options.tabBarIcon?.({ focused: isFocused, color, size: 26 })}
        <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
          {label}
        </Text>
      </HapticPressable>
    );
  };

  return (
    <View style={[styles.tabBar, { paddingBottom: fieldTabBarBottomInset(insets.bottom) }]}>
      <View style={styles.tabRow}>
        {leftRoutes.map((route, index) => renderTab(route, index))}
        <View style={styles.emergencySlot}>
          <HapticPressable
            style={styles.emergencyPressable}
            onPress={onEmergency}
            accessibilityRole="button"
            accessibilityLabel={t('tabs.emergencyA11y')}
          >
            <View style={styles.emergencyRing}>
              <View style={styles.emergencyButton}>
                <Ionicons name="alert" size={30} color="#fff" />
                <Text style={styles.emergencyText}>{t('tabs.emergency')}</Text>
              </View>
            </View>
          </HapticPressable>
        </View>
        {rightRoutes.map((route, index) => renderTab(route, index + 2))}
      </View>
    </View>
  );
}

export function MainTabs(props: MainTabsProps) {
  const { isSimplified } = useUiMode();
  if (!isSimplified) return <CompleteMainTabs {...props} />;
  return <MainTabsSimplified {...props} />;
}

function MainTabsSimplified({ authRepository, diaryRepository }: MainTabsProps) {
  const { t } = useTranslation();
  const [escalationVisible, setEscalationVisible] = useState(false);
  const [linkedTask, setLinkedTask] = useState<SiteTask | null>(null);
  const [escalationRefreshSignal, setEscalationRefreshSignal] = useState(0);

  const openEscalation = () => {
    setLinkedTask(null);
    setEscalationVisible(true);
  };

  const openTaskEscalation = (task: SiteTask) => {
    setLinkedTask(task);
    setEscalationVisible(true);
  };

  const closeEscalation = () => {
    setEscalationVisible(false);
    setLinkedTask(null);
  };

  return (
    <NavigationContainer>
      <View style={styles.shell}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarIcon: ({ color, size }) => {
              const icons: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
                Home: 'home',
                Progress: 'clipboard',
                SiteDiary: 'camera',
                Settings: 'settings-outline',
              };
              return <Ionicons name={icons[route.name]} size={size} color={color} />;
            },
          })}
          tabBar={(props) => (
            <CustomTabBar {...props} onEmergency={openEscalation} />
          )}
        >
          <Tab.Screen name="Home" options={{ title: t('tabs.home') }}>
            {() => (
              <DashboardScreen
                authRepository={authRepository}
                diaryRepository={diaryRepository}
                onTaskEscalate={openTaskEscalation}
                escalationRefreshSignal={escalationRefreshSignal}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Progress" options={{ title: t('tabs.progress') }}>
            {() => (
              <ProgressScreen
                diaryRepository={diaryRepository}
                onTaskEscalate={openTaskEscalation}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="SiteDiary" options={{ title: t('tabs.siteDiary') }}>
            {() => <SiteDiaryStack />}
          </Tab.Screen>
          <Tab.Screen name="Settings" options={{ title: t('tabs.settings') }}>
            {() => <SettingsScreen />}
          </Tab.Screen>
        </Tab.Navigator>

        <EscalationModal
          visible={escalationVisible}
          onClose={closeEscalation}
          diaryRepository={diaryRepository}
          linkedTask={linkedTask}
          onSubmitted={() => setEscalationRefreshSignal((signal) => signal + 1)}
        />
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  tabLabel: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  emergencySlot: {
    flex: 1,
    alignItems: 'center',
    marginTop: -36,
  },
  emergencyPressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
  },
  emergencyButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  emergencyText: {
    color: '#fff',
    fontSize: typography.xs,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
