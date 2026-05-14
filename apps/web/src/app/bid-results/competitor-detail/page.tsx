import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

export default function CompetitorDetailPlaceholder() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Competitor detail — coming soon" subtitle="Per-competitor history page is on the roadmap." />
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-700">
          Today: the <Link href="/bid-results/top-competitors" className="text-yge-blue-700 hover:underline">top competitors</Link>
          {' '}leaderboard shows appearance + win counts per competitor.
        </p>
        <p className="mt-3 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-700">
          Planned next:
          <ul className="mt-2 list-disc pl-6 text-sm">
            <li>Click any competitor name to drill into <code className="rounded bg-gray-100 px-1">/bid-results/competitor/[bidderName]</code></li>
            <li>Their full bid history against us — every project, win/lose, amount delta</li>
            <li>Median + min + max gap when both bid the same project</li>
            <li>Agencies where they show up most</li>
            <li>Lifetime $ won by them on tabs we also bid</li>
          </ul>
        </p>
      </main>
    </AppShell>
  );
}
