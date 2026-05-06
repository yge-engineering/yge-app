import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SUPPORTED_LOCALES } from '@yge/shared';
import { useTranslator } from '../lib/use-translator';

export default function MeScreen() {
  const { t, locale, setLocale } = useTranslator();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#0a3a6b' }}>{t('mobile.tab.me')}</Text>
      <View style={styles.localeRow}>
        <Text style={styles.label}>{t('mobile.locale.label')}:</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  localeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  label: { fontSize: 12, color: '#475569' },
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
});
