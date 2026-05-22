import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getJson } from '../lib/api';

interface InvoiceLite {
  totalCents?: number;
  paidCents?: number;
  status: string;
}

// Statuses that still represent money on the table.
const AR_OPEN = ['SENT', 'PARTIALLY_PAID', 'DISPUTED'];
const AP_OPEN = ['PENDING', 'APPROVED'];

function openSum(
  invoices: InvoiceLite[],
  openStatuses: string[],
): { cents: number; count: number } {
  let cents = 0;
  let count = 0;
  for (const inv of invoices) {
    if (!openStatuses.includes(inv.status)) continue;
    const bal = (inv.totalCents ?? 0) - (inv.paidCents ?? 0);
    if (bal > 0) {
      cents += bal;
      count += 1;
    }
  }
  return { cents, count };
}

function money(cents: number): string {
  return Math.round(cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

interface Position {
  ar: { cents: number; count: number };
  ap: { cents: number; count: number };
}

export function MoneyPosition() {
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [arBody, apBody] = await Promise.all([
          getJson<{ invoices: InvoiceLite[] }>('/api/ar-invoices'),
          getJson<{ invoices: InvoiceLite[] }>('/api/ap-invoices'),
        ]);
        setPosition({
          ar: openSum(arBody.invoices ?? [], AR_OPEN),
          ap: openSum(apBody.invoices ?? [], AP_OPEN),
        });
      } catch {
        // Non-fatal: the section simply stays hidden if finances can't load.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color="#0a3a6b" />
        <Text style={styles.loadingText}>Loading money…</Text>
      </View>
    );
  }
  if (!position) return null;

  return (
    <>
      <Text style={styles.sectionTitle}>Money position</Text>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: '#bbf7d0' }]}>
          <Text style={styles.statLabel}>AR outstanding</Text>
          <Text style={styles.statValue}>{money(position.ar.cents)}</Text>
          <Text style={styles.statSub}>
            {position.ar.count} open invoice{position.ar.count === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={[styles.statCard, { borderColor: '#fecaca' }]}>
          <Text style={styles.statLabel}>AP due</Text>
          <Text style={styles.statValue}>{money(position.ap.cents)}</Text>
          <Text style={styles.statSub}>
            {position.ap.count} open bill{position.ap.count === 1 ? '' : 's'}
          </Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  loadingRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  loadingText: { marginLeft: 8, color: '#64748b' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginTop: 8, marginBottom: 8 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, backgroundColor: '#ffffff' },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#0a3a6b', marginTop: 4 },
  statSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
});
