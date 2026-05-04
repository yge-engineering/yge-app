'use client';

// Recent activity feed — what's been touched lately across the app.
//
// Plain English: a "what changed today" sidebar card. Shows the most
// recently created or updated jobs, AR invoices, AP invoices, daily
// reports, RFIs, and dispatches. One glance to see if anyone on the
// team has been moving paper.
//
// Client component so it can be re-exported through the components
// barrel without dragging `next/headers` into client bundles.

import Link from 'next/link';

import type { ApInvoice, ArInvoice, DailyReport, Dispatch, Job, Rfi } from '@yge/shared';
import { useTranslator, type Translator } from '../lib/use-translator';

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

function formatRelative(iso: string, t: Translator): string {
  if (!iso) return t('recentActivity.relUnknown');
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso.slice(0, 10);
  const ms = Date.now() - then;
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return t('recentActivity.relJustNow');
  if (minutes < 60) return t('recentActivity.relMinAgo', { minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('recentActivity.relHrAgo', { hours });
  const days = Math.round(hours / 24);
  if (days < 7) {
    return days === 1
      ? t('recentActivity.relDayAgo', { days })
      : t('recentActivity.relDaysAgo', { days });
  }
  return new Date(iso).toLocaleDateString();
}

export function RecentActivity({ jobs, arInvoices, apInvoices, rfis, dailyReports, dispatches }: Props) {
  const t = useTranslator();
  const items: ActivityItem[] = [];
  for (const j of jobs) {
    items.push({
      href: `/jobs/${j.id}`,
      label: t('recentActivity.labelJob', { project: j.projectName }),
      sublabel: j.ownerAgency ?? '—',
      ts: ts(j),
    });
  }
  for (const inv of arInvoices) {
    items.push({
      href: `/ar-invoices/${inv.id}`,
      label: t('recentActivity.labelAr', { number: inv.invoiceNumber ?? inv.id }),
      sublabel: inv.customerName,
      ts: ts(inv),
    });
  }
  for (const inv of apInvoices) {
    items.push({
      href: `/ap-invoices/${inv.id}`,
      label: t('recentActivity.labelAp', { vendor: inv.vendorName }),
      sublabel: inv.invoiceDate,
      ts: ts(inv),
    });
  }
  for (const r of rfis) {
    items.push({
      href: `/rfis/${r.id}`,
      label: t('recentActivity.labelRfi', { number: r.rfiNumber, subject: r.subject }),
      sublabel: r.status,
      ts: ts(r),
    });
  }
  for (const dr of dailyReports) {
    items.push({
      href: `/daily-reports/${dr.id}`,
      label: t('recentActivity.labelDaily', { date: dr.date }),
      sublabel: dr.foremanId,
      ts: ts(dr),
    });
  }
  for (const d of dispatches) {
    items.push({
      href: `/dispatch/${d.id}`,
      label: t('recentActivity.labelDispatch', { scheduled: d.scheduledFor }),
      sublabel: d.foremanName,
      ts: ts(d),
    });
  }

  items.sort((a, b) => (b.ts ?? '').localeCompare(a.ts ?? ''));
  const recent = items.slice(0, 8);

  if (recent.length === 0) {
    return (
      <section className="rounded-md border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">{t('recentActivity.title')}</h2>
        <p className="text-xs text-gray-500">{t('recentActivity.empty')}</p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('recentActivity.title')}</h2>
      <ul className="space-y-2 text-sm">
        {recent.map((item, i) => (
          <li key={i} className="flex items-start justify-between gap-3 border-b border-gray-50 pb-2 last:border-0 last:pb-0">
            <div className="min-w-0">
              <Link href={item.href} className="block truncate font-medium text-blue-700 hover:underline">
                {item.label}
              </Link>
              <div className="truncate text-xs text-gray-500">{item.sublabel}</div>
            </div>
            <div className="shrink-0 text-xs text-gray-400">{formatRelative(item.ts, t)}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
