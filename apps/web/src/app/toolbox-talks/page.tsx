// /toolbox-talks — Cal/OSHA T8 §1509 weekly safety meeting tracker.
//
// Plain English: tailgate meetings every 10 working days. Records are
// inspectable. This page tells you when the last one was, whether
// you're overdue, and lists the talks you have on file.

import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import { getTranslator } from '../../lib/locale';
import {
  computeToolboxTalkRollup,
  signedAttendeeCount,
  toolboxTalkStatusLabel,
  type ToolboxTalk,
  type ToolboxTalkStatus,
} from '@yge/shared';

const STATUSES: ToolboxTalkStatus[] = ['DRAFT', 'HELD', 'SUBMITTED'];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchTalks(filter: { status?: string; jobId?: string }): Promise<ToolboxTalk[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/toolbox-talks`);
    if (filter.status) url.searchParams.set('status', filter.status);
    if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { talks: ToolboxTalk[] }).talks;
  } catch {
    return [];
  }
}
async function fetchAll(): Promise<ToolboxTalk[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/toolbox-talks`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { talks: ToolboxTalk[] }).talks;
  } catch {
    return [];
  }
}

export default async function ToolboxTalksPage({
  searchParams,
}: {
  searchParams: { status?: string; jobId?: string };
}) {
  const [talks, all] = await Promise.all([fetchTalks(searchParams), fetchAll()]);
  const rollup = computeToolboxTalkRollup(all);

  function buildHref(overrides: Partial<{ status?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.status) params.set('status', merged.status);
    if (merged.jobId) params.set('jobId', merged.jobId);
    const q = params.toString();
    return q ? `/toolbox-talks?${q}` : '/toolbox-talks';
  }
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('toolbox.title')}
          subtitle={t('toolbox.subtitle')}
          actions={
            <LinkButton href="/toolbox-talks/new" variant="primary" size="md">
              {t('toolbox.newTalk')}
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('toolbox.tile.total')} value={rollup.total} />
          <Tile label={t('toolbox.tile.lastHeld')} value={rollup.lastHeldOn ?? '—'} />
          <Tile
            label={t('toolbox.tile.daysSince')}
            value={rollup.daysSinceLast ?? '—'}
            tone={rollup.overdue ? 'danger' : 'success'}
          />
          <Tile
            label={t('toolbox.tile.compliance')}
            value={rollup.overdue ? t('toolbox.tile.compliance.overdue') : t('toolbox.tile.compliance.current')}
            tone={rollup.overdue ? 'danger' : 'success'}
          />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">{t('toolbox.filter.status')}</span>
          <Link
            href={buildHref({ status: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.status ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {t('toolbox.filter.all')}
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={buildHref({ status: s })}
              className={`rounded px-2 py-1 text-xs ${searchParams.status === s ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {toolboxTalkStatusLabel(s)}
            </Link>
          ))}
        </section>

        {talks.length === 0 ? (
          <EmptyState
            title={t('toolbox.empty.title')}
            body={t('toolbox.empty.body')}
            actions={[{ href: '/toolbox-talks/new', label: t('toolbox.empty.action'), primary: true }]}
          />
        ) : (
          <DataTable
            rows={talks}
            keyFn={(tt) => tt.id}
            columns={[
              {
                key: 'heldOn',
                header: t('toolbox.col.held'),
                cell: (tt) => (
                  <Link href={`/toolbox-talks/${tt.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                    {tt.heldOn}
                  </Link>
                ),
              },
              { key: 'topic', header: t('toolbox.col.topic'), cell: (tt) => <span className="text-sm text-gray-900">{tt.topic}</span> },
              { key: 'leader', header: t('toolbox.col.leader'), cell: (tt) => <span className="text-xs text-gray-700">{tt.leaderName}</span> },
              {
                key: 'attendees',
                header: t('toolbox.col.attendees'),
                numeric: true,
                cell: (tt) => <span className="font-mono text-xs text-gray-700">{signedAttendeeCount(tt)} / {tt.attendees.length}</span>,
              },
              {
                key: 'status',
                header: t('toolbox.col.status'),
                cell: (tt) => <StatusPill label={toolboxTalkStatusLabel(tt.status)} tone="neutral" />,
              },
              {
                key: 'actions',
                header: '',
                cell: (tt) => (
                  <Link href={`/toolbox-talks/${tt.id}/sign-in`} className="text-xs text-blue-700 hover:underline">
                    {t('toolbox.action.signIn')}
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
