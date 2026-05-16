'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer { id: string; email?: string | null; phone?: string | null; billingAddressLine?: string | null; }
interface Vendor { id: string; state?: string | null; kind?: string | null; phone?: string | null; }
interface Job { id: string; status?: string | null; ownerAgency?: string | null; jobNumber?: string | null; }
interface Employee { id: string; classification?: string | null; rateType?: string | null; hireDate?: string | null; }

function gradeOf(pct: number): { letter: string; tone: 'good' | 'warn' | 'bad' } {
  if (pct >= 95) return { letter: 'A', tone: 'good' };
  if (pct >= 85) return { letter: 'B', tone: 'good' };
  if (pct >= 70) return { letter: 'C', tone: 'warn' };
  if (pct >= 50) return { letter: 'D', tone: 'warn' };
  return { letter: 'F', tone: 'bad' };
}

export function GradePanel() {
  const [pct, setPct] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const [c, v, j, e] = await Promise.all([
        fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { customers: [] })).then((j: { customers?: Customer[] }) => j.customers ?? []),
        fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { vendors: [] })).then((j: { vendors?: Vendor[] }) => j.vendors ?? []),
        fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { jobs: [] })).then((j: { jobs?: Job[] }) => j.jobs ?? []),
        fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { employees: [] })).then((j: { employees?: Employee[] }) => j.employees ?? []),
      ]);
      const checks: number[] = [];
      function present<T>(rows: T[], picks: Array<(r: T) => unknown>): void {
        for (const r of rows) {
          for (const p of picks) {
            checks.push(p(r) ? 1 : 0);
          }
        }
      }
      present(c, [(x) => x.email, (x) => x.phone, (x) => x.billingAddressLine]);
      present(v, [(x) => x.state, (x) => x.kind, (x) => x.phone]);
      present(j, [(x) => x.status, (x) => x.ownerAgency, (x) => x.jobNumber]);
      present(e, [(x) => x.classification, (x) => x.rateType, (x) => x.hireDate]);
      const total = checks.length;
      const filled = checks.reduce((acc, n) => acc + n, 0);
      setPct(total === 0 ? 100 : (filled / total) * 100);
    }
    load().catch(() => setPct(0));
  }, []);

  if (pct === null) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }
  const { letter, tone } = gradeOf(pct);
  const toneClass = tone === 'good' ? 'text-green-800' : tone === 'warn' ? 'text-amber-800' : 'text-red-800';
  const borderClass = tone === 'good' ? 'border-green-200 bg-green-50' : tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50';

  return (
    <section className={`rounded-lg border ${borderClass} p-6 text-center shadow-sm`}>
      <div className={`text-9xl font-extrabold leading-none ${toneClass}`}>{letter}</div>
      <div className={`mt-3 text-xl font-semibold ${toneClass}`}>{pct.toFixed(1)}% complete</div>
      <p className="mt-2 text-xs text-gray-700">across all canonical master-data fields.</p>
    </section>
  );
}
