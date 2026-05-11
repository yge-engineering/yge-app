// /year-end-close — year-end close-out wizard.
//
// Plain English: Brook's January playbook. Run these in order and
// the books are buttoned up for the CPA + the bank.

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

function fiscalYear(): number {
  // We close last calendar year — anything from Jan 1 of "this year"
  // back. So the FY label is `now.year - 1` until April 15 deadline.
  const now = new Date();
  return now.getUTCFullYear() - 1;
}

export default function YearEndClosePage() {
  requirePermission('financials:edit');
  const year = fiscalYear();

  const STEPS: CloseStep[] = [
    {
      num: 1,
      title: `Final bank rec through Dec 31, ${year}`,
      detail:
        'Reconcile every bank account, credit card, and loan account through the last business day of December. Any uncleared check or deposit becomes a reconciling item.',
      href: '/bank-recs',
      cta: 'Open bank recs →',
    },
    {
      num: 2,
      title: 'Clear out the AP queue',
      detail:
        'Cut checks for everything that should hit before year-end. Anything you want to deduct in this tax year must be both invoiced AND paid by Dec 31 (cash-basis) or invoiced by Dec 31 (accrual-basis).',
      href: '/ap-check-run',
      cta: 'AP check run →',
    },
    {
      num: 3,
      title: 'Write off uncollectible AR',
      detail:
        'For invoices over 365 days past due with no chance of collection, write them off to bad debt. Talk to the CPA first — sometimes a partial write-off is cleaner.',
      href: '/aging',
      cta: 'AR aging →',
    },
    {
      num: 4,
      title: `Run the ${year} 1099 worksheet`,
      detail:
        'Pull every non-corp vendor paid $600+. Verify the W-9 and TIN are current. Missing-W-9 vendors are IRS blockers — chase them in early January before the Jan 31 1099-NEC deadline.',
      href: '/1099-worksheet',
      cta: '1099 worksheet →',
    },
    {
      num: 5,
      title: 'Reconcile W-2 totals against Gusto',
      detail:
        'Gusto files the W-2s, but Brook spot-checks the totals: gross wages, taxes withheld, retirement contributions. Pull the Gusto Y/E report and compare to the YGE general-ledger payroll totals.',
      href: '/admin/gusto',
      cta: 'Gusto integration →',
    },
    {
      num: 6,
      title: `Pull the Dec 31, ${year} balance sheet`,
      detail:
        'Print and save the year-end balance sheet. The CPA needs it for the corp return; Brook needs it for the bank covenant package. Make sure retained earnings rolls correctly.',
      href: `/balance-sheet?asOf=${year}-12-31`,
      cta: 'Balance sheet →',
    },
    {
      num: 7,
      title: `Income statement Y/Y comparison (${year} vs ${year - 1})`,
      detail:
        'Run the full-year income statement. Eyeball line items vs the prior year — anything moving more than 20% should have a story. This is the first thing the bank and bonding underwriters will ask about.',
      href: `/income-statement?start=${year}-01-01&end=${year}-12-31`,
      cta: 'Income statement →',
    },
    {
      num: 8,
      title: 'Asset depreciation schedule',
      detail:
        'CPA handles the depreciation calc, but Brook gives them the equipment + vehicle additions/disposals list for the year. Pull it from the equipment register.',
      href: '/equipment',
      cta: 'Equipment register →',
    },
    {
      num: 9,
      title: `Year-end close package (${year})`,
      detail:
        'Generate the full close packet — TB, BS, IS, cash flow, AR/AP aging snapshots, bank-rec proofs. Send to the CPA via Dropbox link.',
      href: `/close-package?asOf=${year}-12-31`,
      cta: 'Close package →',
    },
    {
      num: 10,
      title: `Mark fiscal year ${year} closed`,
      detail:
        'Once the CPA signs off and the corp return is filed, post the year-end closing entries (zero out income + expense to retained earnings) and lock the period. Phase 5 will gate this with permissions; for now Brook does it manually.',
      href: '/journal-entries',
      cta: 'Journal entries →',
    },
  ];

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title={`Year-end close — ${year}`}
          subtitle="Run these steps in order to close out the fiscal year and ship the CPA + bank package."
        />

        <ol className="space-y-3">
          {STEPS.map((step) => (
            <li
              key={step.num}
              className="rounded-md border border-gray-200 bg-white p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-yge-blue-800">
                  Step {step.num} — {step.title}
                </h2>
                <Link
                  href={step.href}
                  className="shrink-0 text-xs font-semibold text-yge-blue-700 hover:underline"
                >
                  {step.cta}
                </Link>
              </div>
              <p className="mt-2 text-sm text-gray-700">{step.detail}</p>
            </li>
          ))}
        </ol>

        <p className="mt-6 text-xs text-gray-500">
          Year-end is the one time of year the bank, the bonding company,
          AND the IRS all read your numbers. Slow down, run the
          checklist, sleep well.
        </p>
      </main>
    </AppShell>
  );
}
