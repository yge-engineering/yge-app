// Configurable API base URL. Reads from AsyncStorage; falls back to
// expo-constants 'apiUrl' extra; final fallback localhost:4000.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const KEY = 'yge.mobile.apiBaseUrl';

export const PRESET_URLS = {
  dev: 'http://localhost:4000',
  prod: 'https://api.youngge.com',
} as const;

export type ApiPreset = keyof typeof PRESET_URLS;

export async function readApiBaseUrl(): Promise<string> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v && (v.startsWith('http://') || v.startsWith('https://'))) {
      return v;
    }
  } catch {}
  const extra = (Constants.expoConfig as { extra?: { apiUrl?: string } } | null)?.extra;
  if (typeof extra?.apiUrl === 'string') return extra.apiUrl;
  return PRESET_URLS.dev;
}

export async function writeApiBaseUrl(url: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, url);
  } catch {}
}
