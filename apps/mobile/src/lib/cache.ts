// Simple key → value cache with timestamp, backed by AsyncStorage.

import AsyncStorage from '@react-native-async-storage/async-storage';

interface Entry<T> {
  v: T;
  t: number; // unix-ms when cached
}

export async function cacheGet<T>(key: string): Promise<{ value: T; ageMs: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    if (typeof parsed?.t !== 'number') return null;
    return { value: parsed.v, ageMs: Date.now() - parsed.t };
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  try {
    const entry: Entry<T> = { v: value, t: Date.now() };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {}
}
