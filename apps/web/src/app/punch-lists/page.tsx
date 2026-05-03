// /punch-lists — closeout punch items across all jobs.
//
// Plain English: every open punch item, oldest first, with a red
// "overdue" badge for anything past its dueOn date. This is what
// you walk down with your foreman the week before substantial
// completion.
//
// Refactored to use the shared component library.

import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusPill,
} from '../../components';
import { getTranslator } from '../../lib/locale';
import { punchItemStatusLabel, punchItemSeverityLabel, type PunchItem } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchPunchItems(): Promise<PunchItem[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/punch-items`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body.items;
    return Array.isArray(arr) ? (arr as PunchItem[]) : [];
  } catch {
    return [];
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function severityTone(sev: string): 'danger' | 'warn' | 'muted' {
  switch (sev) {
    case 'SAFETY': return 'danger';
    case 'MAJOR':  return 'warn';
    default:       return 'muted';
  }
}

const OPEN_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'DISPUTED']);

export default async function PunchListsPage() {
  const items = await fetchPunchItems();
  const today = todayIso();
  const open = items.filter((i) => OPEN_STATUSES.has(i.status));
  const closed = items.filter((i) => !OPEN_STATUSES.has(i.status));
  open.sort((a, b) => a.identifiedOn.localeCompare(b.identifiedOn));
  const overdueCount = open.filter((i) => i.dueOn && i.dueOn < today).length;
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('punchLists.title')}
          subtitle={
            <>
              {t('punchLists.subtitle.open', { count: open.length })} ·{' '}
              {overdueCount > 0 ? (
                <span className="font-semibold text-red-700">{t('punchLists.subtitle.overdue', { count: overdueCount })}</span>
              ) : (
                t('punchLists.subtitle.zeroOverdue')
              )}{' '}
              · {t('punchLists.subtitle.closed', { count: closed.length })}
            </>
          }
          actions={
            <LinkButton href="/punch-lists/new" variant="primary" size="md">
              {t('punchLists.newItem')}
            </LinkButton>
          }
        />

        {open.length === 0 ? (
          <EmptyState
            title={t('punchLists.empty.title')}
            body={t('punchLists.empty.body')}
            actions={[{ href: '/punch-lists/new', label: t('punchLists.empty.action'), primary: true }]}
          />
        ) : (
          <DataTable
            rows={open}
            keyFn={(i) => i.id}
            columns={[
              {
                key: 'identifiedOn',
                header: t('punchLists.col.identified'),
                cell: (i) => i.identifiedOn,
              },
              {
                key: 'jobId',
                header: t('punchLists.col.job'),
                cell: (i) => (
                  <Link href={`/jobs/${i.jobId}`} className="text-blue-700 hover:underline">
                    {i.jobId}
                  </Link>
                ),
              },
              { key: 'location', header: t('punchLists.col.location'), cell: (i) => i.location },
              {
                key: 'severity',
                header: t('punchLists.col.severity'),
                cell: (i) => <StatusPill label={punchItemSeverityLabel(i.severity)} tone={severityTone(i.severity)} />,
              },
              { key: 'description', header: t('punchLists.col.description'), cell: (i) => i.description },
              {
                key: 'dueOn',
                header: t('punchLists.col.due'),
                cell: (i) => {
                  if (!i.dueOn) return <span className="text-gray-400">—</span>;
                  const overdue = i.dueOn < today;
                  return <span className={overdue ? 'font-semibold text-red-700' : ''}>{i.dueOn}</span>;
                },
              },
              {
                key: 'responsibleParty',
                header: t('punchLists.col.responsible'),
                cell: (i) => i.responsibleParty ?? <span className="text-gray-400">{t('punchLists.unassigned')}</span>,
              },
            ]}
          />
        )}

        {closed.length > 0 && (
          <details className="mt-6 rounded-md border border-gray-200 bg-white">
            <summary className="cursor-pointer px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
              {t('punchLists.closedSummary', { count: closed.length })}
            </summary>
            <ul className="divide-y divide-gray-100 text-sm">
              {closed.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-2 text-gray-600">
                  <span className="text-xs text-gray-400">{i.closedOn ?? i.identifiedOn}</span>
                  <span>{i.location}</span>
                  <span>·</span>
                  <span className="line-clamp-1">{i.description}</span>
                  <span className="ml-auto text-xs text-gray-500">{punchItemStatusLabel(i.status)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>
    </AppShell>
  );
}
