// /qbo-cutover — one place to run the whole QuickBooks Online migration.
//
// Order matters: import the chart of accounts FIRST so customers/vendors and
// the open AR/AP + trial-balance imports have accounts to match against.
// Every step is preview-then-commit and idempotent — safe to re-run.

import Link from 'next/link';
import { AppShell, PageHeader } from '../../components';
import { requirePermission } from '../../lib/permissions';

function apiBaseUrl(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchCount(pathname: string, key: string): Promise<number> {
  try {
    const res = await fetch(apiBaseUrl() + pathname, { cache: 'no-store' });
    if (!res.ok) return 0;
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body[key];
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

interface Step {
  n: number;
  title: string;
  href: string;
  blurb: string;
}

const STEPS: Step[] = [
  {
    n: 1,
    title: 'Chart of accounts',
    href: '/coa/import',
    blurb: 'Do this first. QuickBooks account types map to our 8 types, 5-digit numbers are assigned, and parent nesting is rebuilt. Everything below matches against these accounts.',
  },
  {
    n: 2,
    title: 'Customers',
    href: '/customers/import',
    blurb: 'Agencies and private owners. We guess each customer’s kind (state agency, county, city, private) from the name — review and fix before saving.',
  },
  {
    n: 3,
    title: 'Vendors',
    href: '/vendors/import',
    blurb: 'Suppliers, subs, truckers, professionals. Payment terms are normalized, the 1099 flag is set from the Track-1099 column or the vendor kind, and the tax ID carries across.',
  },
  {
    n: 4,
    title: 'Open A/R (unpaid invoices)',
    href: '/ar-invoices/import',
    blurb: 'From the A/R Aging Detail. Each unpaid invoice becomes an open receivable dated for correct aging, parked on a migration job until you re-assign it.',
  },
  {
    n: 5,
    title: 'Open A/P (unpaid bills)',
    href: '/ap-invoices/import',
    blurb: 'From the A/P Aging Detail. Each unpaid bill becomes an approved open payable dated for correct aging.',
  },
  {
    n: 6,
    title: 'GL opening balances (Trial Balance)',
    href: '/journal-entries/import',
    blurb: 'Last. One balanced opening journal entry as of your cutover date. Anything unmatched is absorbed by Opening Balance Equity and flagged. Saved as a draft for you to review and post.',
  },
];

export default async function QboCutoverPage() {
  requirePermission('financials:view');
  const [accounts, customers, vendors, arInvoices, apInvoices] = await Promise.all([
    fetchCount('/api/coa', 'accounts'),
    fetchCount('/api/customers', 'customers'),
    fetchCount('/api/vendors', 'vendors'),
    fetchCount('/api/ar-invoices', 'invoices'),
    fetchCount('/api/ap-invoices', 'invoices'),
  ]);
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title="QuickBooks cutover"
          subtitle="Move YGE off QuickBooks Online, one import at a time. Run these in order — each one previews the mapping before it saves anything, and re-running never duplicates."
        />

        <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <strong>Before you start:</strong> in QuickBooks, export each list /
          report to Excel and save it as CSV. Pick a single cutover date and use
          it for the A/R aging, A/P aging, and Trial Balance reports so the
          opening books tie out.
        </div>

        <div className="mb-4">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">In your books now</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {([
              ['Accounts', accounts],
              ['Customers', customers],
              ['Vendors', vendors],
              ['AR invoices', arInvoices],
              ['AP invoices', apInvoices],
            ] as Array<[string, number]>).map(([label, n]) => (
              <div key={label} className="rounded border border-gray-200 bg-white p-2 text-center">
                <div className="text-lg font-bold text-yge-blue-900">{n}</div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <ol className="space-y-3">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-3 rounded border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yge-blue-500 text-sm font-bold text-white">
                {s.n}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-gray-900">{s.title}</h2>
                  <Link
                    href={s.href}
                    className="shrink-0 rounded bg-yge-blue-500 px-3 py-1 text-xs font-semibold text-white hover:bg-yge-blue-700"
                  >
                    Open import &rarr;
                  </Link>
                </div>
                <p className="mt-1 text-xs text-gray-600">{s.blurb}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          <strong>How balances land:</strong> the open A/R and A/P imports give
          you per-invoice aging detail. The Trial Balance import sets every GL
          account (cash, fixed assets, loans, equity, retained earnings, and the
          A/R &amp; A/P control balances) so the balance sheet ties out. Review
          the draft opening journal entry and post it when you&apos;re ready.
        </div>

        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>After importing open A/R:</strong> the invoices land on a
          migration job. Move them onto their real YGE jobs at{' '}
          <Link href="/ar-invoices/migration" className="font-semibold text-yge-blue-700 hover:underline">
            Reassign imported A/R
          </Link>.
        </div>
      </main>
    </AppShell>
  );
}
