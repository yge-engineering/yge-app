import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Task { name: string; cadence: string; description: string; status: 'planned' | 'shipped' }

const TASKS: Task[] = [
  { name: 'Daily COI expiration scan', cadence: 'Daily, 7:00 PT', description: 'Email Brook the list of subs whose COI expires within 30 days.', status: 'planned' },
  { name: 'Bid result reminder', cadence: 'Daily, 8:00 PT', description: 'Email Ryan the list of bid results still in TBD beyond 14 days after bidOpenedAt.', status: 'planned' },
  { name: 'Weekly portfolio digest', cadence: 'Monday, 7:00 PT', description: 'Email Brook + Ryan a summary of last weeks pipeline, wins, and losses.', status: 'planned' },
  { name: 'CSV exports backup', cadence: 'Nightly, 2:00 PT', description: 'Snapshot the master tables to encrypted S3 storage.', status: 'planned' },
];

export default function ScheduledTasksPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Scheduled tasks" subtitle="Planned background jobs. None are wired up yet — this is the roadmap." />
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
          {TASKS.map((t) => (
            <li key={t.name} className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-center md:gap-3">
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-700">
                {t.status}
              </span>
              <span className="font-semibold text-gray-900 md:flex-1">{t.name}</span>
              <span className="font-mono text-xs text-gray-500">{t.cadence}</span>
              <span className="text-xs text-gray-600 md:w-1/2">{t.description}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          When these ship the page will switch to a live list pulled from /api/admin/scheduled-tasks.
        </p>
      </main>
    </AppShell>
  );
}
