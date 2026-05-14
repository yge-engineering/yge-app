'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer { id: string; legalName?: string; dbaName?: string; email?: string; kind?: string }
interface Vendor { id: string; legalName?: string; data?: { legalName?: string; kind?: string; email?: string }; kind?: string; email?: string }
interface Job { id: string; projectName?: string; jobNumber?: string; status?: string; ownerAgency?: string | null }

interface Hit { kind: 'customer' | 'vendor' | 'job'; id: string; label: string; sub: string; href: string }

export function SearchPanel() {
  const [q, setQ] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [cr, vr, jr] = await Promise.all([
          fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
        ]);
        setCustomers((cr?.customers ?? []) as Customer[]);
        setVendors((vr?.vendors ?? []) as Vendor[]);
        setJobs((jr?.jobs ?? []) as Job[]);
      } catch { /* ignore */ }
      setLoaded(true);
    })();
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const out: Hit[] = [];
    for (const c of customers) {
      const label = c.dbaName ?? c.legalName ?? c.id;
      if (label.toLowerCase().includes(needle) || (c.email ?? '').toLowerCase().includes(needle)) {
        out.push({ kind: 'customer', id: c.id, label, sub: `${c.kind ?? '—'} · ${c.email ?? '—'}`, href: `/customers/${c.id}` });
      }
    }
    for (const v of vendors) {
      const label = (v.legalName ?? v.data?.legalName ?? v.id) as string;
      const email = (v.email ?? v.data?.email ?? '') as string;
      const kind = (v.kind ?? v.data?.kind ?? '—') as string;
      if (label.toLowerCase().includes(needle) || email.toLowerCase().includes(needle)) {
        out.push({ kind: 'vendor', id: v.id, label, sub: `${kind} · ${email || '—'}`, href: `/vendors/${v.id}` });
      }
    }
    for (const j of jobs) {
      const label = j.projectName ?? j.id;
      if (label.toLowerCase().includes(needle) || (j.jobNumber ?? '').toLowerCase().includes(needle) || (j.ownerAgency ?? '').toLowerCase().includes(needle)) {
        out.push({ kind: 'job', id: j.id, label, sub: `${j.jobNumber ?? '—'} · ${j.ownerAgency ?? '—'} · ${j.status ?? '—'}`, href: `/jobs/${j.id}` });
      }
    }
    return out.slice(0, 50);
  }, [q, customers, vendors, jobs]);

  const tone: Record<Hit['kind'], string> = {
    customer: 'bg-purple-100 text-purple-800',
    vendor: 'bg-amber-100 text-amber-800',
    job: 'bg-blue-100 text-blue-800',
  };

  return (
    <div className="space-y-4">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type a customer / vendor / job name, email, or job number…"
        className="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />

      <div className="text-xs text-gray-500">
        {loaded ? `${customers.length} customers · ${vendors.length} vendors · ${jobs.length} jobs in scope` : 'Loading…'}
      </div>

      {q.trim().length < 2 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          Type at least 2 characters to search.
        </p>
      ) : hits.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          No matches.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
          {hits.map((h) => (
            <li key={`${h.kind}-${h.id}`} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tone[h.kind]}`}>{h.kind}</span>
              <div className="min-w-0">
                <Link href={h.href} className="font-medium text-gray-900 hover:text-yge-blue-700 hover:underline">{h.label}</Link>
                <div className="truncate text-xs text-gray-600">{h.sub}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
