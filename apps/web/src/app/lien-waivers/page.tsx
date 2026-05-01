// /lien-waivers — CA statutory waiver tracker.
//
// Plain English: California Civil Code statutory waivers — §8132/§8134
// progress + §8136/§8138 final. Conditional waivers are safe to hand
// over before payment clears; unconditional waivers must wait until
// funds clear (otherwise we just signed away lien rights for nothing).

import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  Money,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import {
  computeLienWaiverRollup,
  isConditional,
  lienWaiverShortKindLabel,
  lienWaiverStatusLabel,
  lienWaiverStatuteLabel,
  type LienWaiver,
  type LienWaiverStatus,
} from '@yge/shared';

const STATUSES: LienWaiverStatus[] = ['DRAFT', 'SIGNED', 'DELIVERED', 'VOIDED'];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchWaivers(filter: { status?: string; jobId?: string }): Promise<LienWaiver[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/lien-waivers`);
    if (filter.status) url.searchParams.set('status', filter.status);
    if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { waivers: LienWaiver[] }).waivers;
  } catch {
    return [];
  }
}
async function fetchAll(): Promise<LienWaiver[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/lien-waivers`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { waivers: LienWaiver[] }).waivers;
  } catch {
    return [];
  }
}

export default async function LienWaiversPage({
  searchParams,
}: {
  searchParams: { status?: string; jobId?: string };
}) {
  const [waivers, all] = await Promise.all([fetchWaivers(searchParams), fetchAll()]);
  const rollup = computeLienWaiverRollup(all);

  function buildHref(overrides: Partial<{ status?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.status) params.set('status', merged.status);
    if (merged.jobId) params.set('jobId', merged.jobId);
    const q = params.toString();
    return q ? `/lien-waivers?${q}` : '/lien-waivers';
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Lien waivers"
          subtitle="CA Civil Code statutory waivers — §8132/§8134 progress + §8136/§8138 final. Conditional = safe before payment clears; unconditional = wait until funds clear."
          actions={
            <LinkButton href="/lien-waivers/new" variant="primary" size="md">
              + New waiver
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Total" value={rollup.total} />
          <Tile label="Draft" value={rollup.draft} />
          <Tile label="Signed" value={rollup.signed} />
          <Tile
            label="Unsigned uncond. (caution)"
            value={rollup.unsignedUnconditional}
            tone={rollup.unsignedUnconditional > 0 ? 'warn' : 'success'}
            warnText={rollup.unsignedUnconditional > 0 ? 'Confirm payment cleared before signing' : undefined}
          />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">Status:</span>
          <Link
            href={buildHref({ status: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.status ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            All
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={buildHref({ status: s })}
              className={`rounded px-2 py-1 text-xs ${searchParams.status === s ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {lienWaiverStatusLabel(s)}
            </Link>
          ))}
        </section>

        {waivers.length === 0 ? (
          <EmptyState
            title="No lien waivers yet"
            body="Customers usually require these to release each progress payment. Conditional progress (§8132) is the most common one for monthly draws."
            actions={[{ href: '/lien-waivers/new', label: 'New waiver', primary: true }]}
          />
        ) : (
          <DataTable
            rows={waivers}
            keyFn={(w) => w.id}
            columns={[
              {
                key: 'through',
                header: 'Through',
                cell: (w) => (
                  <Link href={`/lien-waivers/${w.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                    {w.throughDate}
                  </Link>
                ),
              },
              {
                key: 'kind',
                header: 'Kind',
                cell: (w) => (
                  <span>
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${
                        isConditional(w.kind) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {lienWaiverShortKindLabel(w.kind)}
                    </span>
                    <span className="ml-1 text-[10px] text-gray-500">{lienWaiverStatuteLabel(w.kind)}</span>
                  </span>
                ),
              },
              { key: 'owner', header: 'Owner', cell: (w) => <span className="text-sm text-gray-900">{w.ownerName}</span> },
              { key: 'job', header: 'Job', cell: (w) => <span className="text-xs text-gray-700">{w.jobName}</span> },
              {
                key: 'amount',
                header: 'Amount',
                numeric: true,
                cell: (w) => <Money cents={w.paymentAmountCents} />,
              },
              {
                key: 'status',
                header: 'Status',
                cell: (w) => <StatusPill label={lienWaiverStatusLabel(w.status)} tone="neutral" />,
              },
              {
                key: 'actions',
                header: '',
                cell: (w) => (
                  <Link href={`/lien-waivers/${w.id}/print`} className="text-xs text-blue-700 hover:underline">
                    Print
                  </Link>
                ),
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
