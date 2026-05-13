// /admin/data-health — record counts + last-activity per entity.

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
  mostRecentCreatedAt?: Record<string, string | null>;
  asOf: string;
}

interface MigrationStatusResponse {
  inSync: boolean;
  missingFromDb: string[];
  extraInDb: string[];
  verdict: string;
  onDiskCount: number;
  appliedOnDbCount: number;
}

async function fetchMigrationStatus(): Promise<MigrationStatusResponse | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/admin/health/migrations-status`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as MigrationStatusResponse;
  } catch {
    return null;
  }
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
  staleDays: number;
}

const SECTIONS: Section[] = [
  {
    title: 'Master data',
    caption: 'Zero here means the app is broken.',
    keys: ['jobs', 'customers', 'vendors', 'employees', 'users'],
    zeroIsBlocker: true,
    staleDays: 90,
  },
  {
    title: 'Estimating',
    caption: 'Populates as bids are entered.',
    keys: ['estimates', 'bidItems', 'costLines', 'bidTabs', 'bidResults'],
    zeroIsBlocker: false,
    staleDays: 45,
  },
  {
    title: 'Money',
    caption: 'AR + AP + cash. Should see new activity weekly in production.',
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
    staleDays: 30,
  },
  {
    title: 'Field ops',
    caption: 'Daily reports + time cards + dispatches.',
    keys: ['dailyReports', 'timeCards', 'dispatches'],
    zeroIsBlocker: false,
    staleDays: 7,
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
    staleDays: 30,
  },
  {
    title: 'Documents',
    caption: 'Document store.',
    keys: ['documents'],
    zeroIsBlocker: false,
    staleDays: 60,
  },
];

function labelFor(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
}

export default async function AdminDataHealthPage() {
  requirePermission('audit:view');
  const [result, migrations] = await Promise.all([
    fetchCounts(),
    fetchMigrationStatus(),
  ]);

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

  const { counts, mostRecentCreatedAt = {}, asOf } = result;

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title="Data health"
          subtitle={`Live record counts + last-activity per entity. As of ${asOf.slice(0, 19).replace('T', ' ')}.`}
        />

        {migrations && !migrations.inSync ? (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-red-800">
              Migration drift detected
            </h2>
            <p className="mt-1 text-xs text-red-700">{migrations.verdict}</p>
            {migrations.missingFromDb.length > 0 ? (
              <ul className="mt-2 list-disc pl-5 text-[11px] font-mono text-red-900">
                {migrations.missingFromDb.map((m) => (
                  <li key={m}>not applied: {m}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-[11px] text-red-700">
              Apply via Render rebuild (runs prisma migrate deploy) or
              the diagnostic SQL in docs/MIGRATION_TROUBLESHOOTING.md.
            </p>
          </div>
        ) : migrations ? (
          <p className="mb-4 text-[11px] text-green-700">
            Migrations in sync: {migrations.onDiskCount} on disk, {migrations.appliedOnDbCount} applied.
          </p>
        ) : null}

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
                  <p className="text-xs text-gray-600">
                    {sec.caption} Stale &gt; {sec.staleDays}d.
                  </p>
                </header>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {sec.keys.map((k) => {
                    const count = counts[k] ?? 0;
                    const isZero = count === 0;
                    const ageDays = daysAgo(mostRecentCreatedAt[k] ?? null);
                    const isStale =
                      ageDays !== null && ageDays > sec.staleDays;
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
                        {ageDays !== null ? (
                          <div
                            className={`text-[10px] ${isStale ? 'font-semibold text-amber-700' : 'text-gray-500'}`}
                          >
                            last: {ageDays}d ago
                            {isStale ? ' · stale' : ''}
                          </div>
                        ) : count > 0 ? (
                          <div className="text-[10px] text-gray-400">
                            last: unknown
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </dl>
              </section>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Red flags appear when a Master-data table reads zero. Amber
          appears when a module hasn&apos;t seen a new row in longer than
          its expected cadence (field ops &gt; 7d, money &gt; 30d, etc).
        </p>
      </main>
    </AppShell>
  );
}
