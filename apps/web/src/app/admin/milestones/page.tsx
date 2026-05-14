import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Milestone { bundle: string; date: string; description: string; href?: string }

const MILESTONES: Milestone[] = [
  { bundle: '#2000', date: '2026-05-14', description: 'Single-page command center', href: '/at-a-glance' },
  { bundle: '#1929', date: '2026-05-14', description: 'Comprehensive site map', href: '/sitemap' },
  { bundle: '#1932', date: '2026-05-14', description: 'VP-level portfolio overview', href: '/portfolio' },
  { bundle: '#2052', date: '2026-05-14', description: 'Flat URL listing of every page', href: '/admin/everything' },
  { bundle: '#2060', date: '2026-05-14', description: 'URL map grouped by area', href: '/admin/url-map' },
  { bundle: '#2068', date: '2026-05-14', description: 'Index of every detail view', href: '/admin/all-detail-views' },
  { bundle: '#2092', date: '2026-05-14', description: 'Stats panel index', href: '/dashboard/stats-index' },
  { bundle: '#2096', date: '2026-05-14', description: 'Cross-tab grid index', href: '/admin/cross-tabs-index' },
  { bundle: '#2100', date: '2026-05-14', description: 'You are here — milestone roster page.' },
];

export default function MilestonesPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Session milestones" subtitle="Significant pages shipped during the autopilot crank — every 50-or-so bundles." />
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
          {MILESTONES.map((m, i) => (
            <li key={i} className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-baseline md:gap-3">
              <span className="font-mono text-xs text-gray-500 md:w-16">{m.bundle}</span>
              <span className="font-mono text-xs text-gray-500 md:w-24">{m.date}</span>
              <span className="text-sm text-gray-900 md:flex-1">
                {m.description}
                {m.href ? <> · <Link href={m.href} className="text-yge-blue-700 hover:underline">{m.href}</Link></> : null}
              </span>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
