'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Customer { id: string; email?: string | null; phone?: string | null; state?: string | null }
interface Vendor { id: string; email?: string; phone?: string; state?: string | null; data?: { email?: string; phone?: string; state?: string | null } }
interface Job { id: string; ownerAgency?: string | null; jobNumber?: string | null; status?: string | null; rateType?: string | null }
interface Employee { id: string; classification?: string | null; hireDate?: string | null }

function gradeOf(p: number): { letter: string; tone: string } {
  if (p >= 95) return { letter: 'A+', tone: 'bg-green-100 text-green-800' };
  if (p >= 90) return { letter: 'A', tone: 'bg-green-100 text-green-800' };
  if (p >= 85) return { letter: 'B+', tone: 'bg-green-100 text-green-700' };
  if (p >= 80) return { letter: 'B', tone: 'bg-emerald-100 text-emerald-800' };
  if (p >= 70) return { letter: 'C', tone: 'bg-amber-100 text-amber-800' };
  if (p >= 60) return { letter: 'D', tone: 'bg-orange-100 text-orange-800' };
  return { letter: 'F', tone: 'bg-red-100 text-red-800' };
}

export function GradePanel() {
  const [summary, setSummary] = useState<{ avg: number; samples: Array<{ label: string; pct: number }> } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cr, vr, jr, er] = await Promise.all([
          fetch(`${apiBaseUrl()}/api/customers`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
        ]);
        const customers: Customer[] = cr?.customers ?? [];
        const vendors: Vendor[] = vr?.vendors ?? [];
        const jobs: Job[] = jr?.jobs ?? [];
        const emps: Employee[] = er?.employees ?? [];

        const samples: Array<{ label: string; pct: number }> = [];
        function add(label: string, have: number, total: number) {
          if (total === 0) return;
          samples.push({ label, pct: (have / total) * 100 });
        }

        add('Customers email', customers.filter((c) => (c.email ?? '').includes('@')).length, customers.length);
        add('Customers phone', customers.filter((c) => (c.phone ?? '').trim()).length, customers.length);
        add('Customers state', customers.filter((c) => (c.state ?? '').trim()).length, customers.length);
        add('Vendors email', vendors.filter((v) => ((v.email ?? v.data?.email) ?? '').includes('@')).length, vendors.length);
        add('Vendors phone', vendors.filter((v) => ((v.phone ?? v.data?.phone) ?? '').trim()).length, vendors.length);
        add('Vendors state', vendors.filter((v) => ((v.state ?? v.data?.state) ?? '').trim()).length, vendors.length);
        add('Jobs owner agency', jobs.filter((j) => (j.ownerAgency ?? '').trim()).length, jobs.length);
        add('Jobs job number', jobs.filter((j) => (j.jobNumber ?? '').trim()).length, jobs.length);
        add('Jobs status', jobs.filter((j) => (j.status ?? '').trim()).length, jobs.length);
        add('Jobs rate type', jobs.filter((j) => (j.rateType ?? '').trim()).length, jobs.length);
        add('Employees classification', emps.filter((e) => (e.classification ?? '').trim()).length, emps.length);
        add('Employees hire date', emps.filter((e) => (e.hireDate ?? '').trim()).length, emps.length);

        const avg = samples.length > 0 ? samples.reduce((s, x) => s + x.pct, 0) / samples.length : 0;
        setSummary({ avg, samples });
      } catch {
        setSummary({ avg: 0, samples: [] });
      }
    })();
  }, []);

  if (!summary) return <p className="text-sm text-gray-500">Loading…</p>;
  const grade = gradeOf(summary.avg);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <div className="text-xs text-gray-500">Average coverage across {summary.samples.length} fields</div>
          <div className="text-2xl font-bold text-gray-900">{summary.avg.toFixed(1)}%</div>
        </div>
        <div className={`rounded-full px-4 py-2 text-3xl font-bold ${grade.tone}`}>{grade.letter}</div>
      </div>
      <div className="text-xs text-gray-500">
        See <Link href="/admin/cleanup-progress" className="text-yge-blue-700 hover:underline">/admin/cleanup-progress</Link> for the per-field breakdown.
      </div>
    </div>
  );
}
