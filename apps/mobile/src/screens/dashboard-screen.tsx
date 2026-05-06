import { ScrollView, Text, View } from 'react-native';
import { useTranslator } from '../lib/use-translator';

export default function DashboardScreen() {
  const { t } = useTranslator();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 28, fontWeight: '800', color: '#0a3a6b' }}>{t('app.title')}</Text>
      <Text style={{ fontSize: 14, color: '#475569', marginTop: 4 }}>{t('app.tagline')}</Text>
      <View
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#e5e7eb',
          backgroundColor: '#ffffff',
        }}
      >
        <Text style={{ fontSize: 14, lineHeight: 20, color: '#334155' }}>
          Mobile app foundation under construction. Tabs are stubs; real
          content lands in the next few autopilot bundles.
        </Text>
      </View>
    </ScrollView>
  );
}
