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

interface DailyReportRow {
  id: string;
  jobId: string;
  reportDate: string;
  status: 'draft' | 'submitted';
  foremanName?: string;
  notes?: string;
  crewCount?: number;
}

export default function DailyReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<DailyReportRow[]>([]);

  async function load() {
    setError(null);
    try {
      const json = await getJson<{ reports: DailyReportRow[] }>('/api/daily-reports');
      setReports(json.reports ?? []);
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
      contentContainerStyle={{ padding: 16 }}
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
      <Text style={styles.h1}>Daily Reports</Text>
      <Text style={styles.sub}>{reports.length} total · newest first</Text>

      {loading && !refreshing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
          <ActivityIndicator size="small" color="#0a3a6b" />
          <Text style={{ marginLeft: 8, color: '#64748b' }}>Loading…</Text>
        </View>
      )}

      {error && <ErrorCard message={error} onRetry={() => { setLoading(true); void load(); }} />}

      {reports.map((r) => (
        <View key={r.id} style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>
              {new Date(r.reportDate).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
            <View
              style={[
                styles.pill,
                r.status === 'submitted'
                  ? { borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' }
                  : { borderColor: '#fcd34d', backgroundColor: '#fffbeb' },
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: r.status === 'submitted' ? '#065f46' : '#92400e' },
                ]}
              >
                {r.status}
              </Text>
            </View>
          </View>
          {r.foremanName && (
            <Text style={styles.cardSub}>Foreman: {r.foremanName}</Text>
          )}
          {typeof r.crewCount === 'number' && r.crewCount > 0 && (
            <Text style={styles.cardSub}>
              {r.crewCount} crew member{r.crewCount === 1 ? '' : 's'}
            </Text>
          )}
          {r.notes && (
            <Text style={styles.notes} numberOfLines={2}>
              {r.notes}
            </Text>
          )}
        </View>
      ))}

      {!loading && !error && reports.length === 0 && (
        <View style={[styles.card, { borderStyle: 'dashed' }]}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>
            No daily reports yet. Foremen submit these from the field.
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
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
