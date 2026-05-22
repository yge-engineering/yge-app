import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getJson, postJson, uploadPhotoBytes } from '../lib/api';
import { ErrorCard } from '../components/error-card';

interface JobOption {
  id: string;
  projectName: string;
}

export default function PhotoCaptureScreen() {
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('Job site');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const json = await getJson<{ jobs: JobOption[] }>('/api/jobs');
        setJobs(json.jobs ?? []);
      } catch {
        // Non-fatal: the user can still see the picker is empty.
      }
    })();
  }, []);

  async function pickFrom(source: 'camera' | 'library') {
    setError(null);
    setDoneMsg(null);
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(`${source === 'camera' ? 'Camera' : 'Photo library'} permission denied.`);
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const picked = result.assets[0];
      if (picked) setAsset(picked);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the picker');
    }
  }

  async function upload() {
    if (!asset) {
      setError('Take or choose a photo first.');
      return;
    }
    if (!jobId) {
      setError('Choose a job.');
      return;
    }
    const cap = caption.trim();
    const loc = location.trim();
    if (!cap) {
      setError('Add a caption.');
      return;
    }
    if (!loc) {
      setError('Add a location.');
      return;
    }
    setUploading(true);
    setError(null);
    setDoneMsg(null);
    try {
      const up = await uploadPhotoBytes({
        uri: asset.uri,
        name: asset.fileName ?? `photo-${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      });
      const today = new Date().toISOString().slice(0, 10);
      await postJson('/api/photos', {
        jobId,
        takenOn: today,
        location: loc,
        caption: cap,
        reference: up.reference,
      });
      setDoneMsg('Photo uploaded and attached to the job.');
      setAsset(null);
      setCaption('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
      contentContainerStyle={{ padding: 16, maxWidth: 720, width: '100%', alignSelf: 'center' }}
    >
      <Text style={styles.h1}>Add Photo</Text>
      <Text style={styles.sub}>Snap a job-site photo and attach it to the job record.</Text>

      <View style={styles.row}>
        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => void pickFrom('camera')}>
          <Text style={styles.btnPrimaryText}>📷 Take photo</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => void pickFrom('library')}>
          <Text style={styles.btnSecondaryText}>🖼 Choose</Text>
        </Pressable>
      </View>

      {asset ? (
        <Image source={{ uri: asset.uri }} style={styles.preview} resizeMode="cover" />
      ) : (
        <View style={[styles.preview, styles.previewEmpty]}>
          <Text style={{ color: '#94a3b8' }}>No photo selected</Text>
        </View>
      )}

      <Text style={styles.label}>Caption</Text>
      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="e.g. Subgrade compaction at Sta. 12+50"
        style={styles.input}
      />

      <Text style={styles.label}>Location</Text>
      <TextInput value={location} onChangeText={setLocation} placeholder="Job site" style={styles.input} />

      <Text style={styles.label}>Job</Text>
      <View style={styles.chips}>
        {jobs.map((j) => {
          const selected = j.id === jobId;
          return (
            <Pressable
              key={j.id}
              onPress={() => setJobId(j.id)}
              style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
            >
              <Text style={[styles.chipText, { color: selected ? '#ffffff' : '#1e40af' }]} numberOfLines={1}>
                {j.projectName}
              </Text>
            </Pressable>
          );
        })}
        {jobs.length === 0 && <Text style={{ color: '#94a3b8', fontSize: 13 }}>No jobs loaded.</Text>}
      </View>

      {error && <ErrorCard message={error} />}
      {doneMsg && (
        <View style={styles.doneCard}>
          <Text style={{ color: '#065f46', fontWeight: '700' }}>{doneMsg}</Text>
        </View>
      )}

      <Pressable
        style={[styles.btn, styles.uploadBtn, uploading ? { opacity: 0.6 } : null]}
        disabled={uploading}
        onPress={() => void upload()}
      >
        {uploading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#ffffff" />
            <Text style={[styles.btnPrimaryText, { marginLeft: 8 }]}>Uploading…</Text>
          </View>
        ) : (
          <Text style={styles.btnPrimaryText}>Upload photo</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: '#0a3a6b' },
  sub: { fontSize: 13, color: '#475569', marginTop: 4, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { flex: 1, backgroundColor: '#0a3a6b' },
  btnPrimaryText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  btnSecondary: { flex: 1, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
  btnSecondaryText: { color: '#1e40af', fontWeight: '700', fontSize: 14 },
  preview: { width: '100%', height: 220, borderRadius: 10, marginTop: 14, backgroundColor: '#e2e8f0' },
  previewEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderStyle: 'dashed' },
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 16, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: '#ffffff' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, maxWidth: '100%' },
  chipOn: { backgroundColor: '#0a3a6b' },
  chipOff: { borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
  chipText: { fontSize: 13, fontWeight: '600' },
  uploadBtn: { backgroundColor: '#16a34a', marginTop: 20 },
  doneCard: { marginTop: 14, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' },
});
