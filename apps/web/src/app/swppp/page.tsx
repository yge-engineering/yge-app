// /swppp — SWPPP / BMP inspection log.
//
// Plain English: Stormwater Pollution Prevention Plan / Best
// Management Practices inspections required under the California
// Construction General Permit. The State Water Resources Control
// Board can audit at any time. Page tracks cadence and surfaces any
// open deficiencies.

import Link from 'next/link';

import {
  Alert,
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  PageHeader,
  Tile,
} from '../../components';
import { getLocale, getTranslator } from '../../lib/locale';
import {
  computeSwpppRollup,
  deficiencyCount,
  openDeficiencyCount,
  swpppTriggerLabel,
  type SwpppInspection,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchInspections(filter: { jobId?: string }): Promise<SwpppInspection[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/swppp-inspections`);
    if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { inspections: SwpppInspection[] }).inspections;
  } catch {
    return [];
  }
}

export default async function SwpppPage({
  searchParams,
}: {
  searchParams: { jobId?: string };
}) {
  const inspections = await fetchInspections(searchParams);
  const rollup = computeSwpppRollup(inspections);
  const t = getTranslator();
  const locale = getLocale();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('swppp.title')}
          subtitle={t('swppp.subtitle')}
          actions={
            <LinkButton href="/swppp/new" variant="primary" size="md">
              {t('swppp.newInspection')}
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('swppp.tile.total')} value={rollup.total} />
          <Tile
            label={t('swppp.tile.withDef')}
            value={rollup.withDeficiencies}
            tone={rollup.withDeficiencies > 0 ? 'warn' : 'success'}
          />
          <Tile
            label={t('swppp.tile.openDef')}
            value={rollup.openDeficiencies}
            tone={rollup.openDeficiencies > 0 ? 'danger' : 'success'}
          />
          <Tile
            label={t('swppp.tile.daysSince')}
            value={rollup.daysSinceLast ?? '—'}
            tone={rollup.weeklyCadenceLate ? 'danger' : 'success'}
          />
        </section>

        {rollup.weeklyCadenceLate ? (
          <Alert tone="danger" title={t('swppp.alert.cadence.title')} className="mb-4">
            {t('swppp.alert.cadence.body', { days: rollup.daysSinceLast ?? '?', date: rollup.lastInspectedOn ?? '—' })}
          </Alert>
        ) : null}

        {inspections.length === 0 ? (
          <EmptyState
            title={t('swppp.empty.title')}
            body={t('swppp.empty.body')}
            actions={[{ href: '/swppp/new', label: t('swppp.empty.action'), primary: true }]}
          />
        ) : (
          <DataTable
            rows={inspections}
            keyFn={(s) => s.id}
            columns={[
              {
                key: 'date',
                header: t('swppp.col.date'),
                cell: (s) => (
                  <Link href={`/swppp/${s.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                    {s.inspectedOn}
                  </Link>
                ),
              },
              { key: 'trigger', header: t('swppp.col.trigger'), cell: (s) => <span className="text-xs text-gray-700">{swpppTriggerLabel(s.trigger, locale)}</span> },
              {
                key: 'inspector',
                header: t('swppp.col.inspector'),
                cell: (s) => (
                  <span className="text-xs text-gray-700">
                    {s.inspectorName}
                    {s.inspectorCertification ? <div className="text-[10px] text-gray-500">QSP/QSD #{s.inspectorCertification}</div> : null}
                  </span>
                ),
              },
              {
                key: 'job',
                header: t('swppp.col.job'),
                cell: (s) => (
                  <Link href={`/jobs/${s.jobId}`} className="font-mono text-xs text-blue-700 hover:underline">
                    {s.jobId}
                  </Link>
                ),
              },
              { key: 'bmps', header: t('swppp.col.bmps'), numeric: true, cell: (s) => <span className="font-mono text-xs">{s.bmpChecks.length}</span> },
              {
                key: 'deficient',
                header: t('swppp.col.deficient'),
                numeric: true,
                cell: (s) => {
                  const def = deficiencyCount(s);
                  return def > 0 ? (
                    <span className="font-mono text-xs font-semibold text-amber-800">{def}</span>
                  ) : (
                    <span className="font-mono text-xs text-gray-400">0</span>
                  );
                },
              },
              {
                key: 'open',
                header: t('swppp.col.open'),
                numeric: true,
                cell: (s) => {
                  const open = openDeficiencyCount(s);
                  return open > 0 ? (
                    <span className="font-mono text-xs font-semibold text-red-700">{open}</span>
                  ) : (
                    <span className="font-mono text-xs text-gray-400">0</span>
                  );
                },
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
