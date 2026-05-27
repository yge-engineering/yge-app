// Shared expiry helpers for the master profile.
//
// Two consumers today:
//   - /master-profile (the page) renders an expiry warning panel
//     at the top.
//   - /dashboard/lite renders MasterProfileExpiriesTile, which
//     surfaces the same warnings during the morning glance.
//
// Both consumers want the same thresholds (red ≤30 days /
// expired, amber 31-60 days) and the same item list. Keeping
// the logic here means a future threshold change happens in one
// place.
//
// Lives in apps/web/src/lib/ (not packages/shared/) because it
// reaches into the MasterProfile shape's specific fields — CSLB
// expiry, DIR expiry, per-policy insurance expiry. If a future
// caller in apps/api or mobile/ needs the same logic, this can
// promote to shared.

import type { MasterProfile } from '@yge/shared';

export interface ExpiringItem {
  label: string;
  expiresOn: string;
  daysRemaining: number;
  tone: 'expired' | 'critical' | 'warn';
}

/** Days between today (UTC midnight) and the given YYYY-MM-DD
 *  date. Negative when expiresOn is already in the past. */
export function daysUntil(expiresOn: string): number {
  const target = new Date(`${expiresOn}T00:00:00Z`).getTime();
  const today = new Date(
    `${new Date().toISOString().slice(0, 10)}T00:00:00Z`,
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
export function collectExpiringItems(profile: MasterProfile): ExpiringItem[] {
  const items: ExpiringItem[] = [];
  const addIf = (label: string, expiresOn: string | null | undefined) => {
    if (!expiresOn) return;
    const daysRemaining = daysUntil(expiresOn);
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
