// /admin/data-health — record counts per entity. Red flag when zero.
//
// Plain English: did somebody (or something) just wipe a table?
// This page is the smoke alarm. We hit it after a deploy or any
// time the app feels weirdly empty.

import {
  AppShell,
  PageHeader,
} from '../../../components';
import { requirePermission } from '../../../lib/permissions';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface DataCountsResponse {
  counts: Record<string, number>;
  asOf: string;
}

async function fetchCounts(): Promise<DataCountsResponse | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/admin/health/data-counts`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as DataCountsResponse;
  } catch {
    return null;
  }
}

interface Section {
  title: string;
  caption: string;
  keys: string[];
  zeroIsBlocker: boolean;
}

const SECTIONS: Section[] = [
  {
    title: 'Master data',
    caption: 'Zero here means the app is broken. Anyone missing should be restored.',
    keys: ['jobs', 'customers', 'vendors', 'employees', 'users'],
    zeroIsBlocker: true,
  },
  {
    title: 'Estimating',
    caption: 'Zero is normal on a fresh install — populates as bids are entered.',
    keys: ['estimates', 'bidItems', 'costLines', 'bidTabs', 'bidResults'],
    zeroIsBlocker: false,
  },
  {
    title: 'Money',
    caption: 'AR/AP + cash. Sparse early, dense after a few months in production.',
    keys: [
      'arInvoices',
      'apInvoices',
      'arPayments',
      'apPayments',
      'bankRecs',
      'journalEntries',
      'expenses',
    ],
    zeroIsBlocker: false,
  },
  {
    title: 'Field ops',
    caption: 'Daily reports, time cards, dispatches.',
    keys: ['dailyReports', 'timeCards', 'dispatches'],
    zeroIsBlocker: false,
  },
  {
    title: 'Compliance',
    caption: 'Lien waivers, CPRs, submittals, RFIs, change orders, PCOs.',
    keys: [
      'lienWaivers',
      'certifiedPayrolls',
      'submittals',
      'rfis',
      'changeOrders',
      'pcos',
    ],
    zeroIsBlocker: false,
  },
  {
    title: 'Documents',
    caption: 'Document store.',
    keys: ['documents'],
    zeroIsBlocker: false,
  },
];

function labelFor(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export default async function AdminDataHealthPage() {
  requirePermission('audit:view');
  const result = await fetchCounts();

  if (!result) {
    return (
      <AppShell>
        <main className="mx-auto max-w-3xl">
          <PageHeader title="Data health" />
          <p className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            Couldn&apos;t reach <code>/api/admin/health/data-counts</code>.
            Check the API logs.
          </p>
        </main>
      </AppShell>
    );
  }

  const { counts, asOf } = result;

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title="Data health"
          subtitle={`Live record counts per entity. As of ${asOf.slice(0, 19).replace('T', ' ')}.`}
        />

        <div className="space-y-4">
          {SECTIONS.map((sec) => {
            const zeros = sec.keys.filter((k) => (counts[k] ?? 0) === 0);
            const sectionBlocker = sec.zeroIsBlocker && zeros.length > 0;
            return (
              <section
                key={sec.title}
                className={`rounded-md border p-4 ${sectionBlocker ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
              >
                <header className="mb-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                    {sec.title}
                  </h2>
                  <p className="text-xs text-gray-600">{sec.caption}</p>
                </header>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {sec.keys.map((k) => {
                    const count = counts[k] ?? 0;
                    const isZero = count === 0;
                    const flagClass = sec.zeroIsBlocker && isZero
                      ? 'text-red-700'
                      : isZero
                        ? 'text-gray-500'
                        : 'text-yge-blue-900';
                    return (
                      <div key={k}>
                        <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                          {labelFor(k)}
                        </dt>
                        <dd className={`font-mono text-base font-semibold ${flagClass}`}>
                          {count.toLocaleString()}
                          {sec.zeroIsBlocker && isZero ? (
                            <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-800">
                              Missing
                            </span>
                          ) : null}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Red flags appear when a Master-data table reads zero. If you see
          one after a deploy, check Render logs + run the backfill from
          /admin/backfill before panicking. Estimating / Money / Field
          counts can legitimately be zero on a fresh install.
        </p>
      </main>
    </AppShell>
  );
}
