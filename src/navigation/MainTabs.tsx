import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EscalationModal } from '../components/EscalationModal';
import type { AuthRepository, SiteDiaryRepository } from '../data/repositories';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import {
  ConditionScreen,
  ObservationScreen,
} from '../screens/ObservationAndConditionScreens';
import { colors } from '../theme/colors';

export type MainTabParamList = {
  Home: undefined;
  Progress: undefined;
  Observations: undefined;
  Conditions: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

interface MainTabsProps {
  authRepository: AuthRepository;
  diaryRepository: SiteDiaryRepository;
  onSignOut: () => void;
}

export function MainTabs({ authRepository, diaryRepository, onSignOut }: MainTabsProps) {
  const insets = useSafeAreaInsets();
  const [escalationVisible, setEscalationVisible] = useState(false);

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
                Observations: 'eye',
                Conditions: 'warning',
              };
              return <Ionicons name={icons[route.name]} size={size} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Home">
            {() => (
              <DashboardScreen
                authRepository={authRepository}
                diaryRepository={diaryRepository}
                onSignOut={onSignOut}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Progress">
            {() => <ProgressScreen diaryRepository={diaryRepository} />}
          </Tab.Screen>
          <Tab.Screen name="Observations">
            {() => <ObservationScreen diaryRepository={diaryRepository} />}
          </Tab.Screen>
          <Tab.Screen name="Conditions">
            {() => <ConditionScreen diaryRepository={diaryRepository} />}
          </Tab.Screen>
        </Tab.Navigator>

        <Pressable
          style={[styles.alertButton, { top: insets.top + 8 }]}
          onPress={() => setEscalationVisible(true)}
          accessibilityLabel="Emergency escalation"
          hitSlop={8}
        >
          <Ionicons name="alert-circle" size={30} color={colors.error} />
        </Pressable>

        <EscalationModal
          visible={escalationVisible}
          onClose={() => setEscalationVisible(false)}
          diaryRepository={diaryRepository}
        />
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  alertButton: {
    position: 'absolute',
    right: 16,
    zIndex: 100,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
});
