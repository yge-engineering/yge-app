// Lightweight fetch wrapper with the configured API base URL.

import Constants from 'expo-constants';

export function apiBaseUrl(): string {
  const extra = (Constants.expoConfig as { extra?: { apiUrl?: string } } | null)?.extra;
  return typeof extra?.apiUrl === 'string' ? extra.apiUrl : 'http://localhost:4000';
}

export async function getJson<T>(pathname: string): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${pathname}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${pathname}`);
  }
  return (await res.json()) as T;
}
