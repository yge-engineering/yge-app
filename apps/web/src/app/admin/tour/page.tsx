import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';

interface Stop { title: string; href: string; description: string }

const STOPS: Stop[] = [
  { title: 'Welcome', href: '/at-a-glance', description: 'Start here. The command center summarizes everything else.' },
  { title: 'Pipeline', href: '/jobs/statuses', description: 'The jobs section is organized by status. Each card opens a filtered list.' },
  { title: 'Bid intelligence', href: '/bid-results/outcomes', description: 'Every bid result is recorded. Wins, losses, apparent lows, top competitors — all here.' },
  { title: 'Customers', href: '/customers', description: 'Master customer list. By kind / state / city / zip / payment terms — drill any of those down.' },
  { title: 'Vendors + subs', href: '/vendors/scorecard', description: 'Vendor scorecard reads as a leaderboard. COI aging tracks insurance expirations.' },
  { title: 'People', href: '/employees/active', description: 'Active roster + by classification + by tenure.' },
  { title: 'Master rate book', href: '/equipment-rates/owned-vs-rental', description: 'Owned + rental equipment side by side. Labor rates by classification under /labor-rates.' },
  { title: 'Cleanup', href: '/admin/data-quality-hub', description: 'Every missing-X view in one place. Coverage % at /admin/cleanup-progress.' },
  { title: 'Reports', href: '/reports', description: 'One landing page that links to every analytic + grouping view.' },
  { title: 'Admin tools', href: '/admin/grand-index', description: 'The big admin catalog. System health, audit log, integrations, feature flags.' },
];

export default function TourPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Guided tour" subtitle="A narrative walkthrough of the main areas of the YGE app." />
        <ol className="space-y-3">
          {STOPS.map((s, i) => (
            <li key={i} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">{i + 1}. {s.title}</h2>
              <p className="mt-1 text-sm text-gray-700">{s.description}</p>
              <Link href={s.href} className="mt-2 inline-block text-xs text-yge-blue-700 hover:underline">{s.href} →</Link>
            </li>
          ))}
        </ol>
      </main>
    </AppShell>
  );
}
