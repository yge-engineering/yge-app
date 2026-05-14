'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Item {
  id: string;
  kind: 'job' | 'bid-result' | 'vendor' | 'customer';
  label: string;
  href: string;
  when: string;
}

interface Job { id: string; projectName?: string; updatedAt?: string; createdAt?: string }
interface BidResult { id: string; jobId: string; bidOpenedAt?: string; outcome?: string }
interface Vendor { id: string; createdAt?: string; legalName?: string; data?: { legalName?: string } }
interface Customer { id: string; createdAt?: string; legalName?: string; dbaName?: string }

export function RecentActivityFeed() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    (async () => {
      const out: Item[] = [];
      try {
        const [jr, br, vr, cr] = await Promise.all([
          fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl()}/api/bid-results`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
        ]);
        const jobs: Job[] = jr?.jobs ?? [];
        const bids: BidResult[] = br?.results ?? [];
        const vendors: Vendor[] = vr?.vendors ?? [];
        const customers: Customer[] = cr?.customers ?? [];

        for (const j of jobs) {
          out.push({
            id: j.id,
            kind: 'job',
            label: j.projectName ?? j.id,
            href: `/jobs/${j.id}`,
            when: j.updatedAt ?? j.createdAt ?? '',
          });
        }
        for (const b of bids) {
          out.push({
            id: b.id,
            kind: 'bid-result',
            label: `Bid result · ${b.outcome ?? ''}`,
            href: `/bid-results/${b.id}`,
            when: b.bidOpenedAt ?? '',
          });
        }
        for (const v of vendors) {
          out.push({
            id: v.id,
            kind: 'vendor',
            label: v.legalName ?? v.data?.legalName ?? v.id,
            href: `/vendors/${v.id}`,
            when: v.createdAt ?? '',
          });
        }
        for (const c of customers) {
          out.push({
            id: c.id,
            kind: 'customer',
            label: c.dbaName ?? c.legalName ?? c.id,
            href: `/customers/${c.id}`,
            when: c.createdAt ?? '',
          });
        }
        out.sort((a, b) => (b.when ?? '').localeCompare(a.when ?? ''));
        setItems(out.slice(0, 50));
      } catch {
        setItems([]);
      }
    })();
  }, []);

  if (!items) return <p className="text-sm text-gray-500">Loading…</p>;
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        Nothing recent to show.
      </p>
    );
  }

  const tone: Record<Item['kind'], string> = {
    job: 'bg-blue-100 text-blue-800',
    'bid-result': 'bg-emerald-100 text-emerald-800',
    vendor: 'bg-amber-100 text-amber-800',
    customer: 'bg-purple-100 text-purple-800',
  };

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
      {items.map((it) => (
        <li key={`${it.kind}-${it.id}`} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
          <span className="flex items-center gap-2 min-w-0">
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tone[it.kind]}`}>{it.kind}</span>
            <Link href={it.href} className="truncate font-medium text-gray-900 hover:text-yge-blue-700 hover:underline">
              {it.label}
            </Link>
          </span>
          <span className="shrink-0 font-mono text-xs text-gray-500">{(it.when || '').slice(0, 10) || '—'}</span>
        </li>
      ))}
    </ul>
  );
}
