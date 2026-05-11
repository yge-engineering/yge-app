// /period-close — monthly close wizard.
//
// Sequenced checklist of steps Brook runs at month end. Each step
// links to the existing page that handles it.

import Link from 'next/link';

import {
  AppShell,
  PageHeader,
} from '../../components';
import { requirePermission } from '../../lib/permissions';

interface CloseStep {
  num: number;
  title: string;
  detail: string;
  href: string;
  cta: string;
}

const STEPS: CloseStep[] = [
  {
    num: 1,
    title: 'Reconcile every bank account',
    detail:
      'Pull the OFX/QFX from each bank, drop it on the bank-rec, run AI auto-match, apply HIGH matches. Any unmatched rows become draft expenses.',
    href: '/bank-recs',
    cta: 'Open bank recs →',
  },
  {
    num: 2,
    title: 'Close out the AP cycle',
    detail:
      'Cut checks for the approved + unpaid invoices. Mark them paid as the checks clear (or wait for the next bank rec to flip them in batch).',
    href: '/ap-check-run',
    cta: 'AP check run →',
  },
  {
    num: 3,
    title: 'Chase aged AR',
    detail:
      'Send reminder emails to customers with past-due invoices. Use the per-customer Reminder buttons on the aging page.',
    href: '/aging',
    cta: 'AR/AP aging →',
  },
  {
    num: 4,
    title: 'File certified payrolls',
    detail:
      'For every active prevailing-wage job, file a CPR for the week ending in the month. The CPR-due dashboard tile shows which jobs are missing one.',
    href: '/certified-payrolls',
    cta: 'CPRs →',
  },
  {
    num: 5,
    title: 'Run the close-checklist',
    detail:
      'Walk the blockers. The dashboard close-progress tile shows progress; this page is the full list with deep links into each failing check.',
    href: '/close-checklist',
    cta: 'Full checklist →',
  },
  {
    num: 6,
    title: 'Post outstanding journal entries',
    detail:
      'Anything still in DRAFT needs to be POSTED (or explicitly held). Trial balance + income statement + balance sheet all pull from POSTED entries only.',
    href: '/journal-entries',
    cta: 'Journal entries →',
  },
  {
    num: 7,
    title: 'Generate + print the close package',
    detail:
      'TB + Income statement + Balance sheet + Cash flow stacked into one print-to-PDF for the CPA / bonding company.',
    href: '/close-package',
    cta: 'Close package →',
  },
  {
    num: 8,
    title: 'File 1099 worksheet (Q4 / year-end only)',
    detail:
      'CSV + printable per-vendor worksheets covering every over-threshold vendor. Hand to CPA for tax-prep software entry.',
    href: '/vendor-1099',
    cta: '1099 vendors →',
  },
];

export default async function PeriodClosePage() {
  requirePermission('financials:edit');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title="Monthly close wizard"
          subtitle="Brook's month-end workflow as a numbered checklist. Each step links to the page that does the work. Don't skip steps — the later checks depend on the earlier ones."
        />

        <ol className="space-y-3">
          {STEPS.map((s) => (
            <li
              key={s.num}
              className="flex gap-4 rounded-md border border-gray-200 bg-white p-4"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yge-blue-600 text-sm font-bold text-white">
                {s.num}
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-gray-900">
                  {s.title}
                </h2>
                <p className="mt-1 text-xs text-gray-700">{s.detail}</p>
                <Link
                  href={s.href}
                  className="mt-2 inline-block text-xs font-semibold text-yge-blue-700 hover:underline"
                >
                  {s.cta}
                </Link>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-6 text-xs text-gray-500">
          When the trial balance squares + the close-progress tile is
          all green + the close package is printed, the period is
          closed. Per-period locking is a future enhancement.
        </p>
      </main>
    </AppShell>
  );
}
