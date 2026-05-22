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

type ToolStatus = 'IN_YARD' | 'IN_SHOP' | 'ASSIGNED' | 'OUT_FOR_REPAIR' | 'LOST' | 'RETIRED';

interface ToolRow {
  id: string;
  name: string;
  category: string;
  make?: string;
  model?: string;
  serialNumber?: string;
  assetTag?: string;
  status: ToolStatus;
  assignedToEmployeeId?: string;
  assignedAt?: string;
}

interface EmpRow {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
}

function statusTone(status: ToolStatus): { border: string; bg: string; text: string } {
  switch (status) {
    case 'IN_YARD':
    case 'IN_SHOP':
      return { border: '#a7f3d0', bg: '#ecfdf5', text: '#065f46' };
    case 'ASSIGNED':
      return { border: '#bfdbfe', bg: '#eff6ff', text: '#1e40af' };
    case 'OUT_FOR_REPAIR':
      return { border: '#fcd34d', bg: '#fffbeb', text: '#92400e' };
    case 'LOST':
      return { border: '#fecaca', bg: '#fef2f2', text: '#991b1b' };
    default:
      return { border: '#e5e7eb', bg: '#f8fafc', text: '#475569' };
  }
}

export default function ToolsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [empNames, setEmpNames] = useState<Map<string, string>>(new Map());

  async function load() {
    setError(null);
    try {
      const toolsJson = await getJson<{ tools: ToolRow[] }>('/api/tools');
      setTools(toolsJson.tools ?? []);
      try {
        const empJson = await getJson<{ employees: EmpRow[] }>('/api/employees');
        const map = new Map<string, string>();
        for (const e of empJson.employees ?? []) {
          const nm = e.displayName ?? [e.firstName, e.lastName].filter(Boolean).join(' ');
          if (nm) map.set(e.id, nm);
        }
        setEmpNames(map);
      } catch {
        // Non-fatal: tools still render without holder names.
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

  const out = tools.filter((t) => t.status === 'ASSIGNED').length;

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
      <Text style={styles.h1}>Tools</Text>
      <Text style={styles.sub}>{out} checked out · {tools.length} total</Text>

      {loading && !refreshing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
          <ActivityIndicator size="small" color="#0a3a6b" />
          <Text style={{ marginLeft: 8, color: '#64748b' }}>Loading…</Text>
        </View>
      )}

      {error && <ErrorCard message={error} onRetry={() => { setLoading(true); void load(); }} />}

      {tools.map((t) => {
        const tone = statusTone(t.status);
        const makeModel = [t.make, t.model].filter(Boolean).join(' ');
        const holder = t.assignedToEmployeeId ? empNames.get(t.assignedToEmployeeId) : undefined;
        const ident = t.assetTag ? `Tag ${t.assetTag}` : t.serialNumber ? `S/N ${t.serialNumber}` : '';
        return (
          <View key={t.id} style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle} numberOfLines={2}>{t.name}</Text>
              <View style={[styles.pill, { borderColor: tone.border, backgroundColor: tone.bg }]}>
                <Text style={[styles.pillText, { color: tone.text }]}>{t.status.replace(/_/g, ' ')}</Text>
              </View>
            </View>
            <Text style={styles.meta}>
              {t.category.replace(/_/g, ' ')}
              {makeModel ? ` · ${makeModel}` : ''}
              {ident ? ` · ${ident}` : ''}
            </Text>
            {t.status === 'ASSIGNED' ? (
              <Text style={styles.held}>Held by {holder ?? 'crew'}</Text>
            ) : null}
          </View>
        );
      })}

      {!loading && !error && tools.length === 0 && (
        <View style={[styles.card, { borderStyle: 'dashed' }]}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>No tools logged yet.</Text>
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
  held: { fontSize: 12, color: '#1e40af', fontWeight: '700', marginTop: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
