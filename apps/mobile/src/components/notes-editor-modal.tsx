import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

interface Props {
  visible: boolean;
  initial: string;
  onCancel: () => void;
  onSave: (next: string) => Promise<void>;
}

export function NotesEditorModal({ visible, initial, onCancel, onSave }: Props) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setText(initial);
      setError(null);
    }
  }, [visible, initial]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave(text);
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>Edit notes</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            textAlignVertical="top"
            autoFocus
            style={styles.input}
            placeholder="Add notes about this bid…"
          />
          {error && <Text style={styles.error}>⚠ {error}</Text>}
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={[styles.button, styles.cancel]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void save()}
              disabled={busy}
              style={[styles.button, styles.save, busy && { opacity: 0.6 }]}
            >
              <Text style={styles.saveText}>{busy ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32,
    minHeight: 320,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    minHeight: 160,
    fontSize: 15,
    backgroundColor: '#f8fafc',
  },
  error: { color: '#991b1b', marginTop: 8, fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancel: { borderWidth: 1, borderColor: '#cbd5e1' },
  cancelText: { color: '#475569', fontWeight: '600' },
  save: { backgroundColor: '#0a3a6b' },
  saveText: { color: '#ffffff', fontWeight: '700' },
});
