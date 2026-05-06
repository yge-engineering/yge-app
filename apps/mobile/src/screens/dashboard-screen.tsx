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
import { useTranslator } from '../lib/use-translator';

interface EstimateLite {
  id: string;
  jobId: string;
  projectName: string;
  bidDueDate?: string;
  bidTotalCents?: number;
  unpricedLineCount?: number;
  bidStatus?: 'pursuing' | 'submitted' | 'awarded' | 'lost';
  updatedAt: string;
}

function formatMoney(cents: number): string {
  const dollars = Math.round(cents / 100);
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function DashboardScreen() {
  const { t } = useTranslator();
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [estimates, setEstimates] = useState<EstimateLite[]>([]);

  async function load() {
    setError(null);
    try {
      const json = await getJson<{ estimates: EstimateLite[] }>(
        '/api/priced-estimates',
      );
      setEstimates(json.estimates ?? []);
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

  const totalCents = estimates.reduce(
    (sum, e) => sum + (e.bidTotalCents ?? 0),
    0,
  );
  const pursuing = estimates.filter(
    (e) => (e.bidStatus ?? 'pursuing') === 'pursuing',
  ).length;
  const submitted = estimates.filter((e) => e.bidStatus === 'submitted').length;
  const awarded = estimates.filter((e) => e.bidStatus === 'awarded').length;
  const lost = estimates.filter((e) => e.bidStatus === 'lost').length;
  const decided = awarded + lost;
  const winRate = decided > 0 ? Math.round((awarded / decided) * 100) : null;

  const active = estimates
    .filter((e) => {
      const s = e.bidStatus ?? 'pursuing';
      return s === 'pursuing' || s === 'submitted';
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

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
      <Text style={styles.h1}>{t('app.title')}</Text>
      <Text style={styles.tagline}>{t('app.tagline')}</Text>

      {loading && !refreshing && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#0a3a6b" />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      )}

      {error && <ErrorCard message={error} onRetry={() => { setLoading(true); void load(); }} />}

      {!loading && estimates.length > 0 && (
        <>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderColor: '#bfdbfe' }]}>
              <Text style={styles.statLabel}>Bid pipeline</Text>
              <Text style={styles.statValue}>{formatMoney(totalCents)}</Text>
              <Text style={styles.statSub}>
                {estimates.length} estimate{estimates.length === 1 ? '' : 's'}
              </Text>
            </View>
            {winRate != null && (
              <View style={[styles.statCard, { borderColor: '#bbf7d0' }]}>
                <Text style={styles.statLabel}>Win rate</Text>
                <Text style={styles.statValue}>{winRate}%</Text>
                <Text style={styles.statSub}>
                  {awarded} of {decided}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.row}>
            <Pill label={`${pursuing} pursuing`} tone="amber" />
            <Pill label={`${submitted} submitted`} tone="blue" />
            {awarded > 0 && <Pill label={`${awarded} awarded`} tone="green" />}
            {lost > 0 && <Pill label={`${lost} lost`} tone="gray" />}
          </View>

          <Text style={styles.sectionTitle}>Active bids</Text>
          {active.map((e) => (
            <View key={e.id} style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{e.projectName}</Text>
                <Text style={styles.listSub}>
                  {e.bidStatus === 'submitted' ? '✓ submitted' : ''}
                  {(e.unpricedLineCount ?? 0) > 0 && ` · ${e.unpricedLineCount} unpriced`}
                  {' · '}
                  {relativeTime(e.updatedAt)}
                </Text>
              </View>
              {typeof e.bidTotalCents === 'number' && (
                <Text style={styles.listMoney}>{formatMoney(e.bidTotalCents)}</Text>
              )}
            </View>
          ))}
        </>
      )}

      {!loading && !error && estimates.length === 0 && (
        <View style={[styles.card, { borderColor: '#e5e7eb' }]}>
          <Text style={{ color: '#475569', fontSize: 14 }}>
            No estimates yet. Start one in the web app or your office machine.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function Pill({ label, tone }: { label: string; tone: 'amber' | 'blue' | 'green' | 'gray' }) {
  const tones = {
    amber: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
    blue: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    green: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
    gray: { bg: '#f3f4f6', border: '#d1d5db', text: '#374151' },
  } as const;
  const c = tones[tone];
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bg,
        marginRight: 6,
        marginBottom: 6,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '600', color: c.text }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: '#0a3a6b' },
  tagline: { fontSize: 14, color: '#475569', marginTop: 4, marginBottom: 16 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  loadingText: { marginLeft: 8, color: '#64748b' },
  card: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#0a3a6b', marginTop: 4 },
  statSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginTop: 8, marginBottom: 8 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  listTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  listSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  listMoney: { fontSize: 14, fontFamily: 'Courier', color: '#0f172a', marginLeft: 8 },
});
