import { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import DashboardScreen from './src/screens/dashboard-screen';
import JobsScreen from './src/screens/jobs-screen';
import JobDetailScreen from './src/screens/job-detail-screen';
import EstimatesScreen from './src/screens/estimates-screen';
import EstimateDetailScreen from './src/screens/estimate-detail-screen';
import MeScreen from './src/screens/me-screen';
import LoginScreen from './src/screens/login-screen';
import { readAuth } from './src/lib/auth-store';
import { useTranslator } from './src/lib/use-translator';

export type JobsStackParamList = {
  JobsList: undefined;
  JobDetail: { id: string };
};
export type EstimatesStackParamList = {
  EstimatesList: undefined;
  EstimateDetail: { id: string };
};

const Tab = createBottomTabNavigator();
const JobsStack = createNativeStackNavigator<JobsStackParamList>();
const EstimatesStack = createNativeStackNavigator<EstimatesStackParamList>();

function JobsStackNav() {
  return (
    <JobsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0a3a6b' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <JobsStack.Screen name="JobsList" component={JobsScreen} options={{ title: 'Jobs' }} />
      <JobsStack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job' }} />
    </JobsStack.Navigator>
  );
}

function EstimatesStackNav() {
  return (
    <EstimatesStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0a3a6b' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <EstimatesStack.Screen name="EstimatesList" component={EstimatesScreen} options={{ title: 'Estimates' }} />
      <EstimatesStack.Screen name="EstimateDetail" component={EstimateDetailScreen} options={{ title: 'Estimate' }} />
    </EstimatesStack.Navigator>
  );
}

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
          component={JobsStackNav}
          options={{
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🚧</Text>,
            title: t('mobile.tab.jobs'),
            headerShown: false,
          }}
        />
        <Tab.Screen
          name="Estimates"
          component={EstimatesStackNav}
          options={{
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📋</Text>,
            title: t('mobile.tab.estimates'),
            headerShown: false,
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
