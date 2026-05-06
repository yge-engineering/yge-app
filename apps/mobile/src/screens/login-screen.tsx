import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { postJson } from '../lib/api';
import { writeAuth } from '../lib/auth-store';

interface Props {
  onSignedIn: () => void;
}

interface SignInResponse {
  token: string;
  user: { email: string; name?: string };
}

export default function LoginScreen({ onSignedIn }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const json = await postJson<SignInResponse>('/api/login', {
        email: email.trim(),
        password,
      });
      await writeAuth(json.token, json.user);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0a3a6b' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.shell}>
        <Text style={styles.brand}>YGE</Text>
        <Text style={styles.tagline}>Young General Engineering</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="ryoung@youngge.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />

          {error && <Text style={styles.errorText}>⚠ {error}</Text>}

          <Pressable
            onPress={() => void submit()}
            disabled={busy || !email || !password}
            style={[
              styles.submit,
              (busy || !email || !password) && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.submitText}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Need a passkey? Set one up on the web app first.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  brand: {
    fontSize: 56,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  label: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#f8fafc',
  },
  errorText: {
    marginTop: 12,
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '600',
  },
  submit: {
    marginTop: 20,
    backgroundColor: '#0a3a6b',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  footer: {
    marginTop: 24,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
  },
});
