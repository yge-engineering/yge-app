// YGE mobile app entry point.
//
// Bottom-tab navigator with four tabs:
//   • Dashboard — pipeline + active bids
//   • Jobs      — active job list
//   • Estimates — bid list
//   • Me        — locale, sign-out, app info
//
// Real screen content lands in subsequent bundles.

import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import DashboardScreen from './src/screens/dashboard-screen';
import JobsScreen from './src/screens/jobs-screen';
import EstimatesScreen from './src/screens/estimates-screen';
import MeScreen from './src/screens/me-screen';
import { useTranslator } from './src/lib/use-translator';

const Tab = createBottomTabNavigator();

export default function App() {
  const { t } = useTranslator();
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            tabBarActiveTintColor: '#0a3a6b',
            tabBarInactiveTintColor: '#64748b',
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            headerStyle: { backgroundColor: '#0a3a6b' },
            headerTintColor: '#ffffff',
            headerTitleStyle: { fontWeight: '700' },
          }}
        >
          <Tab.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📊</Text>,
              title: t('mobile.tab.dashboard'),
            }}
          />
          <Tab.Screen
            name="Jobs"
            component={JobsScreen}
            options={{
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🚧</Text>,
              title: t('mobile.tab.jobs'),
            }}
          />
          <Tab.Screen
            name="Estimates"
            component={EstimatesScreen}
            options={{
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📋</Text>,
              title: t('mobile.tab.estimates'),
            }}
          />
          <Tab.Screen
            name="Me"
            component={MeScreen}
            options={{
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>👤</Text>,
              title: t('mobile.tab.me'),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
