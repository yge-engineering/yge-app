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
import type { TodayStackParamList } from '../../App';
import { getJson } from '../lib/api';
import { ErrorCard } from '../components/error-card';

interface DispatchRow {
  id: string;
  scheduledFor: string;
  jobId?: string;
  jobName?: string;
  notes?: string;
  startTime?: string;
  endTime?: string;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Nav = NativeStackNavigationProp<TodayStackParamList, 'TodayHome'>;
export default function TodayScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DispatchRow[]>([]);

  async function load() {
    setError(null);
    try {
      const json = await getJson<{ dispatches: DispatchRow[] }>(
        `/api/dispatches?scheduledFor=${todayIso()}`,
      );
      setItems(json.dispatches ?? []);
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
      <Text style={styles.h1}>Today</Text>
      <Text style={styles.sub}>
        {new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
      </Text>

      {loading && !refreshing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
          <ActivityIndicator size="small" color="#0a3a6b" />
          <Text style={{ marginLeft: 8, color: '#64748b' }}>Loading…</Text>
        </View>
      )}

      {error && <ErrorCard message={error} onRetry={() => { setLoading(true); void load(); }} />}

      <Pressable
        onPress={() => navigation.navigate('DailyReports')}
        style={{
          marginBottom: 12,
          padding: 14,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#bfdbfe',
          backgroundColor: '#eff6ff',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e40af' }}>📋 Daily reports</Text>
          <Text style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>
            View / submit end-of-day reports
          </Text>
        </View>
        <Text style={{ fontSize: 18, color: '#1e40af' }}>→</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('TimeCards')}
        style={{
          marginBottom: 12,
          padding: 14,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#bfdbfe',
          backgroundColor: '#eff6ff',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e40af' }}>🕒 Time cards</Text>
          <Text style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>
            View crew time cards
          </Text>
        </View>
        <Text style={{ fontSize: 18, color: '#1e40af' }}>→</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('Safety')}
        style={{
          marginBottom: 12,
          padding: 14,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#bfdbfe',
          backgroundColor: '#eff6ff',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e40af' }}>🦺 Safety meetings</Text>
          <Text style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>
            View toolbox talks
          </Text>
        </View>
        <Text style={{ fontSize: 18, color: '#1e40af' }}>→</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('PunchList')}
        style={{
          marginBottom: 12,
          padding: 14,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#bfdbfe',
          backgroundColor: '#eff6ff',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e40af' }}>✅ Punch list</Text>
          <Text style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>
            Open items to fix
          </Text>
        </View>
        <Text style={{ fontSize: 18, color: '#1e40af' }}>→</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('ChangeOrders')}
        style={{
          marginBottom: 12,
          padding: 14,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#bfdbfe',
          backgroundColor: '#eff6ff',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e40af' }}>📝 Change orders</Text>
          <Text style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>
            CO status by job
          </Text>
        </View>
        <Text style={{ fontSize: 18, color: '#1e40af' }}>→</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('Rfis')}
        style={{
          marginBottom: 12,
          padding: 14,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#bfdbfe',
          backgroundColor: '#eff6ff',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e40af' }}>❓ RFIs</Text>
          <Text style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>
            Open questions to agencies
          </Text>
        </View>
        <Text style={{ fontSize: 18, color: '#1e40af' }}>→</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('PhotoCapture')}
        style={{
          marginBottom: 12,
          padding: 14,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#bfdbfe',
          backgroundColor: '#eff6ff',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e40af' }}>📸 Add photo</Text>
          <Text style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>
            Snap a job-site photo
          </Text>
        </View>
        <Text style={{ fontSize: 18, color: '#1e40af' }}>→</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('Submittals')}
        style={{
          marginBottom: 12,
          padding: 14,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#bfdbfe',
          backgroundColor: '#eff6ff',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e40af' }}>📐 Submittals</Text>
          <Text style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>
            Shop drawings & product data
          </Text>
        </View>
        <Text style={{ fontSize: 18, color: '#1e40af' }}>→</Text>
      </Pressable>

      {!loading && items.length === 0 && !error && (
        <View style={[styles.card, { borderColor: '#e5e7eb' }]}>
          <Text style={{ color: '#475569', fontSize: 14 }}>
            No dispatches scheduled for today. Pull down to refresh.
          </Text>
        </View>
      )}

      {items.map((d) => (
        <View key={d.id} style={styles.card}>
          {d.jobName && <Text style={styles.cardTitle}>{d.jobName}</Text>}
          {(d.startTime || d.endTime) && (
            <Text style={styles.cardSub}>
              {d.startTime ?? ''}
              {d.startTime && d.endTime ? ' – ' : ''}
              {d.endTime ?? ''}
            </Text>
          )}
          {d.notes && <Text style={styles.notes}>{d.notes}</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: '#0a3a6b' },
  sub: { fontSize: 14, color: '#475569', marginTop: 4, marginBottom: 16 },
  card: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  cardSub: { fontSize: 13, color: '#475569', marginTop: 4 },
  notes: { fontSize: 13, color: '#334155', marginTop: 8, lineHeight: 18 },
});
