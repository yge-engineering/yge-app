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

interface InspectionRow {
  id: string;
  equipmentId: string;
  inspectedOn: string;
  type: string;
  inspectorName: string;
  outOfService?: boolean;
  checks?: Array<{ status: string }>;
}

interface EquipmentLite {
  id: string;
  name: string;
}

function deficiencyCount(checks?: Array<{ status: string }>): number {
  if (!checks) return 0;
  return checks.filter(
    (c) => c.status === 'FAIL' || c.status === 'NEEDS_ATTENTION',
  ).length;
}

function statusInfo(
  outOfService: boolean,
  deficiencies: number,
): { label: string; border: string; bg: string; text: string } {
  if (outOfService)
    return { label: 'Out of service', border: '#fecaca', bg: '#fef2f2', text: '#991b1b' };
  if (deficiencies > 0)
    return { label: 'Needs attention', border: '#fcd34d', bg: '#fffbeb', text: '#92400e' };
  return { label: 'OK', border: '#a7f3d0', bg: '#ecfdf5', text: '#065f46' };
}

export default function EquipmentInspectionsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [eqNames, setEqNames] = useState<Map<string, string>>(new Map());

  async function load() {
    setError(null);
    try {
      const json = await getJson<{ inspections: InspectionRow[] }>(
        '/api/equipment-inspections',
      );
      setInspections(json.inspections ?? []);
      try {
        const ej = await getJson<{ equipment: EquipmentLite[] }>('/api/equipment');
        const m = new Map<string, string>();
        for (const e of ej.equipment ?? []) m.set(e.id, e.name);
        setEqNames(m);
      } catch {
        // Non-fatal: list still renders with raw ids.
      }
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

  const oos = inspections.filter((i) => i.outOfService).length;

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
      <Text style={styles.h1}>Equipment inspections</Text>
      <Text style={styles.sub}>
        {oos} out of service · {inspections.length} inspection{inspections.length === 1 ? '' : 's'}
      </Text>

      {loading && !refreshing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
          <ActivityIndicator size="small" color="#0a3a6b" />
          <Text style={{ marginLeft: 8, color: '#64748b' }}>Loading…</Text>
        </View>
      )}

      {error && <ErrorCard message={error} onRetry={() => { setLoading(true); void load(); }} />}

      {inspections.map((insp) => {
        const def = deficiencyCount(insp.checks);
        const info = statusInfo(Boolean(insp.outOfService), def);
        const eqName = eqNames.get(insp.equipmentId) ?? insp.equipmentId;
        return (
          <View key={insp.id} style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {eqName}
              </Text>
              <View style={[styles.pill, { borderColor: info.border, backgroundColor: info.bg }]}>
                <Text style={[styles.pillText, { color: info.text }]}>{info.label}</Text>
              </View>
            </View>
            <Text style={styles.meta}>
              {insp.inspectedOn} · {insp.type.replace(/_/g, ' ').toLowerCase()} · {insp.inspectorName}
            </Text>
            {def > 0 ? (
              <Text style={styles.deficiency}>
                {def} issue{def === 1 ? '' : 's'}
              </Text>
            ) : null}
          </View>
        );
      })}

      {!loading && !error && inspections.length === 0 && (
        <View style={[styles.card, { borderStyle: 'dashed' }]}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>No inspections logged yet.</Text>
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
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
