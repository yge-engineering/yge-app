// Recent activity feed — what's been touched lately across the app.
//
// Plain English: a "what changed today" sidebar card. Shows the most
// recently created or updated jobs, AR invoices, AP invoices, daily
// reports, RFIs, and dispatches. One glance to see if anyone on the
// team has been moving paper.

import Link from 'next/link';

import type { ApInvoice, ArInvoice, DailyReport, Dispatch, Job, Rfi } from '@yge/shared';

interface ActivityItem {
  href: string;
  label: string;
  sublabel: string;
  ts: string; // ISO timestamp
}

interface Props {
  jobs: Job[];
  arInvoices: ArInvoice[];
  apInvoices: ApInvoice[];
  rfis: Rfi[];
  dailyReports: DailyReport[];
  dispatches: Dispatch[];
}

function ts(item: { updatedAt?: string; createdAt?: string }): string {
  return item.updatedAt ?? item.createdAt ?? '';
}

function formatRelative(iso: string): string {
  if (!iso) return 'unknown';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso.slice(0, 10);
  const ms = Date.now() - then;
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

export function RecentActivity({ jobs, arInvoices, apInvoices, rfis, dailyReports, dispatches }: Props) {
  const items: ActivityItem[] = [];
  for (const j of jobs) {
    items.push({
      href: `/jobs/${j.id}`,
      label: `Job: ${j.projectName}`,
      sublabel: j.ownerAgency ?? '—',
      ts: ts(j),
    });
  }
  for (const inv of arInvoices) {
    items.push({
      href: `/ar-invoices/${inv.id}`,
      label: `AR invoice ${inv.invoiceNumber ?? inv.id}`,
      sublabel: inv.customerName,
      ts: ts(inv),
    });
  }
  for (const inv of apInvoices) {
    items.push({
      href: `/ap-invoices/${inv.id}`,
      label: `AP invoice from ${inv.vendorName}`,
      sublabel: inv.invoiceDate,
      ts: ts(inv),
    });
  }
  for (const r of rfis) {
    items.push({
      href: `/rfis/${r.id}`,
      label: `RFI ${r.rfiNumber}: ${r.subject}`,
      sublabel: r.status,
      ts: ts(r),
    });
  }
  for (const dr of dailyReports) {
    items.push({
      href: `/daily-reports/${dr.id}`,
      label: `Daily report ${dr.date}`,
      sublabel: dr.foremanId,
      ts: ts(dr),
    });
  }
  for (const d of dispatches) {
    items.push({
      href: `/dispatch/${d.id}`,
      label: `Dispatch ${d.scheduledFor}`,
      sublabel: d.foremanName,
      ts: ts(d),
    });
  }

  items.sort((a, b) => (b.ts ?? '').localeCompare(a.ts ?? ''));
  const recent = items.slice(0, 8);

  if (recent.length === 0) {
    return (
      <section className="rounded-md border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Recent activity</h2>
        <p className="text-xs text-gray-500">No activity yet. Once you start adding records, you&apos;ll see the latest changes here.</p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Recent activity</h2>
      <ul className="space-y-2 text-sm">
        {recent.map((item, i) => (
          <li key={i} className="flex items-start justify-between gap-3 border-b border-gray-50 pb-2 last:border-0 last:pb-0">
            <div className="min-w-0">
              <Link href={item.href} className="block truncate font-medium text-blue-700 hover:underline">
                {item.label}
              </Link>
              <div className="truncate text-xs text-gray-500">{item.sublabel}</div>
            </div>
            <div className="shrink-0 text-xs text-gray-400">{formatRelative(item.ts)}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
