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
import { getJson, patchJson } from '../lib/api';
import { NotesEditorModal } from '../components/notes-editor-modal';

interface JobDetail {
  id: string;
  projectName: string;
  ownerAgency?: string;
  location?: string;
  status: string;
  bidDueDate?: string;
  engineersEstimateCents?: number;
  notes?: string;
  contractType?: string;
  projectType: string;
  updatedAt: string;
  createdAt: string;
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export default function JobDetailScreen({ route }: { route: { params: { id: string } } }) {
  const id = route.params.id;
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const json = await getJson<{ job: JobDetail }>(`/api/jobs/${encodeURIComponent(id)}`);
      setJob(json.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#0a3a6b" />
      </View>
    );
  }
  if (error || !job) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: 16 }}>
        <Text style={{ color: '#991b1b', fontSize: 14 }}>⚠ {error ?? 'Not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
      contentContainerStyle={{ padding: 16, maxWidth: 720, width: '100%', alignSelf: 'center' }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
        />
      }
    >
      <Text style={styles.h1}>{job.projectName}</Text>
      <Text style={styles.sub}>
        {job.contractType ?? ''}
        {job.contractType ? ' · ' : ''}
        {job.projectType.replace(/_/g, ' ')}
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>{job.status.replace(/_/g, ' ')}</Text>
      </View>

      {(job.ownerAgency || job.location) && (
        <View style={styles.card}>
          {job.ownerAgency && (
            <>
              <Text style={styles.label}>Owner agency</Text>
              <Text style={styles.value}>{job.ownerAgency}</Text>
            </>
          )}
          {job.location && (
            <>
              <Text style={[styles.label, { marginTop: job.ownerAgency ? 8 : 0 }]}>Location</Text>
              <Text style={styles.value}>{job.location}</Text>
            </>
          )}
        </View>
      )}

      {job.bidDueDate && (
        <View style={styles.card}>
          <Text style={styles.label}>Bid due</Text>
          <Text style={styles.value}>{new Date(job.bidDueDate).toLocaleDateString()}</Text>
        </View>
      )}

      {job.engineersEstimateCents != null && (
        <View style={styles.card}>
          <Text style={styles.label}>Engineer's estimate</Text>
          <Text style={styles.value}>{formatMoney(job.engineersEstimateCents)}</Text>
        </View>
      )}

      <Pressable onPress={() => setNotesOpen(true)} style={styles.card}>
        <Text style={styles.label}>Pursuit notes (tap to edit)</Text>
        {job.notes ? (
          <Text style={styles.notes}>{job.notes}</Text>
        ) : (
          <Text style={[styles.notes, { color: '#94a3b8', fontStyle: 'italic' }]}>
            No notes yet — tap to add.
          </Text>
        )}
      </Pressable>

      <NotesEditorModal
        visible={notesOpen}
        initial={job.notes ?? ''}
        onCancel={() => setNotesOpen(false)}
        onSave={async (next) => {
          await patchJson(`/api/jobs/${encodeURIComponent(id)}`, { notes: next });
          await load();
        }}
      />

      <View style={styles.card}>
        <Text style={styles.label}>Job ID</Text>
        <Text style={styles.mono}>{job.id}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', color: '#0a3a6b' },
  sub: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 16,
  },
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
  value: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  notes: { fontSize: 14, color: '#334155', lineHeight: 20 },
  mono: { fontFamily: 'Courier', fontSize: 12, color: '#475569' },
});
