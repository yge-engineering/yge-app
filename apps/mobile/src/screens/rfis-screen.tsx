import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getJson } from '../lib/api';
import { ErrorCard } from '../components/error-card';

type RfiStatus = 'DRAFT' | 'SENT' | 'ANSWERED' | 'CLOSED' | 'WITHDRAWN';

interface RfiRow {
  id: string;
  rfiNumber: string;
  subject: string;
  status: RfiStatus;
}

function statusTone(status: RfiStatus): { border: string; bg: string; text: string } {
  switch (status) {
    case 'ANSWERED':
    case 'CLOSED':
      return { border: '#a7f3d0', bg: '#ecfdf5', text: '#065f46' };
    case 'SENT':
      return { border: '#bfdbfe', bg: '#eff6ff', text: '#1e40af' };
    case 'WITHDRAWN':
      return { border: '#e5e7eb', bg: '#f8fafc', text: '#475569' };
    default:
      return { border: '#fcd34d', bg: '#fffbeb', text: '#92400e' };
  }
}

export default function RfisScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rfis, setRfis] = useState<RfiRow[]>([]);

  async function load() {
    setError(null);
    try {
      const json = await getJson<{ rfis: RfiRow[] }>('/api/rfis');
      setRfis(json.rfis ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const openCount = rfis.filter((r) => r.status === 'SENT' || r.status === 'DRAFT').length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
      contentContainerStyle={{ padding: 16, maxWidth: 720, width: '100%', alignSelf: 'center' }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      <Text style={styles.h1}>RFIs</Text>
      <Text style={styles.sub}>{openCount} awaiting answer · {rfis.length} total</Text>

      {loading && !refreshing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
          <ActivityIndicator size="small" color="#0a3a6b" />
          <Text style={{ marginLeft: 8, color: '#64748b' }}>Loading…</Text>
        </View>
      )}

      {error && <ErrorCard message={error} onRetry={() => { setLoading(true); void load(); }} />}

      {rfis.map((r) => {
        const tone = statusTone(r.status);
        return (
          <View key={r.id} style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {r.rfiNumber} · {r.subject}
              </Text>
              <View style={[styles.pill, { borderColor: tone.border, backgroundColor: tone.bg }]}>
                <Text style={[styles.pillText, { color: tone.text }]}>{r.status}</Text>
              </View>
            </View>
          </View>
        );
      })}

      {!loading && !error && rfis.length === 0 && (
        <View style={[styles.card, { borderStyle: 'dashed' }]}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>No RFIs logged yet.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: '#0a3a6b' },
  sub: { fontSize: 13, color: '#475569', marginTop: 4, marginBottom: 16 },
  card: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
