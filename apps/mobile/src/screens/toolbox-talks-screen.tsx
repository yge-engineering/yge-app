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

type ToolboxTalkStatus = 'DRAFT' | 'HELD' | 'SUBMITTED';

interface ToolboxTalkRow {
  id: string;
  heldOn: string;
  topic: string;
  leaderName: string;
  location?: string;
  status: ToolboxTalkStatus;
}

function statusTone(status: ToolboxTalkStatus): { border: string; bg: string; text: string } {
  switch (status) {
    case 'SUBMITTED':
      return { border: '#a7f3d0', bg: '#ecfdf5', text: '#065f46' };
    case 'HELD':
      return { border: '#bfdbfe', bg: '#eff6ff', text: '#1e40af' };
    default:
      return { border: '#fcd34d', bg: '#fffbeb', text: '#92400e' };
  }
}

export default function ToolboxTalksScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [talks, setTalks] = useState<ToolboxTalkRow[]>([]);

  async function load() {
    setError(null);
    try {
      const json = await getJson<{ talks: ToolboxTalkRow[] }>('/api/toolbox-talks');
      setTalks(json.talks ?? []);
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
      <Text style={styles.h1}>Safety Meetings</Text>
      <Text style={styles.sub}>{talks.length} toolbox talks · newest first</Text>

      {loading && !refreshing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
          <ActivityIndicator size="small" color="#0a3a6b" />
          <Text style={{ marginLeft: 8, color: '#64748b' }}>Loading…</Text>
        </View>
      )}

      {error && <ErrorCard message={error} onRetry={() => { setLoading(true); void load(); }} />}

      {talks.map((t) => {
        const tone = statusTone(t.status);
        return (
          <View key={t.id} style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {t.topic}
              </Text>
              <View style={[styles.pill, { borderColor: tone.border, backgroundColor: tone.bg }]}>
                <Text style={[styles.pillText, { color: tone.text }]}>{t.status}</Text>
              </View>
            </View>
            <Text style={styles.cardSub}>
              {new Date(t.heldOn).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
              {' · '}Led by {t.leaderName}
            </Text>
            {t.location ? <Text style={styles.cardSub}>📍 {t.location}</Text> : null}
          </View>
        );
      })}

      {!loading && !error && talks.length === 0 && (
        <View style={[styles.card, { borderStyle: 'dashed' }]}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>
            No safety meetings logged yet. Foremen record toolbox talks from the field.
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  cardSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
