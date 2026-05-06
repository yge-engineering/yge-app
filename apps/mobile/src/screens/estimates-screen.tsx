import { ScrollView, Text } from 'react-native';

export default function EstimatesScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#0a3a6b' }}>Estimates</Text>
      <Text style={{ fontSize: 14, color: '#475569', marginTop: 8 }}>Bid list — coming next.</Text>
    </ScrollView>
  );
}
