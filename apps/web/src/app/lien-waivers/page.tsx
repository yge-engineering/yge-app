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
import { getLocale, getTranslator } from '../../lib/locale';
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
  const t = getTranslator();
  const locale = getLocale();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('lw.title')}
          subtitle={t('lw.subtitle')}
          actions={
            <LinkButton href="/lien-waivers/new" variant="primary" size="md">
              {t('lw.newWaiver')}
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('lw.tile.total')} value={rollup.total} />
          <Tile label={t('lw.tile.draft')} value={rollup.draft} />
          <Tile label={t('lw.tile.signed')} value={rollup.signed} />
          <Tile
            label={t('lw.tile.unsignedUncond')}
            value={rollup.unsignedUnconditional}
            tone={rollup.unsignedUnconditional > 0 ? 'warn' : 'success'}
            warnText={rollup.unsignedUnconditional > 0 ? t('lw.tile.unsignedUncond.warn') : undefined}
          />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">{t('lw.filter.status')}</span>
          <Link
            href={buildHref({ status: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.status ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {t('lw.filter.all')}
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={buildHref({ status: s })}
              className={`rounded px-2 py-1 text-xs ${searchParams.status === s ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {lienWaiverStatusLabel(s, locale)}
            </Link>
          ))}
        </section>

        {waivers.length === 0 ? (
          <EmptyState
            title={t('lw.empty.title')}
            body={t('lw.empty.body')}
            actions={[{ href: '/lien-waivers/new', label: t('lw.empty.action'), primary: true }]}
          />
        ) : (
          <DataTable
            rows={waivers}
            keyFn={(w) => w.id}
            columns={[
              {
                key: 'through',
                header: t('lw.col.through'),
                cell: (w) => (
                  <Link href={`/lien-waivers/${w.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                    {w.throughDate}
                  </Link>
                ),
              },
              {
                key: 'kind',
                header: t('lw.col.kind'),
                cell: (w) => (
                  <span>
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${
                        isConditional(w.kind) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {lienWaiverShortKindLabel(w.kind, locale)}
                    </span>
                    <span className="ml-1 text-[10px] text-gray-500">{lienWaiverStatuteLabel(w.kind)}</span>
                  </span>
                ),
              },
              { key: 'owner', header: t('lw.col.owner'), cell: (w) => <span className="text-sm text-gray-900">{w.ownerName}</span> },
              { key: 'job', header: t('lw.col.job'), cell: (w) => <span className="text-xs text-gray-700">{w.jobName}</span> },
              {
                key: 'amount',
                header: t('lw.col.amount'),
                numeric: true,
                cell: (w) => <Money cents={w.paymentAmountCents} />,
              },
              {
                key: 'status',
                header: t('lw.col.status'),
                cell: (w) => <StatusPill label={lienWaiverStatusLabel(w.status, locale)} tone="neutral" />,
              },
              {
                key: 'actions',
                header: '',
                cell: (w) => (
                  <Link href={`/lien-waivers/${w.id}/print`} className="text-xs text-blue-700 hover:underline">
                    {t('lw.action.print')}
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
