import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { JobsStackParamList } from '../../App';
import { getJson } from '../lib/api';
import { cacheGet, cacheSet } from '../lib/cache';
import { ErrorCard } from '../components/error-card';

interface JobLite {
  id: string;
  projectName: string;
  ownerAgency?: string;
  location?: string;
  status: string;
  bidDueDate?: string;
  engineersEstimateCents?: number;
  updatedAt: string;
}

const STATUS_TONE: Record<string, { bg: string; border: string; text: string }> = {
  PROSPECT: { bg: '#f3f4f6', border: '#d1d5db', text: '#374151' },
  PURSUING: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
  BID_SUBMITTED: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
  AWARDED: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
  LOST: { bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280' },
  NO_BID: { bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280' },
  ARCHIVED: { bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280' },
};

function formatMoney(cents: number): string {
  const dollars = Math.round(cents / 100);
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function bidDueLabel(iso: string | undefined): { label: string; tone: 'red' | 'amber' | 'green' } | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const days = Math.round((t - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: 'red' };
  if (days === 0) return { label: 'Due today', tone: 'red' };
  if (days <= 3) return { label: `Due in ${days}d`, tone: 'red' };
  if (days <= 7) return { label: `Due in ${days}d`, tone: 'amber' };
  return { label: `Due in ${days}d`, tone: 'green' };
}

type Nav = NativeStackNavigationProp<JobsStackParamList, 'JobsList'>;
export default function JobsScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobLite[]>([]);
  const [staleAgeMs, setStaleAgeMs] = useState<number | null>(null);

  async function load() {
    setError(null);
    try {
      const json = await getJson<{ jobs: JobLite[] }>('/api/jobs');
      setJobs(json.jobs ?? []);
      setStaleAgeMs(null);
      await cacheSet('cache.jobs', json.jobs ?? []);
    } catch (err) {
      const cached = await cacheGet<JobLite[]>('cache.jobs');
      if (cached) {
        setJobs(cached.value);
        setStaleAgeMs(cached.ageMs);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Filter to active (not archived/closed) and sort by urgency.
  const active = jobs.filter(
    (j) => j.status !== 'ARCHIVED' && j.status !== 'NO_BID',
  );
  active.sort((a, b) => {
    const ka = a.bidDueDate ? new Date(a.bidDueDate).getTime() : Number.POSITIVE_INFINITY;
    const kb = b.bidDueDate ? new Date(b.bidDueDate).getTime() : Number.POSITIVE_INFINITY;
    return ka - kb;
  });

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
      <Text style={styles.h1}>Jobs</Text>
      <Text style={styles.sub}>
        {active.length} active · sorted by bid-due urgency
      </Text>

      {loading && !refreshing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
          <ActivityIndicator size="small" color="#0a3a6b" />
          <Text style={{ marginLeft: 8, color: '#64748b' }}>Loading…</Text>
        </View>
      )}

      {staleAgeMs != null && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            🔌 Offline · last sync {Math.max(1, Math.round(staleAgeMs / 60000))} min ago
          </Text>
        </View>
      )}
      {error && <ErrorCard message={error} onRetry={() => { setLoading(true); void load(); }} />}

      {active.map((j) => {
        const tone = STATUS_TONE[j.status] ?? STATUS_TONE['PROSPECT']!;
        const due = bidDueLabel(j.bidDueDate);
        const dueTone =
          due?.tone === 'red'
            ? { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' }
            : due?.tone === 'amber'
              ? { bg: '#fffbeb', border: '#fde68a', text: '#92400e' }
              : { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' };
        return (
          <Pressable key={j.id} onPress={() => navigation.navigate('JobDetail', { id: j.id })} style={styles.card}>
            <Text style={styles.cardTitle}>{j.projectName}</Text>
            {(j.ownerAgency || j.location) && (
              <Text style={styles.cardSub}>
                {j.ownerAgency ?? ''}
                {j.ownerAgency && j.location ? ' · ' : ''}
                {j.location ?? ''}
              </Text>
            )}
            <View style={styles.row}>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: tone.border,
                  backgroundColor: tone.bg,
                  marginRight: 6,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: tone.text }}>
                  {j.status.replace(/_/g, ' ')}
                </Text>
              </View>
              {due && (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: dueTone.border,
                    backgroundColor: dueTone.bg,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: dueTone.text }}>
                    {due.label}
                  </Text>
                </View>
              )}
            </View>
            {j.engineersEstimateCents != null && (
              <Text style={styles.engineersEst}>
                Engineer's estimate: {formatMoney(j.engineersEstimateCents)}
              </Text>
            )}
          </Pressable>
        );
      })}

      {!loading && !error && active.length === 0 && (
        <View style={[styles.card, { borderColor: '#e5e7eb' }]}>
          <Text style={{ color: '#475569', fontSize: 14 }}>
            No active jobs. Create one in the web app.
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
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  cardSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  engineersEst: { fontSize: 12, color: '#475569', marginTop: 8 },
  offlineBanner: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    marginBottom: 12,
  },
  offlineText: { color: '#92400e', fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
