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

type BmpStatus = 'OK' | 'MAINTENANCE_NEEDED' | 'FAILED' | 'NOT_INSTALLED' | 'NOT_APPLICABLE';

interface BmpCheck {
  status: BmpStatus;
}

interface InspectionRow {
  id: string;
  inspectedOn: string;
  trigger?: string;
  inspectorName?: string;
  dischargeOccurred?: boolean;
  bmpChecks?: BmpCheck[];
  finalizedOn?: string;
}

function deficiencyCount(insp: InspectionRow): number {
  return (insp.bmpChecks ?? []).filter(
    (c) => c.status === 'FAILED' || c.status === 'MAINTENANCE_NEEDED',
  ).length;
}

function statusInfo(
  finalized: boolean,
  deficiencies: number,
): { label: string; border: string; bg: string; text: string } {
  if (finalized) return { label: 'Finalized', border: '#a7f3d0', bg: '#ecfdf5', text: '#065f46' };
  if (deficiencies > 0)
    return { label: 'Action needed', border: '#fcd34d', bg: '#fffbeb', text: '#92400e' };
  return { label: 'Open', border: '#bfdbfe', bg: '#eff6ff', text: '#1e40af' };
}

export default function SwpppScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);

  async function load() {
    setError(null);
    try {
      const json = await getJson<{ inspections: InspectionRow[] }>('/api/swppp-inspections');
      setInspections(json.inspections ?? []);
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

  const needAction = inspections.filter((i) => !i.finalizedOn && deficiencyCount(i) > 0).length;

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
      <Text style={styles.h1}>SWPPP</Text>
      <Text style={styles.sub}>{needAction} need action · {inspections.length} inspections</Text>

      {loading && !refreshing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
          <ActivityIndicator size="small" color="#0a3a6b" />
          <Text style={{ marginLeft: 8, color: '#64748b' }}>Loading…</Text>
        </View>
      )}

      {error && <ErrorCard message={error} onRetry={() => { setLoading(true); void load(); }} />}

      {inspections.map((insp) => {
        const deficiencies = deficiencyCount(insp);
        const info = statusInfo(Boolean(insp.finalizedOn), deficiencies);
        const meta = [insp.trigger ? insp.trigger.replace(/_/g, ' ') : null, insp.inspectorName]
          .filter(Boolean)
          .join(' · ');
        return (
          <View key={insp.id} style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>{insp.inspectedOn}</Text>
              <View style={[styles.pill, { borderColor: info.border, backgroundColor: info.bg }]}>
                <Text style={[styles.pillText, { color: info.text }]}>{info.label}</Text>
              </View>
            </View>
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
            {deficiencies > 0 ? (
              <Text style={styles.deficiency}>{deficiencies} BMP issue{deficiencies === 1 ? '' : 's'}</Text>
            ) : null}
            {insp.dischargeOccurred ? <Text style={styles.discharge}>⚠️ Discharge occurred</Text> : null}
          </View>
        );
      })}

      {!loading && !error && inspections.length === 0 && (
        <View style={[styles.card, { borderStyle: 'dashed' }]}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>No SWPPP inspections logged yet.</Text>
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
  deficiency: { fontSize: 12, color: '#92400e', fontWeight: '700', marginTop: 6 },
  discharge: { fontSize: 12, color: '#991b1b', fontWeight: '700', marginTop: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
