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

interface BidResultRow {
  id: string;
  bidOpenedAt: string;
  outcome: 'won' | 'lost' | 'no-bid';
  ygeBidCents?: number;
  winningBidCents?: number;
  jobId?: string;
  notes?: string;
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export default function BidResultsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BidResultRow[]>([]);

  async function load() {
    setError(null);
    try {
      const json = await getJson<{ results: BidResultRow[] }>('/api/bid-results');
      setResults(json.results ?? []);
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

  const won = results.filter((r) => r.outcome === 'won').length;
  const lost = results.filter((r) => r.outcome === 'lost').length;
  const decided = won + lost;
  const winRate = decided > 0 ? Math.round((won / decided) * 100) : null;

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
      <Text style={styles.h1}>Bid Results</Text>
      <Text style={styles.sub}>Lifetime · {results.length} on record</Text>

      {loading && !refreshing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
          <ActivityIndicator size="small" color="#0a3a6b" />
          <Text style={{ marginLeft: 8, color: '#64748b' }}>Loading…</Text>
        </View>
      )}

      {error && <ErrorCard message={error} onRetry={() => { setLoading(true); void load(); }} />}

      {results.length > 0 && (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderColor: '#bbf7d0' }]}>
            <Text style={styles.statLabel}>Won</Text>
            <Text style={[styles.statValue, { color: '#065f46' }]}>{won}</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#d1d5db' }]}>
            <Text style={styles.statLabel}>Lost</Text>
            <Text style={[styles.statValue, { color: '#374151' }]}>{lost}</Text>
          </View>
          {winRate != null && (
            <View style={[styles.statCard, { borderColor: '#bfdbfe' }]}>
              <Text style={styles.statLabel}>Win rate</Text>
              <Text style={[styles.statValue, { color: '#1e40af' }]}>{winRate}%</Text>
            </View>
          )}
        </View>
      )}

      {results.map((r) => (
        <View key={r.id} style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>
              {new Date(r.bidOpenedAt).toLocaleDateString()}
            </Text>
            <View
              style={[
                styles.pill,
                r.outcome === 'won'
                  ? { borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' }
                  : r.outcome === 'lost'
                    ? { borderColor: '#d1d5db', backgroundColor: '#f3f4f6' }
                    : { borderColor: '#fcd34d', backgroundColor: '#fffbeb' },
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  {
                    color:
                      r.outcome === 'won'
                        ? '#065f46'
                        : r.outcome === 'lost'
                          ? '#6b7280'
                          : '#92400e',
                  },
                ]}
              >
                {r.outcome.replace(/-/g, ' ')}
              </Text>
            </View>
          </View>
          {(r.ygeBidCents != null || r.winningBidCents != null) && (
            <View style={styles.amountsRow}>
              {r.ygeBidCents != null && (
                <Text style={styles.amount}>
                  YGE: <Text style={styles.amountValue}>{formatMoney(r.ygeBidCents)}</Text>
                </Text>
              )}
              {r.winningBidCents != null && (
                <Text style={styles.amount}>
                  Winner: <Text style={styles.amountValue}>{formatMoney(r.winningBidCents)}</Text>
                </Text>
              )}
            </View>
          )}
          {r.notes && (
            <Text style={styles.notes} numberOfLines={2}>
              {r.notes}
            </Text>
          )}
        </View>
      ))}

      {!loading && !error && results.length === 0 && (
        <View style={[styles.card, { borderStyle: 'dashed' }]}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>
            No bid results recorded yet.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: '#0a3a6b' },
  sub: { fontSize: 13, color: '#475569', marginTop: 4, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  card: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  amountsRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  amount: { fontSize: 12, color: '#475569' },
  amountValue: { fontFamily: 'Courier', fontWeight: '700', color: '#0f172a' },
  notes: { fontSize: 12, color: '#334155', marginTop: 6, lineHeight: 16 },
});
