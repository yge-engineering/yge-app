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

type WeatherImpact = 'NONE' | 'PARTIAL' | 'STOPPED';

interface WeatherRow {
  id: string;
  observedOn: string;
  location?: string;
  highF?: number;
  lowF?: number;
  precipHundredthsInch?: number;
  windMph?: number;
  gustMph?: number;
  primaryCondition: string;
  impact: WeatherImpact;
  lostHours: number;
  heatProceduresActivated?: boolean;
  highHeatProceduresActivated?: boolean;
}

function impactTone(impact: WeatherImpact): { border: string; bg: string; text: string } {
  switch (impact) {
    case 'STOPPED':
      return { border: '#fecaca', bg: '#fef2f2', text: '#991b1b' };
    case 'PARTIAL':
      return { border: '#fcd34d', bg: '#fffbeb', text: '#92400e' };
    default:
      return { border: '#a7f3d0', bg: '#ecfdf5', text: '#065f46' };
  }
}

function conditionLine(w: WeatherRow): string {
  const parts: string[] = [w.primaryCondition.replace(/_/g, ' ')];
  if (typeof w.highF === 'number' || typeof w.lowF === 'number') {
    const hi = typeof w.highF === 'number' ? `${w.highF}°` : '–';
    const lo = typeof w.lowF === 'number' ? `${w.lowF}°` : '–';
    parts.push(`${hi}/${lo}F`);
  }
  if (typeof w.precipHundredthsInch === 'number' && w.precipHundredthsInch > 0) {
    parts.push(`${(w.precipHundredthsInch / 100).toFixed(2)}" rain`);
  }
  if (typeof w.windMph === 'number' && w.windMph > 0) {
    const gust = typeof w.gustMph === 'number' && w.gustMph > 0 ? ` (gust ${w.gustMph})` : '';
    parts.push(`wind ${w.windMph}${gust} mph`);
  }
  return parts.join(' · ');
}

export default function WeatherLogsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<WeatherRow[]>([]);

  async function load() {
    setError(null);
    try {
      const json = await getJson<{ logs: WeatherRow[] }>('/api/weather-logs');
      setLogs(json.logs ?? []);
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

  const totalLost = logs.reduce((acc, w) => acc + (w.lostHours ?? 0), 0);

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
      <Text style={styles.h1}>Weather</Text>
      <Text style={styles.sub}>{logs.length} logs · {totalLost} hrs lost to weather</Text>

      {loading && !refreshing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
          <ActivityIndicator size="small" color="#0a3a6b" />
          <Text style={{ marginLeft: 8, color: '#64748b' }}>Loading…</Text>
        </View>
      )}

      {error && <ErrorCard message={error} onRetry={() => { setLoading(true); void load(); }} />}

      {logs.map((w) => {
        const tone = impactTone(w.impact);
        const heat = w.highHeatProceduresActivated
          ? '🔥 High-heat procedures'
          : w.heatProceduresActivated
            ? '🌡 Heat procedures'
            : null;
        return (
          <View key={w.id} style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>{w.observedOn}</Text>
              <View style={[styles.pill, { borderColor: tone.border, backgroundColor: tone.bg }]}>
                <Text style={[styles.pillText, { color: tone.text }]}>{w.impact}</Text>
              </View>
            </View>
            <Text style={styles.meta}>{conditionLine(w)}</Text>
            {w.lostHours > 0 ? <Text style={styles.lost}>{w.lostHours} hrs lost</Text> : null}
            {heat ? <Text style={styles.heat}>{heat}</Text> : null}
          </View>
        );
      })}

      {!loading && !error && logs.length === 0 && (
        <View style={[styles.card, { borderStyle: 'dashed' }]}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>No weather logged yet.</Text>
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
  meta: { fontSize: 13, color: '#475569', marginTop: 4 },
  lost: { fontSize: 12, color: '#92400e', fontWeight: '700', marginTop: 6 },
  heat: { fontSize: 12, color: '#991b1b', fontWeight: '700', marginTop: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
