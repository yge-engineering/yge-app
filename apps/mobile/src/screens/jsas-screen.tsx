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

interface HazardLite {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  controls?: string[];
}
interface JsaRow {
  id: string;
  jobId: string;
  workDate: string;
  taskType: string;
  preparedByName: string;
  hazards?: HazardLite[];
  crewSignatures?: Array<{ employeeName: string }>;
}

function hasHigh(j: JsaRow): boolean {
  return (j.hazards ?? []).some((h) => h.severity === 'HIGH' || h.severity === 'CRITICAL');
}
function uncontrolledCount(j: JsaRow): number {
  return (j.hazards ?? []).filter((h) => (h.controls ?? []).length === 0).length;
}

function statusInfo(j: JsaRow): { label: string; border: string; bg: string; text: string } {
  if (hasHigh(j))
    return { label: 'High / Critical', border: '#fecaca', bg: '#fef2f2', text: '#991b1b' };
  if (uncontrolledCount(j) > 0)
    return { label: 'Uncontrolled', border: '#fcd34d', bg: '#fffbeb', text: '#92400e' };
  return { label: 'OK', border: '#a7f3d0', bg: '#ecfdf5', text: '#065f46' };
}

export default function JsasScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsas, setJsas] = useState<JsaRow[]>([]);

  async function load() {
    setError(null);
    try {
      const json = await getJson<{ jsas: JsaRow[] }>('/api/jsas');
      setJsas(json.jsas ?? []);
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

  const high = jsas.filter((j) => hasHigh(j)).length;

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
      <Text style={styles.h1}>JSAs</Text>
      <Text style={styles.sub}>
        {high} with high/critical hazards · {jsas.length} JSA{jsas.length === 1 ? '' : 's'}
      </Text>

      {loading && !refreshing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
          <ActivityIndicator size="small" color="#0a3a6b" />
          <Text style={{ marginLeft: 8, color: '#64748b' }}>Loading…</Text>
        </View>
      )}
      {error && <ErrorCard message={error} onRetry={() => { setLoading(true); void load(); }} />}

      {jsas.map((j) => {
        const info = statusInfo(j);
        return (
          <View key={j.id} style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>{j.taskType.replace(/_/g, ' ').toLowerCase()}</Text>
              <View style={[styles.pill, { borderColor: info.border, backgroundColor: info.bg }]}>
                <Text style={[styles.pillText, { color: info.text }]}>{info.label}</Text>
              </View>
            </View>
            <Text style={styles.meta}>
              {j.workDate} · {j.preparedByName} · job {j.jobId}
            </Text>
            <Text style={styles.meta}>
              {(j.hazards ?? []).length} hazard{(j.hazards ?? []).length === 1 ? '' : 's'} ·{' '}
              {(j.crewSignatures ?? []).length} crew signed
            </Text>
          </View>
        );
      })}

      {!loading && !error && jsas.length === 0 && (
        <View style={[styles.card, { borderStyle: 'dashed' }]}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>No JSAs logged yet.</Text>
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
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
