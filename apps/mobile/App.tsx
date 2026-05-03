// YGE mobile app — Phase 2 entry point.
//
// Phase 1 ships the web + API + browser-extension; the mobile app
// is foreman-and-crew facing (clock in/out, daily-report drafts,
// material orders, photos, PTO requests). This file is the bare
// scaffold so `expo start` runs end-to-end. The real screens land
// once Phase 1 stabilizes and the auth + tenant model is wired
// to Supabase.
//
// i18n: the shared @yge/shared dictionary drives the strings,
// matching what the web app uses. The locale picker below is
// in-memory only — the next bundle wires AsyncStorage-backed
// persistence + react-native-localize for system-detection.

import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  DEFAULT_LOCALE,
  SEED_DICTIONARY,
  SUPPORTED_LOCALES,
  makeTranslator,
  type Locale,
} from '@yge/shared';

function apiUrl(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiUrl;
  return typeof fromExtra === 'string' ? fromExtra : 'http://localhost:4000';
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const t = makeTranslator(SEED_DICTIONARY, locale);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.shell}>
        <View style={styles.hero}>
          <Text style={styles.brand}>{t('app.title')}</Text>
          <Text style={styles.tagline}>{t('app.tagline')}</Text>
        </View>

        <View style={styles.localeRow}>
          <Text style={styles.localeLabel}>{t('mobile.locale.label')}:</Text>
          {SUPPORTED_LOCALES.map((loc) => {
            const active = loc === locale;
            return (
              <Pressable
                key={loc}
                onPress={() => setLocale(loc)}
                style={[styles.localeChip, active && styles.localeChipActive]}
              >
                <Text style={[styles.localeChipText, active && styles.localeChipTextActive]}>
                  {t(`mobile.locale.${loc}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.h2}>{t('mobile.phase2.title')}</Text>
          <Text style={styles.body}>{t('mobile.phase2.body')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.h3}>{t('mobile.connection')}</Text>
          <Text style={styles.mono}>API → {apiUrl()}</Text>
          <Text style={styles.note}>{t('mobile.connection.note')}</Text>
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
  localeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  localeLabel: {
    fontSize: 12,
    color: '#475569',
    marginRight: 4,
  },
  localeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  localeChipActive: {
    backgroundColor: '#0a3a6b',
    borderColor: '#0a3a6b',
  },
  localeChipText: {
    fontSize: 12,
    color: '#334155',
  },
  localeChipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
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
