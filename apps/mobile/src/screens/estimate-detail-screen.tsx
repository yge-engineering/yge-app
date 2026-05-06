import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getJson } from '../lib/api';

interface PricedEstimateLite {
  id: string;
  projectName: string;
  ownerAgency?: string;
  bidStatus?: string;
  bidDueDate?: string;
  bidSubmittedAt?: string;
  oppPercent: number;
  notes?: string;
  bidItems: Array<{
    itemNumber: string;
    description: string;
    quantity: number;
    unit: string;
    unitPriceCents: number | null;
  }>;
  jobId: string;
}

interface PricedTotals {
  bidTotalCents: number;
  directCents: number;
  oppCents: number;
}

interface DetailResponse {
  estimate: PricedEstimateLite;
  totals: PricedTotals;
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

export default function EstimateDetailScreen({ route }: { route: { params: { id: string } } }) {
  const id = route.params.id;
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const json = await getJson<DetailResponse>(`/api/priced-estimates/${encodeURIComponent(id)}`);
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#0a3a6b" />
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: 16 }}>
        <Text style={{ color: '#991b1b', fontSize: 14 }}>⚠ {error ?? 'Not found'}</Text>
      </View>
    );
  }

  const { estimate: e, totals } = data;
  const unpriced = e.bidItems.filter((i) => i.unitPriceCents == null).length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.h1}>{e.projectName}</Text>
      {e.ownerAgency && <Text style={styles.sub}>{e.ownerAgency}</Text>}

      <View style={[styles.card, { backgroundColor: '#0a3a6b', borderColor: '#0a3a6b' }]}>
        <Text style={[styles.label, { color: '#cbd5e1' }]}>Bid total</Text>
        <Text style={[styles.value, { color: '#ffffff', fontSize: 28 }]}>
          {formatMoney(totals.bidTotalCents)}
        </Text>
        <Text style={[styles.sub, { color: '#cbd5e1', marginTop: 4 }]}>
          Direct {formatMoney(totals.directCents)} · O&P {formatMoney(totals.oppCents)}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>{e.bidStatus ?? 'pursuing'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Lines</Text>
        <Text style={styles.value}>
          {e.bidItems.length} total · {unpriced} unpriced
        </Text>
      </View>

      {e.bidDueDate && (
        <View style={styles.card}>
          <Text style={styles.label}>Bid due</Text>
          <Text style={styles.value}>{new Date(e.bidDueDate).toLocaleDateString()}</Text>
        </View>
      )}

      {e.notes && (
        <View style={styles.card}>
          <Text style={styles.label}>Notes</Text>
          <Text style={styles.notes}>{e.notes}</Text>
        </View>
      )}

      <Text style={[styles.h2, { marginTop: 16 }]}>Bid items</Text>
      {e.bidItems.slice(0, 50).map((item, idx) => (
        <View key={idx} style={styles.lineCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.lineTitle}>
              <Text style={{ color: '#64748b', fontFamily: 'Courier' }}>{item.itemNumber}</Text>{' '}
              {item.description}
            </Text>
            <Text style={styles.lineSub}>
              {item.quantity} {item.unit}
              {item.unitPriceCents != null
                ? ` × ${formatMoney(item.unitPriceCents)}`
                : ' · UNPRICED'}
            </Text>
          </View>
          {item.unitPriceCents != null && (
            <Text style={styles.lineMoney}>
              {formatMoney(Math.round(item.quantity * item.unitPriceCents))}
            </Text>
          )}
        </View>
      ))}
      {e.bidItems.length > 50 && (
        <Text style={styles.note}>… {e.bidItems.length - 50} more lines hidden. Open in web to edit.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', color: '#0a3a6b' },
  h2: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  sub: { fontSize: 13, color: '#64748b', marginTop: 2, marginBottom: 12 },
  card: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  notes: { fontSize: 14, color: '#334155', lineHeight: 20 },
  lineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginBottom: 6,
  },
  lineTitle: { fontSize: 13, color: '#0f172a' },
  lineSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  lineMoney: {
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: '700',
    color: '#0a3a6b',
    marginLeft: 8,
  },
  note: { fontSize: 12, color: '#64748b', fontStyle: 'italic', marginTop: 8 },
});
