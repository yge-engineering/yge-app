import * as React from 'react';
import Link from 'next/link';
import type { MasterProfile } from '@yge/shared';
import { isNextInternalError } from '../lib/next-control-flow';

// Master-profile expiries tile.
//
// Surfaces the same expiry-warning information the /master-profile
// page itself shows, but on /dashboard/lite so Ryan sees a CSLB /
// DIR / insurance expiry warning during the morning glance instead
// of having to remember to open the master profile page.
//
// Self-hiding: returns null when no records are within 60 days of
// expiry, so the dashboard isn't cluttered when everything's
// current.

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface ExpiringItem {
  label: string;
  expiresOn: string;
  daysRemaining: number;
  tone: 'expired' | 'critical' | 'warn';
}

function daysUntil(expiresOn: string): number {
  const target = new Date(`${expiresOn}T00:00:00Z`).getTime();
  const today = new Date(
    `${new Date().toISOString().slice(0, 10)}T00:00:00Z`,
  ).getTime();
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function classifyExpiry(daysRemaining: number): ExpiringItem['tone'] | null {
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= 30) return 'critical';
  if (daysRemaining <= 60) return 'warn';
  return null;
}

function collectExpiringItems(profile: MasterProfile): ExpiringItem[] {
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

async function fetchProfile(): Promise<MasterProfile | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/master-profile`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return ((await res.json()) as { profile: MasterProfile }).profile;
  } catch {
    return null;
  }
}

async function MasterProfileExpiriesTileInner(): Promise<React.ReactElement | null> {
  const profile = await fetchProfile();
  if (!profile) return null;

  const items = collectExpiringItems(profile);
  if (items.length === 0) return null;

  const worst = items.some(
    (i) => i.tone === 'expired' || i.tone === 'critical',
  )
    ? 'critical'
    : 'warn';
  const wrapperCls =
    worst === 'critical'
      ? 'border-red-300 bg-red-50 text-red-900'
      : 'border-amber-300 bg-amber-50 text-amber-900';
  const titleBtnCls =
    worst === 'critical'
      ? 'border-red-400 text-red-900 hover:bg-red-100'
      : 'border-amber-400 text-amber-900 hover:bg-amber-100';

  return (
    <section className={`mb-6 rounded-md border p-4 ${wrapperCls}`}>
      <header className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Profile expiries
        </h2>
        <Link
          href="/master-profile"
          className={`rounded border bg-white px-3 py-1.5 text-xs font-semibold ${titleBtnCls}`}
        >
          Open profile →
        </Link>
      </header>
      <p className="text-xs">
        {items.length} record{items.length === 1 ? '' : 's'} expired or due
        within 60 days. Bid forms reference these — expired ones block
        submission.
      </p>
      <ul className="mt-2 space-y-0.5 text-xs">
        {items.slice(0, 4).map((item) => {
          const itemCls =
            item.tone === 'expired'
              ? 'text-red-800 font-semibold'
              : item.tone === 'critical'
                ? 'text-red-700'
                : 'text-amber-800';
          const ageLabel =
            item.tone === 'expired'
              ? `EXPIRED ${Math.abs(item.daysRemaining)}d ago`
              : `in ${item.daysRemaining}d`;
          return (
            <li key={`${item.label}-${item.expiresOn}`} className={itemCls}>
              <span className="font-medium">{item.label}</span> —{' '}
              {item.expiresOn} ({ageLabel})
            </li>
          );
        })}
        {items.length > 4 && (
          <li className="text-[11px] italic opacity-75">
            …{items.length - 4} more on /master-profile
          </li>
        )}
      </ul>
    </section>
  );
}

export async function MasterProfileExpiriesTile(): Promise<React.ReactElement | null> {
  try {
    return await MasterProfileExpiriesTileInner();
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error('[MasterProfileExpiriesTile] render failed:', err);
    return null;
  }
}
