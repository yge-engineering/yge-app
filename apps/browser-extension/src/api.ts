// Thin client for /api/master-profile.
//
// Reads the YGE API base URL from chrome.storage (defaults to
// http://localhost:4000) and fetches the master profile. The
// response shape matches the Zod schema in @yge/shared, but we
// keep the import light here — a structural type matches enough
// of the surface for the field matcher.

import type { MasterProfile } from '@yge/shared';

const DEFAULT_API_BASE = 'http://localhost:4000';

export async function getApiBase(): Promise<string> {
  const { ygeApiBase } = await chrome.storage.local.get('ygeApiBase');
  return typeof ygeApiBase === 'string' && ygeApiBase.length > 0
    ? ygeApiBase
    : DEFAULT_API_BASE;
}

export async function setApiBase(url: string): Promise<void> {
  await chrome.storage.local.set({ ygeApiBase: url });
}

export async function fetchMasterProfile(): Promise<MasterProfile | null> {
  const base = await getApiBase();
  try {
    const res = await fetch(`${base}/api/master-profile`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as { profile: MasterProfile };
    return json.profile;
  } catch {
    return null;
  }
}
