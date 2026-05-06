import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SUPPORTED_LOCALES } from '@yge/shared';
import { useTranslator } from '../lib/use-translator';
import { clearAuth, readAuth, type AuthUser } from '../lib/auth-store';
import { apiBaseUrl } from '../lib/api';

interface Props {
  onSignOut: () => void;
}

export default function MeScreen({ onSignOut }: Props) {
  const { t, locale, setLocale } = useTranslator();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    void readAuth().then((a) => setUser(a.user));
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.h1}>{t('mobile.tab.me')}</Text>

      {user && (
        <View style={styles.card}>
          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.value}>{user.name ?? user.email}</Text>
          <Text style={styles.sub}>{user.email}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>{t('mobile.locale.label')}</Text>
        <View style={styles.localeRow}>
          {SUPPORTED_LOCALES.map((loc) => {
            const active = loc === locale;
            return (
              <Pressable
                key={loc}
                onPress={() => void setLocale(loc)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t(`mobile.locale.${loc}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>API server</Text>
        <Text style={styles.mono}>{apiBaseUrl()}</Text>
      </View>

      <Pressable
        onPress={async () => {
          await clearAuth();
          onSignOut();
        }}
        style={styles.signOut}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: '#0a3a6b', marginBottom: 16 },
  card: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  value: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  sub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  mono: { fontFamily: 'Courier', fontSize: 13, color: '#0f172a' },
  localeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  chipActive: { backgroundColor: '#0a3a6b', borderColor: '#0a3a6b' },
  chipText: { fontSize: 12, color: '#334155' },
  chipTextActive: { color: '#ffffff', fontWeight: '600' },
  signOut: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    alignItems: 'center',
  },
  signOutText: { color: '#991b1b', fontSize: 14, fontWeight: '700' },
});
