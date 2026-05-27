// Shared expiry helpers for the master profile.
//
// Walks a MasterProfile and surfaces every CSLB / DIR /
// insurance record that's expired or due within 60 days. Used
// by the web app (page panel + dashboard tile + bid-day cockpit
// + go-live page) and available to the API/mobile if a future
// caller wants to email Ryan ahead of expiry.
//
// Lives in @yge/shared so the threshold logic + ExpiringItem
// shape have one home. Previously lived in apps/web/src/lib/
// before this move.

import type { MasterProfile } from './master-profile';

export interface ExpiringItem {
  label: string;
  expiresOn: string;
  daysRemaining: number;
  tone: 'expired' | 'critical' | 'warn';
}

/** Days between today (UTC midnight) and the given YYYY-MM-DD
 *  date. Negative when expiresOn is already in the past. */
export function daysUntil(expiresOn: string, now: Date = new Date()): number {
  const target = new Date(`${expiresOn}T00:00:00Z`).getTime();
  const today = new Date(
    `${now.toISOString().slice(0, 10)}T00:00:00Z`,
  ).getTime();
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

/** Classify a daysRemaining into a tone, or null if the item is
 *  far enough out that we don't bother warning. */
export function classifyExpiry(
  daysRemaining: number,
): ExpiringItem['tone'] | null {
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= 30) return 'critical';
  if (daysRemaining <= 60) return 'warn';
  return null;
}

/** Walk the master profile and collect every record that's
 *  expired or due within 60 days. Sorted most-urgent first. */
export function collectExpiringItems(
  profile: MasterProfile,
  now: Date = new Date(),
): ExpiringItem[] {
  const items: ExpiringItem[] = [];
  const addIf = (label: string, expiresOn: string | null | undefined) => {
    if (!expiresOn) return;
    const daysRemaining = daysUntil(expiresOn, now);
    const tone = classifyExpiry(daysRemaining);
    if (tone) items.push({ label, expiresOn, daysRemaining, tone });
  };
  addIf('CSLB license', profile.cslbExpiresOn);
  addIf('DIR registration', profile.dirExpiresOn);
  for (const p of profile.insurance) {
    addIf(`Insurance — ${p.kind} (${p.carrierName})`, p.expiresOn);
  }
  items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return items;
}
