import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { SettingsScreen } from '../screens/SettingsScreen';
import { BleScanScreen } from '../screens/BleScanScreen';
import { colors } from '../theme/colors';

export type SettingsStackParamList = {
  SettingsHome: undefined;
  BleScan: undefined;
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStack() {
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
      <Stack.Screen name="SettingsHome" options={{ headerShown: false }}>
        {({ navigation }) => (
          <SettingsScreen onOpenBleScan={() => navigation.navigate('BleScan')} />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="BleScan"
        component={BleScanScreen}
        options={{
          title: t('ble.title'),
          headerBackTitle: t('tabs.settings'),
        }}
      />
    </Stack.Navigator>
  );
}
