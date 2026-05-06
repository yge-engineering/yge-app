import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getJson, patchJson } from '../lib/api';
import { NotesEditorModal } from '../components/notes-editor-modal';

type BidStatus = 'pursuing' | 'submitted' | 'awarded' | 'lost';

interface PricedEstimateLite {
  id: string;
  projectName: string;
  ownerAgency?: string;
  bidStatus?: BidStatus;
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

const STATUS_TONE: Record<BidStatus, { bg: string; border: string; text: string }> = {
  pursuing: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
  submitted: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
  awarded: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
  lost: { bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280' },
};

const STATUS_OPTIONS: BidStatus[] = ['pursuing', 'submitted', 'awarded', 'lost'];

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
  const [savingStatus, setSavingStatus] = useState<BidStatus | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [lineQuery, setLineQuery] = useState('');

  async function load() {
    try {
      const json = await getJson<DetailResponse>(`/api/priced-estimates/${encodeURIComponent(id)}`);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function flipStatus(next: BidStatus) {
    if (!data) return;
    if (next === (data.estimate.bidStatus ?? 'pursuing')) return;

    if (next === 'awarded') {
      const ok = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Mark as Awarded?',
          'This will also flip the linked job to AWARDED.',
          [
            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Confirm', onPress: () => resolve(true) },
          ],
        );
      });
      if (!ok) return;
    }

    setSavingStatus(next);
    try {
      await patchJson(`/api/priced-estimates/${encodeURIComponent(id)}`, {
        bidStatus: next,
      });
      await load();
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSavingStatus(null);
    }
  }

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
  const status = e.bidStatus ?? 'pursuing';
  const unpriced = e.bidItems.filter((i) => i.unitPriceCents == null).length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      <Text style={styles.h1}>{e.projectName}</Text>
      {e.ownerAgency && <Text style={styles.sub}>{e.ownerAgency}</Text>}

      <Pressable
        onPress={async () => {
          await Clipboard.setStringAsync(formatMoney(totals.bidTotalCents));
          Alert.alert('Copied', formatMoney(totals.bidTotalCents) + ' copied to clipboard.');
        }}
        style={[styles.card, { backgroundColor: '#0a3a6b', borderColor: '#0a3a6b' }]}
      >
        <Text style={[styles.label, { color: '#cbd5e1' }]}>Bid total · tap to copy</Text>
        <Text style={[styles.value, { color: '#ffffff', fontSize: 28 }]}>
          {formatMoney(totals.bidTotalCents)}
        </Text>
        <Text style={[styles.sub, { color: '#cbd5e1', marginTop: 4 }]}>
          Direct {formatMoney(totals.directCents)} · O&P {formatMoney(totals.oppCents)}
        </Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.label}>Status</Text>
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map((opt) => {
            const active = opt === status;
            const isSaving = savingStatus === opt;
            const tone = STATUS_TONE[opt];
            return (
              <Pressable
                key={opt}
                onPress={() => void flipStatus(opt)}
                disabled={savingStatus != null}
                style={[
                  styles.statusChip,
                  active && { backgroundColor: tone.bg, borderColor: tone.border },
                  savingStatus != null && { opacity: 0.6 },
                ]}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    active && { color: tone.text, fontWeight: '700' },
                  ]}
                >
                  {isSaving ? '…' : opt}
                </Text>
              </Pressable>
            );
          })}
        </View>
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

      <Pressable onPress={() => setNotesOpen(true)} style={styles.card}>
        <Text style={styles.label}>Notes (tap to edit)</Text>
        {e.notes ? (
          <Text style={styles.notes}>{e.notes}</Text>
        ) : (
          <Text style={[styles.notes, { color: '#94a3b8', fontStyle: 'italic' }]}>
            No notes yet — tap to add.
          </Text>
        )}
      </Pressable>

      <NotesEditorModal
        visible={notesOpen}
        initial={e.notes ?? ''}
        onCancel={() => setNotesOpen(false)}
        onSave={async (next) => {
          await patchJson(`/api/priced-estimates/${encodeURIComponent(id)}`, {
            notes: next,
          });
          await load();
        }}
      />

      <Text style={[styles.h2, { marginTop: 16 }]}>Bid items ({e.bidItems.length})</Text>

      <TextInput
        value={lineQuery}
        onChangeText={setLineQuery}
        placeholder="Filter line items…"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.lineSearch}
      />

      {(() => {
        const needle = lineQuery.trim().toLowerCase();
        const filtered = needle
          ? e.bidItems.filter(
              (item) =>
                item.description.toLowerCase().includes(needle) ||
                item.itemNumber.toLowerCase().includes(needle),
            )
          : e.bidItems;
        const display = filtered.slice(0, 50);
        return (
          <>
            {display.map((item, idx) => (
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
            {filtered.length === 0 && needle && (
              <Text style={styles.note}>No matches for "{lineQuery}".</Text>
            )}
            {filtered.length > 50 && (
              <Text style={styles.note}>
                … {filtered.length - 50} more line{filtered.length - 50 === 1 ? '' : 's'} hidden. Refine the filter to see them.
              </Text>
            )}
          </>
        );
      })()}
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
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  statusChipText: { fontSize: 12, color: '#475569', textTransform: 'capitalize' },
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
  lineSearch: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    fontSize: 14,
    marginBottom: 8,
  },
});
