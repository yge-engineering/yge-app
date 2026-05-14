'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job { id: string; updatedAt?: string }
interface BidResult { id: string; outcome?: string }

export function TodayPanel() {
  const [data, setData] = useState<{ tbd: number; touched: number; bidSubmitted: number; missingAgency: number; missingClass: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const todayIso = new Date().toISOString().slice(0, 10);
        const [bidRes, jobRes, custRes, empRes] = await Promise.all([
          fetch(`${apiBaseUrl()}/api/bid-results`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
        ]);
        const bids: BidResult[] = bidRes?.results ?? [];
        const jobs: Job[] = jobRes?.jobs ?? [];
        type J = { ownerAgency?: string | null; status?: string };
        const allJobs = (jobRes?.jobs ?? []) as J[];
        type E = { classification?: string | null };
        const emps = (empRes?.employees ?? []) as E[];

        const tbd = bids.filter((b) => b.outcome === 'TBD').length;
        const touched = jobs.filter((j) => (j.updatedAt ?? '').startsWith(todayIso)).length;
        const bidSubmitted = allJobs.filter((j) => j.status === 'BID_SUBMITTED').length;
        const missingAgency = allJobs.filter((j) => !(j.ownerAgency ?? '').trim()).length;
        const missingClass = emps.filter((e) => !(e.classification ?? '').trim()).length;

        // Reference custRes so eslint no-unused-vars stays happy across config changes.
        void custRes;

        setData({ tbd, touched, bidSubmitted, missingAgency, missingClass });
      } catch {
        setData({ tbd: 0, touched: 0, bidSubmitted: 0, missingAgency: 0, missingClass: 0 });
      }
    })();
  }, []);

  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Decision pending</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Bids in TBD" value={data.tbd} href="/bid-results/tbd" tone="warn" />
          <Tile label="Bid submitted (pending)" value={data.bidSubmitted} href="/jobs/bid-submitted" tone="warn" />
          <Tile label="Jobs touched today" value={data.touched} href="/jobs/recent" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Cleanup</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Jobs w/o agency" value={data.missingAgency} href="/jobs/missing-owner-agency" tone={data.missingAgency > 0 ? 'bad' : 'good'} />
          <Tile label="Employees w/o class" value={data.missingClass} href="/employees/missing-classification" tone={data.missingClass > 0 ? 'bad' : 'good'} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Jump to</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li><Link href="/dashboard/morning-briefing" className="text-yge-blue-700 hover:underline">Morning briefing</Link></li>
          <li><Link href="/portfolio" className="text-yge-blue-700 hover:underline">Portfolio overview</Link></li>
          <li><Link href="/quick-tools" className="text-yge-blue-700 hover:underline">All analytic + utility pages</Link></li>
          <li><Link href="/sitemap" className="text-yge-blue-700 hover:underline">Full site map</Link></li>
        </ul>
      </section>
    </div>
  );
}

function Tile({ label, value, href, tone }: { label: string; value: React.ReactNode; href?: string; tone?: 'good' | 'bad' | 'warn' }) {
  const toneClass = tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : 'text-yge-blue-900';
  const inner = (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
  return href ? <Link href={href} className="block hover:bg-gray-50">{inner}</Link> : inner;
}
