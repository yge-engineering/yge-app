// YGE mobile app entry — gates on a signed-in session.

import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import DashboardScreen from './src/screens/dashboard-screen';
import JobsScreen from './src/screens/jobs-screen';
import EstimatesScreen from './src/screens/estimates-screen';
import MeScreen from './src/screens/me-screen';
import LoginScreen from './src/screens/login-screen';
import { readAuth } from './src/lib/auth-store';
import { useTranslator } from './src/lib/use-translator';

const Tab = createBottomTabNavigator();

function AuthedTabs({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useTranslator();
  return (
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
          options={{
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>👤</Text>,
            title: t('mobile.tab.me'),
          }}
        >
          {() => <MeScreen onSignOut={onSignOut} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void readAuth().then(({ token }) => {
      setSignedIn(!!token);
      setAuthChecked(true);
    });
  }, []);

  return (
    <SafeAreaProvider>
      {!authChecked ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a3a6b' }}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      ) : signedIn ? (
        <AuthedTabs onSignOut={() => setSignedIn(false)} />
      ) : (
        <LoginScreen onSignedIn={() => setSignedIn(true)} />
      )}
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
