// YGE mobile app — Phase 2 entry point.
//
// Phase 1 ships the web + API + browser-extension; the mobile app
// is foreman-and-crew facing (clock in/out, daily-report drafts,
// material orders, photos, PTO requests). This file is the bare
// scaffold so `expo start` runs end-to-end. The real screens land
// once Phase 1 stabilizes and the auth + tenant model is wired
// to Supabase.

import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

function apiUrl(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiUrl;
  return typeof fromExtra === 'string' ? fromExtra : 'http://localhost:4000';
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.shell}>
        <View style={styles.hero}>
          <Text style={styles.brand}>YGE</Text>
          <Text style={styles.tagline}>Heavy civil contractors</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.h2}>Phase 2 — coming soon</Text>
          <Text style={styles.body}>
            The mobile app is the foreman + crew surface: clock in/out,
            daily reports, material orders, photos, PTO requests. Phase 1
            (web + API + browser extension) ships first; this app builds
            on the same shared schemas and audit trail.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.h3}>Connection</Text>
          <Text style={styles.mono}>API → {apiUrl()}</Text>
          <Text style={styles.note}>
            Override per-build via expo config&apos;s `extra.apiUrl` or an
            EXPO_PUBLIC_API_URL env on the build.
          </Text>
        </View>

        <StatusBar style="auto" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  hero: {
    paddingTop: 24,
    paddingBottom: 16,
  },
  brand: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0a3a6b',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 12,
  },
  h2: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  h3: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
  },
  mono: {
    fontFamily: 'Courier',
    fontSize: 13,
    color: '#0f172a',
  },
  note: {
    marginTop: 6,
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
});
