import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { EstimatesStackParamList } from '../../App';
import { getJson } from '../lib/api';
import { cacheGet, cacheSet } from '../lib/cache';
import { ErrorCard } from '../components/error-card';

interface EstimateLite {
  id: string;
  projectName: string;
  ownerAgency?: string;
  bidDueDate?: string;
  bidTotalCents?: number;
  unpricedLineCount?: number;
  unacknowledgedAddendumCount?: number;
  bidStatus?: 'pursuing' | 'submitted' | 'awarded' | 'lost';
  bidSubmittedAt?: string;
  reviewedLineCount?: number;
  bidItemCount?: number;
  updatedAt: string;
}

const STATUS_TONE = {
  pursuing: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
  submitted: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
  awarded: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
  lost: { bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280' },
} as const;

function formatMoney(cents: number): string {
  const dollars = Math.round(cents / 100);
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function bidDueDays(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / (24 * 60 * 60 * 1000));
}

type Nav = NativeStackNavigationProp<EstimatesStackParamList, 'EstimatesList'>;
export default function EstimatesScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimates, setEstimates] = useState<EstimateLite[]>([]);
  const [staleAgeMs, setStaleAgeMs] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  async function load() {
    setError(null);
    try {
      const json = await getJson<{ estimates: EstimateLite[] }>(
        '/api/priced-estimates',
      );
      setEstimates(json.estimates ?? []);
      setStaleAgeMs(null);
      await cacheSet('cache.estimatesList', json.estimates ?? []);
    } catch (err) {
      const cached = await cacheGet<EstimateLite[]>('cache.estimatesList');
      if (cached) {
        setEstimates(cached.value);
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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...estimates].sort((a, b) => {
      const ka = a.bidDueDate ? new Date(a.bidDueDate).getTime() : Number.POSITIVE_INFINITY;
      const kb = b.bidDueDate ? new Date(b.bidDueDate).getTime() : Number.POSITIVE_INFINITY;
      return ka - kb;
    });
    if (!needle) return sorted;
    return sorted.filter((e) =>
      `${e.projectName} ${e.ownerAgency ?? ''}`.toLowerCase().includes(needle),
    );
  }, [estimates, query]);

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
      <Text style={styles.h1}>Estimates</Text>
      <Text style={styles.sub}>{estimates.length} total · sorted by bid-due urgency</Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Filter by project or agency…"
        style={styles.search}
        autoCorrect={false}
        autoCapitalize="none"
      />

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

      {filtered.map((e) => {
        const status = e.bidStatus ?? 'pursuing';
        const tone = STATUS_TONE[status];
        const days = bidDueDays(e.bidDueDate);
        const issues = (e.unpricedLineCount ?? 0) + (e.unacknowledgedAddendumCount ?? 0);
        const ready = issues === 0;
        return (
          <Pressable key={e.id} onPress={() => navigation.navigate('EstimateDetail', { id: e.id })} style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {e.projectName}
              </Text>
              {typeof e.bidTotalCents === 'number' && (
                <Text style={styles.money}>{formatMoney(e.bidTotalCents)}</Text>
              )}
            </View>
            {e.ownerAgency && <Text style={styles.cardSub}>{e.ownerAgency}</Text>}
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
                  {status}
                </Text>
              </View>
              {status !== 'awarded' && status !== 'lost' && (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: ready ? '#a7f3d0' : '#fecaca',
                    backgroundColor: ready ? '#ecfdf5' : '#fef2f2',
                    marginRight: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: ready ? '#065f46' : '#991b1b',
                    }}
                  >
                    {ready ? '✓ Ready' : `✗ ${issues} issue${issues === 1 ? '' : 's'}`}
                  </Text>
                </View>
              )}
              {days != null && (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: days < 0 ? '#fecaca' : days <= 7 ? '#fde68a' : '#a7f3d0',
                    backgroundColor: days < 0 ? '#fef2f2' : days <= 7 ? '#fffbeb' : '#ecfdf5',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: days < 0 ? '#991b1b' : days <= 7 ? '#92400e' : '#065f46',
                    }}
                  >
                    {days < 0
                      ? `${Math.abs(days)}d overdue`
                      : days === 0
                        ? 'Due today'
                        : `Due in ${days}d`}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}

      {!loading && !error && filtered.length === 0 && (
        <View style={[styles.card, { borderColor: '#e5e7eb' }]}>
          <Text style={{ color: '#475569', fontSize: 14 }}>
            {query ? 'No matches.' : 'No estimates yet.'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: '#0a3a6b' },
  sub: { fontSize: 13, color: '#475569', marginTop: 4, marginBottom: 12 },
  search: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    fontSize: 14,
    marginBottom: 12,
  },
  card: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  money: { fontFamily: 'Courier', fontSize: 14, fontWeight: '700', color: '#0a3a6b', marginLeft: 8 },
  cardSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
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
