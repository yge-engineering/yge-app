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

type PunchItemStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'DISPUTED' | 'WAIVED';

interface PunchItemRow {
  id: string;
  jobId: string;
  identifiedOn: string;
  location: string;
  description: string;
  status: PunchItemStatus;
  responsibleParty?: string;
}

function statusTone(status: PunchItemStatus): { border: string; bg: string; text: string } {
  switch (status) {
    case 'CLOSED':
    case 'WAIVED':
      return { border: '#a7f3d0', bg: '#ecfdf5', text: '#065f46' };
    case 'IN_PROGRESS':
      return { border: '#bfdbfe', bg: '#eff6ff', text: '#1e40af' };
    case 'DISPUTED':
      return { border: '#fecaca', bg: '#fef2f2', text: '#991b1b' };
    default:
      return { border: '#fcd34d', bg: '#fffbeb', text: '#92400e' };
  }
}

export default function PunchListScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PunchItemRow[]>([]);

  async function load() {
    setError(null);
    try {
      const json = await getJson<{ items: PunchItemRow[] }>('/api/punch-items');
      setItems(json.items ?? []);
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

  const open = items.filter((i) => i.status === 'OPEN' || i.status === 'IN_PROGRESS').length;

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
      <Text style={styles.h1}>Punch List</Text>
      <Text style={styles.sub}>{open} open · {items.length} total</Text>

      {loading && !refreshing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
          <ActivityIndicator size="small" color="#0a3a6b" />
          <Text style={{ marginLeft: 8, color: '#64748b' }}>Loading…</Text>
        </View>
      )}

      {error && <ErrorCard message={error} onRetry={() => { setLoading(true); void load(); }} />}

      {items.map((i) => {
        const tone = statusTone(i.status);
        return (
          <View key={i.id} style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {i.location}
              </Text>
              <View style={[styles.pill, { borderColor: tone.border, backgroundColor: tone.bg }]}>
                <Text style={[styles.pillText, { color: tone.text }]}>{i.status.replace('_', ' ')}</Text>
              </View>
            </View>
            <Text style={styles.desc} numberOfLines={3}>
              {i.description}
            </Text>
            <Text style={styles.cardSub}>
              {new Date(i.identifiedOn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {i.responsibleParty ? ` · ${i.responsibleParty}` : ''}
            </Text>
          </View>
        );
      })}

      {!loading && !error && items.length === 0 && (
        <View style={[styles.card, { borderStyle: 'dashed' }]}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>
            No punch items. They show up here as walkthroughs flag work to fix.
          </Text>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  desc: { fontSize: 13, color: '#334155', marginTop: 6, lineHeight: 18 },
  cardSub: { fontSize: 12, color: '#64748b', marginTop: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
