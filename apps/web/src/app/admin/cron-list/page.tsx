import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Cron { name: string; cron: string; status: 'planned' | 'shipped'; description: string }

const CRONS: Cron[] = [
  { name: 'Daily COI scan', cron: '0 7 * * *', status: 'planned', description: 'Email Brook the list of subs whose COI expires within 30 days.' },
  { name: 'Daily TBD chase', cron: '0 8 * * *', status: 'planned', description: 'Email Ryan the list of bid results still in TBD beyond 14 days after bidOpenedAt.' },
  { name: 'Weekly portfolio digest', cron: '0 7 * * 1', status: 'planned', description: 'Email officers a summary of last week pipeline + wins.' },
  { name: 'Nightly CSV snapshot', cron: '0 2 * * *', status: 'planned', description: 'Encrypted dump of master tables to backup storage.' },
];

export default function CronListPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Cron / recurring tasks" subtitle="Planned recurring server-side jobs. None wired up yet — this is the spec." />
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
          {CRONS.map((c) => (
            <li key={c.name} className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-baseline md:gap-3">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${c.status === 'shipped' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                {c.status}
              </span>
              <span className="font-semibold text-gray-900 md:w-1/4">{c.name}</span>
              <span className="font-mono text-xs text-gray-500 md:w-1/4">{c.cron}</span>
              <span className="text-xs text-gray-600 md:flex-1">{c.description}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          See <Link href="/admin/scheduled-tasks" className="text-yge-blue-700 hover:underline">/admin/scheduled-tasks</Link> for the human-readable equivalent.
        </p>
      </main>
    </AppShell>
  );
}
