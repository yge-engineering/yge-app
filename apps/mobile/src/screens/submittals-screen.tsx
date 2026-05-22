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

type SubmittalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'APPROVED_AS_NOTED'
  | 'REVISE_RESUBMIT'
  | 'REJECTED'
  | 'WITHDRAWN';

interface SubmittalRow {
  id: string;
  submittalNumber: string;
  revision?: string;
  subject: string;
  specSection?: string;
  status: SubmittalStatus;
  blocksOrdering?: boolean;
}

function statusTone(status: SubmittalStatus): { border: string; bg: string; text: string } {
  switch (status) {
    case 'APPROVED':
    case 'APPROVED_AS_NOTED':
      return { border: '#a7f3d0', bg: '#ecfdf5', text: '#065f46' };
    case 'SUBMITTED':
      return { border: '#bfdbfe', bg: '#eff6ff', text: '#1e40af' };
    case 'REVISE_RESUBMIT':
    case 'REJECTED':
      return { border: '#fecaca', bg: '#fef2f2', text: '#991b1b' };
    case 'WITHDRAWN':
      return { border: '#e5e7eb', bg: '#f8fafc', text: '#475569' };
    default:
      return { border: '#fcd34d', bg: '#fffbeb', text: '#92400e' };
  }
}

function statusLabel(status: SubmittalStatus): string {
  return status.replace(/_/g, ' ');
}

export default function SubmittalsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittals, setSubmittals] = useState<SubmittalRow[]>([]);

  async function load() {
    setError(null);
    try {
      const json = await getJson<{ submittals: SubmittalRow[] }>('/api/submittals');
      setSubmittals(json.submittals ?? []);
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

  const awaiting = submittals.filter((s) => s.status === 'SUBMITTED').length;

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
      <Text style={styles.h1}>Submittals</Text>
      <Text style={styles.sub}>{awaiting} awaiting return · {submittals.length} total</Text>

      {loading && !refreshing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
          <ActivityIndicator size="small" color="#0a3a6b" />
          <Text style={{ marginLeft: 8, color: '#64748b' }}>Loading…</Text>
        </View>
      )}

      {error && <ErrorCard message={error} onRetry={() => { setLoading(true); void load(); }} />}

      {submittals.map((s) => {
        const tone = statusTone(s.status);
        const num = s.revision ? `${s.submittalNumber} Rev ${s.revision}` : s.submittalNumber;
        return (
          <View key={s.id} style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {num} · {s.subject}
              </Text>
              <View style={[styles.pill, { borderColor: tone.border, backgroundColor: tone.bg }]}>
                <Text style={[styles.pillText, { color: tone.text }]}>{statusLabel(s.status)}</Text>
              </View>
            </View>
            {s.specSection ? <Text style={styles.meta}>{s.specSection}</Text> : null}
            {s.blocksOrdering ? <Text style={styles.blocks}>⛔ Blocks ordering</Text> : null}
          </View>
        );
      })}

      {!loading && !error && submittals.length === 0 && (
        <View style={[styles.card, { borderStyle: 'dashed' }]}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>No submittals logged yet.</Text>
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
  meta: { fontSize: 12, color: '#64748b', marginTop: 4 },
  blocks: { fontSize: 12, color: '#991b1b', fontWeight: '700', marginTop: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
