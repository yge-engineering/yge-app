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

type TimeCardStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'REJECTED';

interface TimeCardRow {
  id: string;
  employeeId: string;
  weekStarting: string;
  status: TimeCardStatus;
  entries?: unknown[];
  notes?: string;
}

function statusTone(status: TimeCardStatus): { border: string; bg: string; text: string } {
  switch (status) {
    case 'APPROVED':
    case 'POSTED':
      return { border: '#a7f3d0', bg: '#ecfdf5', text: '#065f46' };
    case 'SUBMITTED':
      return { border: '#bfdbfe', bg: '#eff6ff', text: '#1e40af' };
    case 'REJECTED':
      return { border: '#fecaca', bg: '#fef2f2', text: '#991b1b' };
    default:
      return { border: '#fcd34d', bg: '#fffbeb', text: '#92400e' };
  }
}

export default function TimeCardsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<TimeCardRow[]>([]);

  async function load() {
    setError(null);
    try {
      const json = await getJson<{ timeCards: TimeCardRow[] }>('/api/time-cards');
      setCards(json.timeCards ?? []);
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
      <Text style={styles.h1}>Time Cards</Text>
      <Text style={styles.sub}>{cards.length} total · newest week first</Text>

      {loading && !refreshing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
          <ActivityIndicator size="small" color="#0a3a6b" />
          <Text style={{ marginLeft: 8, color: '#64748b' }}>Loading…</Text>
        </View>
      )}

      {error && <ErrorCard message={error} onRetry={() => { setLoading(true); void load(); }} />}

      {cards.map((c) => {
        const tone = statusTone(c.status);
        const shifts = Array.isArray(c.entries) ? c.entries.length : 0;
        return (
          <View key={c.id} style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>
                Week of{' '}
                {new Date(c.weekStarting).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
              <View style={[styles.pill, { borderColor: tone.border, backgroundColor: tone.bg }]}>
                <Text style={[styles.pillText, { color: tone.text }]}>{c.status}</Text>
              </View>
            </View>
            <Text style={styles.cardSub}>
              {shifts} shift{shifts === 1 ? '' : 's'} logged
            </Text>
            {c.notes ? (
              <Text style={styles.notes} numberOfLines={2}>
                {c.notes}
              </Text>
            ) : null}
          </View>
        );
      })}

      {!loading && !error && cards.length === 0 && (
        <View style={[styles.card, { borderStyle: 'dashed' }]}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>
            No time cards yet. Crew time cards show up here once they&apos;re started.
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  cardSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  notes: { fontSize: 13, color: '#334155', marginTop: 8, lineHeight: 18 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
