import AsyncStorage from '@react-native-async-storage/async-storage';
import { readApiBaseUrl } from './api-base';

// Caches the resolved base URL for the duration of a session so we
// don't hit AsyncStorage on every fetch. The Me screen calls
// invalidateApiBaseUrlCache() when the user changes envs.
let cachedBase: string | null = null;

export async function getApiBaseUrl(): Promise<string> {
  if (cachedBase) return cachedBase;
  cachedBase = await readApiBaseUrl();
  return cachedBase;
}

export function invalidateApiBaseUrlCache() {
  cachedBase = null;
}

// Synchronous fallback for components that need an immediate value
// without await. Returns the cached value if available; otherwise
// the dev preset.
export function apiBaseUrl(): string {
  return cachedBase ?? 'http://localhost:4000';
}

async function authHeader(): Promise<Record<string, string>> {
  try {
    const t = await AsyncStorage.getItem('yge.mobile.authToken');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

export async function getJson<T>(pathname: string): Promise<T> {
  const base = await getApiBaseUrl();
  const headers = { Accept: 'application/json', ...(await authHeader()) };
  const res = await fetch(`${base}${pathname}`, { headers });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${pathname}`);
  }
  return (await res.json()) as T;
}

export async function postJson<T>(pathname: string, body: unknown): Promise<T> {
  const base = await getApiBaseUrl();
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(await authHeader()),
  };
  const res = await fetch(`${base}${pathname}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || pathname}`);
  }
  return (await res.json()) as T;
}
